"""El panel de la demo (scripts/panel.py): búsqueda y validación de los casos y el task_request (#187)."""

import importlib.util
import json
import threading
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location("panel", Path(__file__).resolve().parents[1] / "panel.py")
panel = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(panel)


def test_todos_los_pedidos_del_catalogo_se_encuentran():
    for c in panel.casos():
        encontrado = panel.busca_caso(c["id"])
        if c.get("pedido") is None:
            assert encontrado is None
        else:
            assert encontrado == c
            assert c["vertical"] in ("b2b", "b2c")


@pytest.mark.parametrize("cid", ["b2b-sin-protocolo", "no-existe", None, 3, ["b2b-factura"]])
def test_lo_que_no_es_un_pedido_no_se_encuentra(cid):
    assert panel.busca_caso(cid) is None


def test_valida_el_modo_y_el_agente():
    caso, motivo = panel.valida_caso("b2b-factura", "b2b", True)
    assert caso["pedido"] == "Registra la factura de Suministros Lumen" and motivo == ""
    caso, motivo = panel.valida_caso("b2b-factura", "b2c", True)
    assert caso is None and "prepara B2B" in motivo
    caso, motivo = panel.valida_caso("b2c-saldo", None, True)
    assert caso is None and "prepara B2C" in motivo
    caso, motivo = panel.valida_caso("b2c-saldo", "b2c", False)
    assert caso is None and "8700" in motivo
    caso, motivo = panel.valida_caso("b2b-sin-protocolo", "b2b", True)
    assert caso is None and motivo


def test_mensaje_es_un_task_request_de_la_sesion_del_caso():
    msg = panel.mensaje_caso(panel.busca_caso("b2c-broker"))
    assert msg == {"type": "task_request", "session": "b2c", "text": "Pasa 200 € al bróker"}


def test_envia_el_task_request_sin_origin():
    from websockets.sync.server import serve

    recibido = {}

    def handler(ws):
        recibido["origin"] = ws.request.headers.get("Origin")
        recibido["path"] = ws.request.path
        recibido["msg"] = json.loads(ws.recv())

    with serve(handler, "127.0.0.1", 0) as server:
        port = server.socket.getsockname()[1]
        threading.Thread(target=server.serve_forever, daemon=True).start()
        panel.envia_tarea(panel.mensaje_caso(panel.busca_caso("b2b-iban")), port=port)
        server.shutdown()
    assert recibido["origin"] is None
    assert recibido["path"] == "/events"
    assert recibido["msg"] == {"type": "task_request", "session": "b2b",
                               "text": panel.busca_caso("b2b-iban")["pedido"]}
