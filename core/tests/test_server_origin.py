"""El canal de eventos solo acepta a la consola o a clientes sin Origin."""

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from core.server import app


def test_consola_y_cliente_nativo_entran():
    c = TestClient(app)
    with c.websocket_connect("/events", headers={"origin": "http://127.0.0.1:5175"}):
        pass
    with c.websocket_connect("/events"):
        pass


def test_otra_web_no_entra():
    c = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with c.websocket_connect("/events", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_text()
