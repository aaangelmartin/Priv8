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
from starlette.routing import WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

import core
from core import events

HOST, PORT = "127.0.0.1", 8700


async def events_ws(ws: WebSocket) -> None:
    await ws.accept()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    unsubscribe = events.subscribe(lambda msg: loop.call_soon_threadsafe(queue.put_nowait, msg))

    async def pump() -> None:
        while True:
            msg = await queue.get()
            await ws.send_text(json.dumps(msg, ensure_ascii=False))

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


app = Starlette(routes=[WebSocketRoute("/events", events_ws)])


def start(host: str = HOST, port: int = PORT) -> threading.Thread:
    import uvicorn

    server = uvicorn.Server(uvicorn.Config(app, host=host, port=port, log_level="warning"))
    t = threading.Thread(target=server.run, name="priv8-events", daemon=True)
    t.start()
    return t


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
