"""Development server for the Android bridge (docs/contracts/bridge.schema.json).

Stands in for the core on the laptop so the device side can be tested on its
own: it accepts the connection from 8's accessibility service, validates every
message in both directions against bridge.schema.json (contracts v1.1), and
can ask for snapshots, send performs and push confirmations. It is a dev tool; the real core side is not this.

Usage (Python 3.12, from the repository root):

    python -m pip install -r adapters/android/requirements-dev.txt
    adb reverse tcp:8765 tcp:8765      # or pass --adb-reverse
    python adapters/android/bridge_dev_server.py --contracts docs/contracts

Interactive commands (one per line), or a script with --run "cmd; cmd; ...":

    snap                     ask for a snapshot and print it
    tap   TARGET             perform tap
    type  TARGET TEXT...     perform type (TEXT is the real value)
    scroll [TARGET] DIR      perform scroll (up, down, left, right)
    back                     perform back
    open  PACKAGE            perform open_app
    key   NAME               perform key (enter, back, home)
    expect TARGET TEXT...    check the element's text in the last snapshot
    confirm [AMOUNT [NAME [EXPIRES_S]]]
                             push a confirmation request to 8 and wait for
                             its approval_result (defaults: "200,00 €",
                             "Nimbo Bróker", 300 s). Sends render_values first
                             (the token values for the session), then
                             confirm_request; both and the answer are
                             validated against bridge.schema.json. Does
                             not block: other commands keep working
    resend [ID]              send confirm_request ID again with the same id
                             (default: the last one), as the core does after
                             a hello; 8 must answer the same approval_result
                             without asking again if it was already answered
    await                    wait for the pending approval_results
    wait  SECONDS            pause (lets the screen settle between steps)
    quit

TARGET is an element id from the last snapshot (n7) or @something, matched
against sel (id/iban_destino, or just iban_destino), then label, then text.

Messages carry real values. The log masks the text of elements unless
--show-values is given; use it only with simulated data.
"""

from __future__ import annotations

import argparse
import asyncio
import itertools
import json
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

BASE_URI = "https://priv8.dev/contracts/"
REPLY_TIMEOUT_S = 15.0
# Message type -> its branch of the oneOf in bridge.schema.json, to report the
# errors of the right one. confirm_request and approval_result are refs to
# confirm.schema.json (contracts v1.1).
DEFS = {
    "hello": "hello",
    "snapshot.request": "snapshot_request",
    "snapshot": "snapshot",
    "perform": "perform",
    "result": "result",
    "event": "event",
    "render_values": "render_values",
    "voice": "voice",
    "voice.audio": "voice_audio",
    "voice.audio.end": "voice_audio_end",
    "voice.done": "voice_done",
}
CONFIRM_DEFS = {"confirm_request": "request", "approval_result": "approval_result"}


def load_validator(contracts: Path) -> Draft202012Validator:
    """Validator for bridge.schema.json with its $refs resolved locally."""
    schemas = {}
    for path in contracts.glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        schemas[path.name] = schema
    if "bridge.schema.json" not in schemas:
        raise SystemExit(f"{contracts}: bridge.schema.json not found")
    registry = Registry().with_resources(
        (BASE_URI + name, Resource.from_contents(s)) for name, s in schemas.items()
    )
    return Draft202012Validator(schemas["bridge.schema.json"], registry=registry)


def log(arrow: str, text: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {arrow} {text}", flush=True)


class Session:
    """One connected device."""

    def __init__(self, ws: ServerConnection, validator: Draft202012Validator, args: argparse.Namespace,
                 confirms: dict[str, dict[str, Any]], unanswered: set[str]):
        self.ws = ws
        # Shared by all connections, like the core: every confirm_request sent
        # (to resend it by id) and the ids still without an approval_result,
        # which are sent again after each hello (contracts v1.1).
        self.confirms = confirms
        self.unanswered = unanswered
        self.validator = validator
        self.args = args
        self.pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self.hello = asyncio.get_running_loop().create_future()
        self.last: dict[str, Any] | None = None
        self.ids = itertools.count(1)
        self.failures = 0
        self.snap_count = 0
        self.waiting: list[asyncio.Task[None]] = []

    # ---- validation --------------------------------------------------

    def check(self, msg: Any) -> str | None:
        """Returns None if msg is valid, else a short description of the first error."""
        if self.validator.is_valid(msg):
            return None
        # The schema is a oneOf; report the errors of the branch for this type.
        kind = msg.get("type") if isinstance(msg, dict) else None
        validator = self.validator
        if kind in CONFIRM_DEFS:
            validator = self.validator.evolve(schema={"$ref": f"{BASE_URI}confirm.schema.json#/$defs/{CONFIRM_DEFS[kind]}"})
        elif kind in DEFS:
            validator = self.validator.evolve(schema={"$ref": f"{BASE_URI}bridge.schema.json#/$defs/{DEFS[kind]}"})
        error = next(iter(validator.iter_errors(msg)), None)
        if error is None:
            return "does not match bridge.schema.json"
        path = "/".join(str(p) for p in error.absolute_path) or "(root)"
        return f"{path}: {error.message}"

    # ---- receive -----------------------------------------------------

    async def reader(self) -> None:
        async for frame in self.ws:
            try:
                msg = json.loads(frame)
            except json.JSONDecodeError:
                self.failures += 1
                log("<-", "INVALID: not JSON")
                continue
            error = self.check(msg)
            kind = msg.get("type") if isinstance(msg, dict) else None
            status = "valid" if error is None else f"INVALID {error}"
            if error is not None:
                self.failures += 1
            if kind == "hello":
                log("<-", f"hello device={msg.get('device')!r} version={msg.get('version')} [{status}]")
                if not self.hello.done():
                    self.hello.set_result(msg)
                for cid in sorted(self.unanswered):
                    await self.resend(cid, after_hello=True)
            elif kind == "snapshot":
                self.snap_count += 1
                self.last = msg.get("raw")
                log("<-", f"snapshot {msg.get('id')} [{status}]")
                self.print_snapshot(msg.get("raw") or {})
                self.save(msg)
                self.resolve(msg)
            elif kind == "result":
                extra = "" if msg.get("ok") else f" error={msg.get('error')}"
                log("<-", f"result {msg.get('id')} ok={msg.get('ok')}{extra} [{status}]")
                self.resolve(msg)
            elif kind == "approval_result":
                reason = f" reason={msg['reason']}" if "reason" in msg else ""
                log("<-", f"approval_result {msg.get('id')} ok={msg.get('ok')} via={msg.get('via')} "
                          f"by={msg.get('by')}{reason} [{status}]")
                self.unanswered.discard(str(msg.get("id")))
                self.resolve(msg)
            elif kind == "voice.done":
                gap = msg.get("gap_ms") or {}
                log("<-", f"voice.done {msg.get('utterance')} ok={msg.get('ok')} "
                          f"gap_max={gap.get('max', '-')} gap_mean={gap.get('mean', '-')} [{status}]")
            elif kind == "event":
                detail = f" detail={msg['detail']!r}" if "detail" in msg else ""
                log("<-", f"event {msg.get('kind')} app={msg.get('app')}{detail} [{status}]")
            else:
                log("<-", f"{kind!r} [{status}]")

    def resolve(self, msg: dict[str, Any]) -> None:
        fut = self.pending.pop(str(msg.get("id")), None)
        if fut and not fut.done():
            fut.set_result(msg)

    def save(self, msg: dict[str, Any]) -> None:
        if not self.args.out:
            return
        out = Path(self.args.out)
        out.mkdir(parents=True, exist_ok=True)
        path = out / f"snapshot-{self.snap_count:02d}-{msg.get('id')}.json"
        path.write_text(json.dumps(msg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        log("  ", f"saved {path}")

    def shown(self, value: Any) -> str:
        if value is None:
            return "-"
        if self.args.show_values:
            return repr(value)
        return f"<{len(str(value))} chars>"

    def print_snapshot(self, raw: dict[str, Any]) -> None:
        log(
            "  ",
            f"app={raw.get('app')} screen={raw.get('screen')} seq={raw.get('seq')} "
            f"focus={raw.get('focus')} system_dialog={raw.get('system_dialog')} "
            f"elements={len(raw.get('elements') or [])}",
        )
        for el in raw.get("elements") or []:
            flags = []
            if el.get("password"):
                flags.append("PASSWORD(rojo)")
            if el.get("enabled") is False:
                flags.append("disabled")
            if el.get("actions"):
                flags.append("actions=" + ",".join(el["actions"]))
            text = el.get("text")
            # Password text is already masked on the device; show it as is.
            text_shown = repr(text) if el.get("password") and text else self.shown(text)
            print(
                f"      {el.get('id'):>5} {el.get('role'):<9} sel={el.get('sel', '-'):<28} "
                f"label={self.shown(el.get('label')):<22} text={text_shown:<24} "
                f"parent={el.get('parent') or '-'} {' '.join(flags)}",
                flush=True,
            )

    # ---- send --------------------------------------------------------

    async def request(self, msg: dict[str, Any]) -> dict[str, Any] | None:
        error = self.check(msg)
        if error is not None:
            self.failures += 1
            log("->", f"NOT SENT, invalid {msg.get('type')}: {error}")
            return None
        fut = asyncio.get_running_loop().create_future()
        self.pending[msg["id"]] = fut
        summary = {k: v for k, v in msg.items() if k != "text"}
        if "text" in msg:
            summary["text"] = msg["text"] if self.args.show_values else f"<{len(msg['text'])} chars>"
        log("->", f"{json.dumps(summary, ensure_ascii=False)} [valid]")
        await self.ws.send(json.dumps(msg, ensure_ascii=False))
        try:
            return await asyncio.wait_for(fut, REPLY_TIMEOUT_S)
        except TimeoutError:
            self.pending.pop(msg["id"], None)
            self.failures += 1
            log("  ", f"no reply to {msg['id']} in {REPLY_TIMEOUT_S:.0f} s")
            return None

    def target(self, ref: str) -> str | None:
        if not ref.startswith("@"):
            return ref
        key = ref[1:]
        elements = (self.last or {}).get("elements") or []
        for field, match in (
            ("sel", lambda v: v == key or v.endswith("/" + key)),
            ("label", lambda v: v == key),
            ("text", lambda v: v == key),
        ):
            for el in elements:
                value = el.get(field)
                if isinstance(value, str) and match(value):
                    return el["id"]
        self.failures += 1
        log("  ", f"{ref}: no element in the last snapshot")
        return None

    def next_id(self, prefix: str) -> str:
        return f"{prefix}{next(self.ids)}"

    async def command(self, line: str) -> bool:
        """Runs one command. Returns False to stop."""
        try:
            parts = shlex.split(line)
        except ValueError as e:
            log("  ", f"bad command: {e}")
            return True
        if not parts:
            return True
        cmd, rest = parts[0], parts[1:]
        if cmd in ("quit", "exit"):
            return False
        if cmd == "snap":
            await self.request({"type": "snapshot.request", "id": self.next_id("q")})
        elif cmd == "wait":
            await asyncio.sleep(float(rest[0]) if rest else 1.0)
        elif cmd == "back":
            await self.perform({"op": "back"})
        elif cmd == "open" and rest:
            await self.perform({"op": "open_app", "text": rest[0]})
        elif cmd == "key" and rest:
            await self.perform({"op": "key", "text": rest[0]})
        elif cmd == "tap" and rest:
            if (t := self.target(rest[0])) is not None:
                await self.perform({"op": "tap", "target": t})
        elif cmd == "type" and len(rest) >= 2:
            if (t := self.target(rest[0])) is not None:
                await self.perform({"op": "type", "target": t, "text": " ".join(rest[1:])})
        elif cmd == "scroll" and rest:
            msg: dict[str, Any] = {"op": "scroll", "direction": rest[-1]}
            if len(rest) > 1:
                if (t := self.target(rest[0])) is None:
                    return True
                msg["target"] = t
            await self.perform(msg)
        elif cmd == "confirm":
            await self.confirm(*rest[:3])
        elif cmd == "resend":
            cid = rest[0] if rest else next(reversed(self.confirms), None)
            if cid is None:
                log("  ", "resend: no confirm_request sent yet")
            else:
                await self.resend(cid)
        elif cmd == "await":
            if self.waiting:
                await asyncio.gather(*self.waiting)
                self.waiting.clear()
        elif cmd == "expect" and len(rest) >= 2:
            self.expect(rest[0], " ".join(rest[1:]))
        else:
            log("  ", f"unknown or incomplete command: {line!r}")
        return True

    async def confirm(self, amount: str = "200,00 €", name: str = "Nimbo Bróker", expires: str = "300") -> None:
        """Pushes a confirmation like the core would and waits for the person's answer."""
        # Unique across connections: confirms outlives each Session.
        cid, session = f"c{len(self.confirms) + 1}", "s1"
        importe, destino = "‹IMPORTE_1›", "‹PROVEEDOR_1-propio›"
        values = {"type": "render_values", "session": session, "values": {importe: amount, destino: name}}
        request = {
            "type": "confirm_request",
            "id": cid,
            "session": session,
            "kind": "transferir",
            "action": {"op": "tap", "target": "n17", "label": "Enviar"},
            "summary": [
                {"voice": "local", "token": importe, "say_as": "currency"},
                {"voice": "cloud", "text": "a tu cuenta de"},
                {"voice": "local", "token": destino, "say_as": "name"},
                {"voice": "cloud", "text": "¿Lo confirmas?"},
            ],
            "channels": ["voz", "pantalla"],
            "sca": "persona",
            "expires_s": int(expires),
        }
        for msg in (values, request):
            if (error := self.check(msg)) is not None:
                self.failures += 1
                log("->", f"NOT SENT, invalid {msg['type']}: {error}")
                return
        shown = {k: (v if self.args.show_values else f"<{len(v)} chars>") for k, v in values["values"].items()}
        log("->", f"render_values session={session} values={json.dumps(shown, ensure_ascii=False)} [valid]")
        await self.ws.send(json.dumps(values, ensure_ascii=False))
        self.confirms[cid] = request
        self.unanswered.add(cid)
        await self.send_confirm(cid, int(expires) + 15)

    async def send_confirm(self, cid: str, timeout: int, note: str = "") -> None:
        request = self.confirms[cid]
        fut = asyncio.get_running_loop().create_future()
        self.pending[cid] = fut
        log("->", f"confirm_request {cid} kind={request['kind']} expires_s={request['expires_s']}{note} [valid]")
        await self.ws.send(json.dumps(request, ensure_ascii=False))
        # Wait in the background so other commands (snap, tap...) still run
        # while the confirmation is open; `await` waits for the answer.
        self.waiting.append(asyncio.create_task(self.approval(cid, fut, timeout)))

    async def resend(self, cid: str, after_hello: bool = False) -> None:
        """Sends confirm_request cid again with the same id, as the core does after a hello."""
        if cid not in self.confirms:
            self.failures += 1
            log("  ", f"resend: no confirm_request {cid}")
            return
        why = "pending after hello" if after_hello else ("unanswered" if cid in self.unanswered else "already answered")
        await self.send_confirm(cid, self.confirms[cid]["expires_s"] + 15, f" again ({why})")

    async def approval(self, cid: str, fut: asyncio.Future[dict[str, Any]], timeout: int) -> None:
        try:
            # The device answers caducado itself after expires_s; leave it a margin.
            result = await asyncio.wait_for(fut, timeout)
        except TimeoutError:
            self.pending.pop(cid, None)
            self.failures += 1
            log("  ", f"no approval_result for {cid} in {timeout} s")
            return
        log("  ", f"approval_result {json.dumps(result, ensure_ascii=False)}")

    async def perform(self, fields: dict[str, Any]) -> None:
        await self.request({"type": "perform", "id": self.next_id("a"), **fields})

    def expect(self, ref: str, want: str) -> None:
        t = self.target(ref)
        el = next((e for e in (self.last or {}).get("elements") or [] if e["id"] == t), None)
        got = el.get("text") if el else None
        if got == want:
            log("  ", f"expect {ref}: OK (text matches, {len(want)} chars)")
        else:
            self.failures += 1
            log("  ", f"expect {ref}: FAILED, text is {self.shown(got)}")


async def stdin_lines():
    loop = asyncio.get_running_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            return
        yield line.strip()


async def main(args: argparse.Namespace) -> int:
    validator = load_validator(Path(args.contracts))
    if args.adb_reverse:
        subprocess.run([args.adb, "reverse", f"tcp:{args.port}", f"tcp:{args.port}"], check=True)
        log("  ", f"adb reverse tcp:{args.port} tcp:{args.port}")
    done = asyncio.get_running_loop().create_future()
    sessions: list[Session] = []
    confirms: dict[str, dict[str, Any]] = {}
    unanswered: set[str] = set()

    async def handler(ws: ServerConnection) -> None:
        log("  ", f"device connected from {ws.remote_address}")
        session = Session(ws, validator, args, confirms, unanswered)
        sessions.append(session)
        reader = asyncio.create_task(session.reader())
        try:
            await asyncio.wait_for(asyncio.shield(session.hello), REPLY_TIMEOUT_S)
            if args.run is not None:
                for cmd in args.run.split(";"):
                    if not await session.command(cmd.strip()):
                        break
                if session.waiting:
                    await asyncio.gather(*session.waiting)
                log("  ", f"script finished, {session.failures} failures")
                if not done.done():
                    done.set_result(session.failures)
                if not args.stay:
                    return
            await reader
        except ConnectionClosed:
            pass
        except TimeoutError:
            log("  ", "no hello from the device")
        finally:
            reader.cancel()
            sessions.remove(session)
            log("  ", "device disconnected")

    async with serve(handler, args.host, args.port, max_size=8 * 1024 * 1024) as server:
        log("  ", f"listening on ws://{args.host}:{args.port}, contracts from {args.contracts}")
        if args.run is not None and not args.stay:
            failures = await done
            server.close()
            return 1 if failures else 0
        if args.run is None and sys.stdin.isatty():
            log("  ", "type commands once the device says hello (snap, tap, type, ...)")
        # Interactive mode (or --stay): commands from stdin go to the latest device.
        async for line in stdin_lines():
            if not sessions:
                log("  ", "no device connected")
                continue
            if not await sessions[-1].command(line):
                break
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--contracts", required=True, help="folder with the *.schema.json files (docs/contracts)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--run", help='commands separated by ";", run once the device says hello')
    p.add_argument("--stay", action="store_true", help="keep serving after --run")
    p.add_argument("--out", help="folder to save each snapshot message as JSON")
    p.add_argument("--show-values", action="store_true", help="print real values (simulated data only)")
    p.add_argument("--adb-reverse", action="store_true", help="run adb reverse for --port first")
    p.add_argument("--adb", default=str(Path.home() / "Library/Android/sdk/platform-tools/adb"))
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(asyncio.run(main(parse_args())))
