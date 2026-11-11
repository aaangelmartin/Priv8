"""Dev stand-in for the core's event channel, for app 8 (issue #39).

Serves ws://127.0.0.1:8700/events (docs/contracts/events.schema.json) and
plays scripted scenes so 8's eyes can be tried before the core exists. Every
message it sends is validated against the v1 contracts first; an invalid one
is not sent. It also serves a browser preview of the app on :8710.

It is a dev tool: the real channel is served by the core (Camino 1), in the
same process as the agent. Data is simulated.

Usage, from the repository root:

    uv run --python 3.12 --with websockets==15.0.1 --with jsonschema==4.25.1 \
        python apps/android-8/dev/events_dev_server.py

    Browser:  http://127.0.0.1:8710/ocho/app.html?debug
    Emulator: adb reverse tcp:8700 tcp:8700, then open the app 8

Commands (one per line, or --run "cmd; cmd"):

    saldo           scene "¿Cuánto tengo entre mis bancos?"
    transferencia   scene "Pasa 200 € al bróker" (paused, confirmation)
    bloqueos        a red value and an IBAN from an email, both blocked
    todo            the three scenes, one after another
    KIND [REASON]   one audit event: task, observe_sent, act, oracle, held,
                    approval, blocked REASON, paused, call
    voz             one voice message
    confirmar       one confirm_request
    si | no         one approval_result (ok / cancelado)
    wait SECONDS
    quit
"""

from __future__ import annotations

import argparse
import asyncio
import functools
import hashlib
import http.server
import json
import shlex
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "apps/android-8/app/src/main/assets/ocho"
OJOS = ROOT / "docs/ojos.html"
BASE_URI = "https://priv8.dev/contracts/"
SESSION = "s2"
ZERO = "sha256:" + "0" * 64


def log(text: str) -> None:
    print(f"{time.strftime('%H:%M:%S')} {text}", flush=True)


def load_validator(contracts: Path) -> Draft202012Validator:
    schemas = {}
    for path in contracts.glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        schemas[path.name] = schema
    registry = Registry().with_resources(
        (BASE_URI + name, Resource.from_contents(s)) for name, s in schemas.items()
    )
    return Draft202012Validator(schemas["events.schema.json"], registry=registry)


class Channel:
    def __init__(self, validator: Draft202012Validator) -> None:
        self.validator = validator
        self.clients: set[ServerConnection] = set()
        self.seq = 0
        self.prev = ZERO
        self.confirm = 0

    # ---- messages ---------------------------------------------------

    def audit(self, kind: str, **extra: Any) -> dict[str, Any]:
        """An audit line with a real hash chain (the signature is a dev placeholder)."""
        event: dict[str, Any] = {
            "seq": self.seq,
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "session": SESSION,
            "kind": kind,
            "app": "banca-alcor",
            "screen": "inicio",
            "model_saw": extra.pop("model_saw", None),
            "tokens": extra.pop("tokens", []),
            "approved_by": extra.pop("approved_by", None),
            "ms": {"core": 12, "adapter": 40, "model": None},
            "prev": self.prev,
            **extra,
        }
        canonical = json.dumps(event, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        event["hash"] = "sha256:" + hashlib.sha256((self.prev + canonical).encode()).hexdigest()
        event["sig"] = "ed25519:ZGV2"
        self.prev = event["hash"]
        self.seq += 1
        return {"type": "audit", "event": event}

    def voice(self, segments: list[dict[str, Any]]) -> dict[str, Any]:
        return {"type": "voice", "utterance": {"utterance": f"u{self.seq}", "session": SESSION, "segments": segments}}

    def confirm_request(self) -> dict[str, Any]:
        self.confirm += 1
        return {
            "type": "confirm_request", "id": f"c{self.confirm}", "session": SESSION, "kind": "transferir",
            "action": {"op": "tap", "target": "n14", "label": "Enviar"},
            "summary": [
                {"voice": "cloud", "text": "Voy a pasar"},
                {"voice": "local", "token": "‹IMPORTE_4›", "say_as": "currency"},
                {"voice": "cloud", "text": "a tu cuenta de"},
                {"voice": "local", "token": "‹PROVEEDOR_1·propio›", "say_as": "name"},
                {"voice": "cloud", "text": "¿Lo confirmas?"},
            ],
            "channels": ["voz", "pantalla"], "sca": "persona", "expires_s": 300,
        }

    def approval(self, ok: bool) -> dict[str, Any]:
        msg: dict[str, Any] = {"type": "approval_result", "id": f"c{max(self.confirm, 1)}", "ok": ok, "via": "voz", "by": "persona"}
        if not ok:
            msg["reason"] = "cancelado"
        return msg

    # ---- sending ----------------------------------------------------

    async def send(self, msg: dict[str, Any]) -> None:
        error = next(iter(self.validator.iter_errors(msg)), None)
        if error is not None:
            log(f"NOT SENT, invalid against events.schema.json: {error.message[:160]}")
            return
        label = msg["type"] + (f" {msg['event']['kind']}" if msg["type"] == "audit" else "")
        if msg["type"] == "audit" and msg["event"].get("reason"):
            label += f" {msg['event']['reason']}"
        log(f"-> {label}  [valid] to {len(self.clients)} client(s)")
        frame = json.dumps(msg, ensure_ascii=False)
        for ws in list(self.clients):
            try:
                await ws.send(frame)
            except ConnectionClosed:
                self.clients.discard(ws)

    # ---- scenes -----------------------------------------------------

    def scene(self, name: str) -> list[tuple[dict[str, Any] | None, float]]:
        A, V = self.audit, self.voice
        if name == "saldo":
            return [
                (A("task", detail="¿Cuánto tengo entre mis bancos?"), 2.0),
                (A("observe_sent", model_saw="Banca Alcor - Saldo ‹IMPORTE_1·positivo›", tokens=["‹IMPORTE_1·positivo›"], counts={"verde": 9, "ambar": 4, "rojo": 0}), 4.6),
                (A("act", model_saw="act open_app brezo"), 1.2),
                (A("observe_sent", model_saw="Brezo Banco - Saldo ‹IMPORTE_2·positivo›", tokens=["‹IMPORTE_2·positivo›"], counts={"verde": 7, "ambar": 3, "rojo": 0}), 4.6),
                (A("oracle", model_saw="oracle sum ‹IMPORTE_1› ‹IMPORTE_2› ‹IMPORTE_3›", tokens=["‹IMPORTE_1·positivo›", "‹IMPORTE_2·positivo›", "‹IMPORTE_3·positivo›"]), 1.8),
                (V([{"voice": "cloud", "text": "Entre tus tres cuentas tienes"}, {"voice": "local", "token": "‹SUMA_1›", "say_as": "currency"}]), 3.5),
            ]
        if name == "transferencia":
            return [
                (A("task", detail="Pasa 200 € al bróker"), 2.0),
                (A("act", model_saw="act tap n9 Transferir"), 1.5),
                (A("paused", detail="autenticacion"), 3.5),
                (A("observe_sent", model_saw="Transferencia - Importe ‹IMPORTE_4›", tokens=["‹IMPORTE_4›"], counts={"verde": 6, "ambar": 2, "rojo": 0}), 4.6),
                (A("held", model_saw="act tap n14 Enviar", confirm=f"c{self.confirm + 1}"), 0.3),
                (self.confirm_request(), 4.0),
                (self.approval(True), 0.2),
                (A("approval", confirm=f"c{self.confirm}", approved_by="persona"), 3.0),
            ]
        if name == "bloqueos":
            return [
                (A("blocked", reason="rojo", model_saw="act type n4 clave"), 3.0),
                (A("blocked", reason="destino", model_saw="act type e7 ‹IBAN_2·correo›", tokens=["‹IBAN_2·correo›"]), 3.2),
            ]
        raise KeyError(name)

    async def play(self, steps: list[tuple[dict[str, Any] | None, float]]) -> None:
        for msg, wait in steps:
            if msg is not None:
                await self.send(msg)
            await asyncio.sleep(wait)

    async def command(self, line: str) -> bool:
        parts = shlex.split(line)
        if not parts:
            return True
        cmd, args = parts[0], parts[1:]
        try:
            if cmd in ("quit", "exit"):
                return False
            if cmd == "wait":
                await asyncio.sleep(float(args[0]))
            elif cmd in ("saldo", "transferencia", "bloqueos"):
                await self.play(self.scene(cmd))
            elif cmd == "todo":
                for s in ("saldo", "transferencia", "bloqueos"):
                    await self.play(self.scene(s))
            elif cmd == "voz":
                await self.send(self.voice([{"voice": "cloud", "text": "Hecho."}]))
            elif cmd == "confirmar":
                await self.send(self.confirm_request())
            elif cmd in ("si", "no"):
                await self.send(self.approval(cmd == "si"))
            elif cmd == "blocked":
                await self.send(self.audit("blocked", reason=args[0] if args else "fuga"))
            else:
                await self.send(self.audit(cmd))
        except (KeyError, IndexError, ValueError) as e:
            log(f"error: {e!r}")
        return True

    # ---- connections ------------------------------------------------

    async def handler(self, ws: ServerConnection) -> None:
        if ws.request.path != "/events":
            await ws.close(1008, "path")
            return
        self.clients.add(ws)
        log(f"client connected ({len(self.clients)})")
        try:
            async for frame in ws:
                try:
                    msg = json.loads(frame)
                except json.JSONDecodeError:
                    log("<- not JSON")
                    continue
                ok = self.validator.is_valid(msg) and msg.get("type") == "approval_result"
                log(f"<- {msg.get('type') if isinstance(msg, dict) else '?'} [{'valid' if ok else 'INVALID: clients may only send approval_result'}]")
        except ConnectionClosed:
            pass
        finally:
            self.clients.discard(ws)
            log(f"client disconnected ({len(self.clients)})")


class Preview(http.server.SimpleHTTPRequestHandler):
    """/ocho/* from the app's assets; /ocho/ojos.html from docs/ (as the build does)."""

    def translate_path(self, path: str) -> str:
        path = path.split("?", 1)[0]
        if path == "/ocho/ojos.html":
            return str(OJOS)
        if path.startswith("/ocho/"):
            target = (ASSETS / urllib.parse.unquote(path.removeprefix("/ocho/"))).resolve()
            if target.is_relative_to(ASSETS.resolve()):
                return str(target)
        return str(ASSETS / "__none__")

    def log_message(self, *args: Any) -> None:
        pass


async def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--contracts", type=Path, default=ROOT / "docs/contracts")
    p.add_argument("--port", type=int, default=8700)
    p.add_argument("--http", type=int, default=8710, help="browser preview port (0 = off)")
    p.add_argument("--run", help='commands separated by ";", e.g. "wait 3; todo"')
    p.add_argument("--loop", action="store_true", help="repeat --run forever")
    args = p.parse_args()

    channel = Channel(load_validator(args.contracts))
    if args.http:
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", args.http), functools.partial(Preview))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        log(f"preview: http://127.0.0.1:{args.http}/ocho/app.html?debug")

    async with serve(channel.handler, "127.0.0.1", args.port):
        log(f"events: ws://127.0.0.1:{args.port}/events (dev, simulated data)")
        if args.run:
            while True:
                for line in args.run.split(";"):
                    if not await channel.command(line.strip()):
                        return
                if not args.loop:
                    break
        loop = asyncio.get_running_loop()
        while True:
            line = await loop.run_in_executor(None, sys.stdin.readline)
            if not line or not await channel.command(line.strip()):
                return


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
