"""Android bridge, core side (docs/contracts/bridge.schema.json, contracts v1.1).

The core serves ws://127.0.0.1:8765 (the emulator reaches it through
`adb reverse tcp:8765 tcp:8765`) and the accessibility service of app 8
connects as the client. `AndroidBridge` wraps that connection in the Adapter
interface of core/adapter.py, so the core reads and acts on the phone exactly as
it does on a demo scene or on Playwright:

    snapshot()  -> snapshot.request / snapshot
    perform(a)  -> perform / result

It also carries what only the trusted zone may see, for this session:

- confirm_request: when the core holds an irreversible action it publishes a
  confirm_request (core/confirm.py). The bridge sends `render_values` with the
  real values of its tokens, then the request; app 8 says it with the local
  voice and answers `approval_result`, which goes to core.approve. After each
  `hello` the pending requests are sent again with the same id.
- voice: when the core publishes what 8 says (core.say), the bridge sends
  `render_values` first and then the `voice` message. `voice.done` from the
  phone is recorded as voice_out.

Every message, in and out, is validated against bridge.schema.json; an invalid
outgoing message is never sent. Messages carry real values: nothing here logs
texts or values, only types, ids and counts.

The server runs in its own thread with its own event loop; snapshot() and
perform() block the caller until the phone answers.
"""

from __future__ import annotations

import asyncio
import importlib
import itertools
import json
import sys
import threading
import time
from collections.abc import Callable
from pathlib import Path
from types import ModuleType
from typing import Any

from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

from adapters.android.bridge_dev_server import BASE_URI, CONFIRM_DEFS, DEFS, load_validator

HOST, PORT = "127.0.0.1", 8765
CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"
REPLY_TIMEOUT_S = 15.0
# After a paused snapshot (8's confirmation, the fingerprint, a password field) the
# phone forgets the ids of the screen; a perform waits this long for it to come back.
REFRESH_TIMEOUT_S = 8.0
APP_OCHO = "es.priv8.ocho"
APP_ALCOR = "es.priv8.banks.alcor"

Log = Callable[[str], None]


class BridgeUnavailable(RuntimeError):
    """No phone connected, or it did not answer in time."""


def _stderr(msg: str) -> None:
    print(f"priv8 puente: {msg}", file=sys.stderr, flush=True)


def _tokens_of(msg: dict[str, Any]) -> list[str]:
    """Tokens of a confirm_request (summary and action text) or of an utterance."""
    from core import tokens as T

    segs = msg.get("summary") or (msg.get("utterance") or {}).get("segments") or []
    toks = [s["token"] for s in segs if s.get("token")]
    toks += T.find((msg.get("action") or {}).get("text") or "")
    return list(dict.fromkeys(toks))


class AndroidBridge:
    """Adapter (core/adapter.py) over the bridge WebSocket, for one session."""

    def __init__(self, session: str, *, host: str = HOST, port: int = PORT,
                 contracts: Path = CONTRACTS, core: ModuleType | None = None,
                 reply_timeout: float = REPLY_TIMEOUT_S, push_confirms: bool = True,
                 log: Log | None = None) -> None:
        self.session = session
        self.host, self.port = host, port
        self.validator = load_validator(Path(contracts))
        self.core = core or importlib.import_module("core")
        self.reply_timeout = reply_timeout
        # Off with a simulated person (replays, tests): nobody would answer on the phone.
        self.push_confirms = push_confirms
        self.log = log or _stderr
        self.before_snapshot: Callable[[], None] | None = None  # simulated person, as in core/scenes.py
        # How long say() waits for app 8's events channel to reconnect once it is in front.
        self.present_wait = 6.0

        self.device: str | None = None
        self.failures = 0  # invalid messages, in or out
        self.device_events: list[dict[str, Any]] = []  # kind/app/detail of the phone's events
        self.voice_done: dict[str, dict[str, Any]] = {}
        self.sent: list[str] = []  # types of the messages sent, in order (tests, debugging)

        self._loop: asyncio.AbstractEventLoop | None = None
        self._loop_thread: threading.Thread | None = None
        self._server: Any = None
        self._ws: ServerConnection | None = None
        self._hello = threading.Event()
        self._ready = threading.Event()
        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._ids = itertools.count(1)
        self._last: dict[str, Any] | None = None  # last snapshot returned
        self._ref: dict[str, Any] | None = None   # last one with elements (not paused)
        self._unsubscribe: Callable[[], None] | None = None
        self._tasks: set[asyncio.Task[None]] = set()

    # ------------------------------------------------------------------ lifecycle

    def start(self) -> AndroidBridge:
        self._loop_thread = threading.Thread(target=self._run, name="priv8-bridge", daemon=True)
        self._loop_thread.start()
        if not self._ready.wait(10):
            raise BridgeUnavailable(f"no se pudo abrir ws://{self.host}:{self.port}")
        if isinstance(self._server, BaseException):
            raise BridgeUnavailable(f"no se pudo abrir ws://{self.host}:{self.port}: {self._server}")
        self._unsubscribe = self.core.events.subscribe(self._on_core_event)
        self.log(f"escuchando en ws://{self.host}:{self.port} (sesión {self.session})")
        return self

    def stop(self) -> None:
        if self._unsubscribe:
            self._unsubscribe()
            self._unsubscribe = None
        loop = self._loop
        if loop is not None and loop.is_running():
            async def close() -> None:
                if self._server is not None and not isinstance(self._server, BaseException):
                    self._server.close()
                    await self._server.wait_closed()
            try:
                asyncio.run_coroutine_threadsafe(close(), loop).result(5)
            except Exception:  # noqa: BLE001 - closing anyway
                pass
            loop.call_soon_threadsafe(loop.stop)
        if self._loop_thread is not None:
            self._loop_thread.join(5)

    def __enter__(self) -> AndroidBridge:
        return self.start()

    def __exit__(self, *_: Any) -> None:
        self.stop()

    @property
    def connected(self) -> bool:
        return self._ws is not None and self._hello.is_set()

    def wait_for_device(self, timeout: float | None = None) -> bool:
        return self._hello.wait(timeout)

    def _run(self) -> None:
        loop = asyncio.new_event_loop()
        self._loop = loop
        asyncio.set_event_loop(loop)

        async def open_server() -> None:
            try:
                self._server = await serve(self._handler, self.host, self.port, max_size=8 * 1024 * 1024)
                self.port = self._server.sockets[0].getsockname()[1]  # port 0: a free one (tests)
            except OSError as e:
                self._server = e
            self._ready.set()

        loop.run_until_complete(open_server())
        if not isinstance(self._server, BaseException):
            loop.run_forever()
        loop.close()

    # ------------------------------------------------------------------ validation

    def check(self, msg: Any) -> str | None:
        """None if msg follows bridge.schema.json; else the first error, without values."""
        if self.validator.is_valid(msg):
            return None
        kind = msg.get("type") if isinstance(msg, dict) else None
        validator = self.validator
        if kind in CONFIRM_DEFS:
            validator = validator.evolve(schema={"$ref": f"{BASE_URI}confirm.schema.json#/$defs/{CONFIRM_DEFS[kind]}"})
        elif kind in DEFS:
            validator = validator.evolve(schema={"$ref": f"{BASE_URI}bridge.schema.json#/$defs/{DEFS[kind]}"})
        error = next(iter(validator.iter_errors(msg)), None)
        if error is None:
            return "no sigue bridge.schema.json"
        path = "/".join(str(p) for p in error.absolute_path) or "(raíz)"
        return f"{path}: {error.validator}"

    # ------------------------------------------------------------------ loop side

    async def _handler(self, ws: ServerConnection) -> None:
        if self._ws is not None:  # one phone: the newest connection wins
            old = self._ws
            self._ws = None
            await old.close(1000, "otra conexión")
        self._ws = ws
        self.log("móvil conectado")
        try:
            async for frame in ws:
                if isinstance(frame, bytes):
                    continue  # PCM only flows core -> phone
                try:
                    msg = json.loads(frame)
                except json.JSONDecodeError:
                    self.failures += 1
                    self.log("mensaje que no es JSON, descartado")
                    continue
                error = self.check(msg)
                if error is not None:
                    self.failures += 1
                    self.log(f"mensaje {msg.get('type') if isinstance(msg, dict) else '?'} inválido ({error}), descartado")
                    fut = self._pending.pop(str(msg.get("id")), None) if isinstance(msg, dict) else None
                    if fut is not None and not fut.done():  # the answer to a request: fail it now
                        fut.set_exception(BridgeUnavailable(f"respuesta inválida del móvil: {error}"))
                    continue
                await self._on_message(msg)
        except ConnectionClosed:
            pass
        finally:
            if self._ws is ws:
                self._ws = None
                self._hello.clear()
                for fut in self._pending.values():
                    if not fut.done():
                        fut.set_exception(BridgeUnavailable("el móvil se desconectó"))
                self._pending.clear()
                self.log("móvil desconectado")

    async def _on_message(self, msg: dict[str, Any]) -> None:
        kind = msg["type"]
        if kind == "hello":
            self.device = msg["device"]
            self._hello.set()
            self.log(f"hello de {self.device}")
            if self.push_confirms:  # contracts v1.1: resend what is still pending, same id
                for req in self.core.pending(self.session):
                    await self._send_with_values(req)
        elif kind in ("snapshot", "result"):
            fut = self._pending.pop(msg["id"], None)
            if fut is not None and not fut.done():
                fut.set_result(msg)
        elif kind == "approval_result":
            self.log(f"approval_result {msg['id']} ok={msg['ok']} via={msg['via']}")
            # Off the loop and off this reader: approving runs the held action, which performs
            # (and reads the screen) over this same bridge.
            task = asyncio.create_task(self._approve(msg))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)
        elif kind == "voice.done":
            self.voice_done[msg["utterance"]] = msg
            gap = msg.get("gap_ms") or {}
            await asyncio.to_thread(self.core.record, {
                "session": self.session, "kind": "voice_out", "model_saw": None,
                "detail": f"{msg['utterance']} · sonó en el móvil · ok={msg['ok']}"
                          + (f" · hueco máx {gap['max']} ms" if "max" in gap else "")})
        elif kind == "event":
            ev = {k: msg[k] for k in ("kind", "app", "detail") if k in msg}
            self.device_events.append(ev)
            self.log(f"evento {ev.get('kind')}" + (f" ({ev['detail']})" if ev.get("kind") != "screen_changed"
                                                   and "detail" in ev else ""))

    async def _approve(self, msg: dict[str, Any]) -> None:
        try:
            res = await asyncio.to_thread(self.core.approve, msg)
        except Exception as e:  # noqa: BLE001 - logged, the core keeps running
            self.log(f"confirmación {msg['id']}: error {type(e).__name__}")
            return
        self.log(f"confirmación {msg['id']}: " + ("ejecutada" if res.get("ok") else res.get("denied", "?")))

    async def _send(self, msg: dict[str, Any]) -> None:
        error = self.check(msg)
        if error is not None:
            self.failures += 1
            raise ValueError(f"{msg.get('type')} inválido, no se envía: {error}")
        ws = self._ws
        if ws is None:
            raise BridgeUnavailable("no hay móvil conectado")
        await ws.send(json.dumps(msg, ensure_ascii=False))
        self.sent.append(msg["type"])

    async def _request(self, msg: dict[str, Any]) -> dict[str, Any]:
        fut = asyncio.get_running_loop().create_future()
        self._pending[msg["id"]] = fut
        try:
            await self._send(msg)
            return await asyncio.wait_for(fut, self.reply_timeout)
        except TimeoutError:
            raise BridgeUnavailable(f"el móvil no respondió a {msg['id']} en {self.reply_timeout:.0f} s") from None
        finally:
            self._pending.pop(msg["id"], None)

    async def _send_with_values(self, msg: dict[str, Any]) -> None:
        """render_values (real values of the message's tokens) first, then the message."""
        values = self.core.render_values(self.session, _tokens_of(msg))
        if values:
            await self._send({"type": "render_values", "session": self.session, "values": values})
        await self._send(msg)

    def _call(self, coro: Any, timeout: float) -> Any:
        """Runs a coroutine on the bridge loop from another thread and waits for it."""
        loop = self._loop
        if loop is None or not loop.is_running():
            coro.close()
            raise BridgeUnavailable("el puente no está arrancado")
        if threading.current_thread() is self._loop_thread:
            loop.create_task(coro)  # never block the loop on itself
            return None
        return asyncio.run_coroutine_threadsafe(coro, loop).result(timeout)

    # ------------------------------------------------------------------ core events

    def _on_core_event(self, msg: dict[str, Any]) -> None:
        kind = msg.get("type")
        if kind == "voice":
            if (msg.get("utterance") or {}).get("session") != self.session:
                return
        elif kind == "confirm_request":
            if msg.get("session") != self.session or not self.push_confirms:
                return
        else:
            return
        if not self.connected:
            self.log(f"{kind} sin móvil conectado: " + ("se reenvía tras el hello" if kind == "confirm_request"
                                                        else "no se dice"))
            return
        try:
            self._call(self._send_with_values(msg), self.reply_timeout)
        except Exception as e:  # noqa: BLE001 - a broken phone never stops the core
            self.log(f"{kind} no enviado: {type(e).__name__}")

    # ------------------------------------------------------------------ Adapter

    def _next_id(self, prefix: str) -> str:
        return f"{prefix}{next(self._ids)}"

    def _snapshot(self) -> dict[str, Any]:
        if not self.connected:
            raise BridgeUnavailable("no hay móvil conectado al puente (ws://127.0.0.1:8765)")
        reply = self._call(self._request({"type": "snapshot.request", "id": self._next_id("q")}),
                           self.reply_timeout + 1)
        raw = reply["raw"]
        self._last = raw
        if raw.get("elements") and not self.core.pause_before_policy(raw):
            self._ref = raw
        return raw

    def snapshot(self) -> dict[str, Any]:
        if self.before_snapshot is not None:
            self.before_snapshot()
        return self._snapshot()

    def perform(self, action: dict[str, Any]) -> dict[str, Any]:
        if not self.connected:
            return {"ok": False, "error": "timeout"}
        target = action.get("target")
        ref = self._ref
        if target and self._last is not ref:
            # The phone took a later snapshot (a pause) and forgot the ids: read the screen
            # again and find the same element in it.
            action = self._remap(action, ref)
            if action is None:
                return {"ok": False, "error": "target_no_encontrado"}
        msg = {"type": "perform", "id": self._next_id("a"), **action}
        try:
            reply = self._call(self._request(msg), self.reply_timeout + 1)
        except (BridgeUnavailable, TimeoutError):
            return {"ok": False, "error": "timeout"}
        if reply is None:
            return {"ok": False, "error": "otro"}
        return {"ok": True} if reply["ok"] else {"ok": False, "error": reply.get("error", "otro")}

    def _remap(self, action: dict[str, Any], ref: dict[str, Any] | None) -> dict[str, Any] | None:
        target = action["target"]
        old = next((e for e in (ref or {}).get("elements", []) if e.get("id") == target), None)
        if old is None:
            return None
        key = lambda e: (e.get("role"), e.get("sel"), e.get("label"), e.get("text"))  # noqa: E731
        nth = [e["id"] for e in ref["elements"] if key(e) == key(old)].index(target)
        end = time.monotonic() + REFRESH_TIMEOUT_S
        while True:
            try:
                raw = self._snapshot()
            except BridgeUnavailable:
                return None
            if raw.get("elements") and not self.core.pause_before_policy(raw):
                same = [e["id"] for e in raw["elements"] if key(e) == key(old)]
                if raw.get("app") == ref.get("app") and len(same) > nth:
                    return {**action, "target": same[nth]}
                return None
            if time.monotonic() >= end:
                return None
            time.sleep(0.5)

    # ------------------------------------------------------------------ trust-zone helpers

    def open_app(self, package: str) -> bool:
        """Brings an app to the front. For the harness (8's own app, the bank to start
        from), not for the agent: the agent opens apps with act."""
        return bool(self.perform({"op": "open_app", "text": package}).get("ok"))

    def wait_for_screen(self, ok: Callable[[dict[str, Any]], bool], timeout: float, every: float = 1.5) -> bool:
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            try:
                if ok(self._snapshot()):
                    return True
            except BridgeUnavailable:
                pass
            time.sleep(every)
        return False

    def say(self, text: str, *, present: bool = True) -> dict[str, Any] | None:
        """8 says `text` (tokens, not values) on the phone: the core publishes the utterance,
        and this bridge sends render_values and then the voice message. With `present`, app
        8 comes to the front first and its events channel gets a moment to reconnect."""
        if present and self.connected and (self._last or {}).get("app") != APP_OCHO:
            before = self.core.events.count()
            if self.open_app(APP_OCHO):
                end = time.monotonic() + self.present_wait
                while self.core.events.count() <= before and time.monotonic() < end:
                    time.sleep(0.2)
        return self.core.say(self.session, text)
