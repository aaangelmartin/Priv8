"""WebSocket de eventos del núcleo: ws://127.0.0.1:8700/events (events.schema.json).

Reenvía a cada cliente (consola de auditoría, app 8) lo que publica
core.events: audit, screen, voice, confirm_request y approval_result. Lo único
que acepta de los clientes es approval_result, que pasa a core.approve.

Solo escucha en 127.0.0.1: el mensaje screen lleva la pantalla real.

En el proceso del agente:   core.server.start()          (hilo en segundo plano)
Suelto, para probar:        python -m core.server
"""

from __future__ import annotations

import asyncio
import json
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
            if data.get("type") == "approval_result":
                await asyncio.to_thread(core.approve, data)
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
