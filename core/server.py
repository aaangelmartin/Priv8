"""WebSocket de eventos del núcleo: ws://127.0.0.1:8700/events (events.schema.json).

Reenvía a cada cliente (consola de auditoría, app 8) lo que publica
core.events: audit, screen, voice, confirm_request, approval_result y dictation.
De los clientes acepta:

    approval_result    pasa a core.approve
    task_request       la tarea de la persona (dictada en el móvil): core.submit_task
    dictation_start    graba el micro del portátil y lo transcribe con Whisper en
                       local (voice/dictado.py); devuelve dictation y encola la tarea

Solo escucha en 127.0.0.1: el mensaje screen lleva la pantalla real.

En el proceso del agente:   core.server.start()          (hilo en segundo plano)
Suelto, para probar:        python -m core.server
"""

from __future__ import annotations

import asyncio
import json
import re
import threading

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

import core
from core import events

HOST, PORT = "127.0.0.1", 8700


# Navegadores que pueden abrir el canal. Un cliente nativo (app 8, agente) no manda Origin.
# Sin esto, cualquier web abierta en el mismo ordenador podría leer las pantallas reales
# y mandar approval_result (cross-site WebSocket hijacking).
ALLOWED_ORIGINS = {"http://127.0.0.1:5175", "http://localhost:5175",
                   "http://127.0.0.1:8710"}  # consola y vista previa de la app 8 en navegador


SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")  # common.schema.json#/$defs/session


def _session(data: dict) -> str | None:
    s = data.get("session")
    return s if isinstance(s, str) and SESSION_RE.match(s) else None


def _dictate(session: str) -> None:
    """dictation_start, en su propio hilo: grabar y transcribir tarda segundos."""
    from voice import dictado
    dictado.dictate(session)


def handle_client(data: dict) -> None:
    """Un mensaje de un cliente (se llama fuera del bucle de eventos)."""
    kind = data.get("type")
    if kind == "approval_result":
        core.approve(data)
    elif kind == "task_request":
        session, text = _session(data), data.get("text")
        if session and isinstance(text, str):
            core.submit_task(session, text, via="app")
    elif kind == "dictation_start":
        session = _session(data)
        if session:
            threading.Thread(target=_dictate, args=(session,), name="priv8-dictado", daemon=True).start()


async def events_ws(ws: WebSocket) -> None:
    origin = ws.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        await ws.close(code=1008)
        return
    await ws.accept()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    unsubscribe = events.subscribe(lambda msg: loop.call_soon_threadsafe(queue.put_nowait, msg))

    async def pump() -> None:
        while True:
            msg = await queue.get()
            await ws.send_text(json.dumps(msg, ensure_ascii=False))

    for req in core.pending():  # confirmaciones que ya esperaban antes de conectarse
        queue.put_nowait(req)
    sender = asyncio.create_task(pump())
    try:
        while True:
            data = json.loads(await ws.receive_text())
            if isinstance(data, dict):
                await asyncio.to_thread(handle_client, data)
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        unsubscribe()
        sender.cancel()


def _verify_log() -> dict:
    from cryptography.hazmat.primitives import serialization

    from core.audit import verify

    path = core.AUDIT.path
    if path is None:
        return {"ok": False, "lines": 0, "error": "auditoría solo en memoria (PRIV8_AUDIT=off): no hay registro en disco"}
    if not path.exists():
        return {"ok": True, "lines": 0, "error": None}
    lines = path.read_text(encoding="utf-8").splitlines()
    pub_path = path.with_name("priv8.pub")
    pub = serialization.load_pem_public_key(pub_path.read_bytes()) if pub_path.exists() else core.AUDIT.public_key
    errors = verify(lines, pub)
    return {"ok": not errors, "lines": sum(1 for x in lines if x.strip()),
            "error": "; ".join(errors[:5]) if errors else None}


async def verify_route(_: Request) -> JSONResponse:
    return JSONResponse(await asyncio.to_thread(_verify_log))


app = Starlette(
    routes=[WebSocketRoute("/events", events_ws), Route("/verify", verify_route)],
    middleware=[Middleware(CORSMiddleware, allow_origins=sorted(ALLOWED_ORIGINS),
                           allow_methods=["GET"])],
)


def start(host: str = HOST, port: int = PORT) -> threading.Thread:
    import uvicorn

    server = uvicorn.Server(uvicorn.Config(app, host=host, port=port, log_level="warning"))
    t = threading.Thread(target=server.run, name="priv8-events", daemon=True)
    t.start()
    return t


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
