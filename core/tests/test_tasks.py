"""Tareas que llegan mientras el agente corre (#47): task_request, dictation_start y next_task."""

import importlib
import json
import threading
import time
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from starlette.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "docs" / "contracts"


def validator(ref):
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json"))
    return Draft202012Validator({"$ref": base + ref}, registry=reg)


@pytest.fixture
def core():
    import core as c
    return importlib.reload(c)


def test_next_task_devuelve_el_texto_real(core):
    assert core.submit_task("b2c", "  Pasa 200 € al   bróker ") == {"ok": True}
    assert core.next_task("b2c", timeout=1) == "Pasa 200 € al bróker"
    assert core.next_task("b2c", timeout=0.05) is None


def test_las_sesiones_no_se_mezclan(core):
    core.submit_task("s1", "registrar factura")
    assert core.next_task("b2c", timeout=0.05) is None
    assert core.next_task("s1", timeout=0.05) == "registrar factura"


def test_next_task_bloquea_hasta_que_llega(core):
    got = []
    t = threading.Thread(target=lambda: got.append(core.next_task("b2c")))
    t.start()
    time.sleep(0.05)
    assert not got
    core.submit_task("b2c", "¿cuánto tengo entre mis bancos?", via="dictado")
    t.join(2)
    assert got == ["¿cuánto tengo entre mis bancos?"]


def test_la_auditoria_no_guarda_el_texto(core):
    core.submit_task("b2c", "Pasa 200 € al bróker")
    ev = core.AUDIT.events[-1]
    assert ev["kind"] == "task" and ev["model_saw"] is None
    assert "200" not in json.dumps(ev, ensure_ascii=False) and "bróker" not in json.dumps(ev, ensure_ascii=False)
    assert any(t.startswith("‹IMPORTE_") for t in ev["tokens"])
    assert ev["detail"] == "tarea recibida · app · 20 caracteres"
    assert validator("audit.schema.json").is_valid(ev)


def test_tarea_vacia_no_entra(core):
    assert core.submit_task("b2c", "   ")["ok"] is False
    assert core.next_task("b2c", timeout=0.05) is None


def test_task_request_por_el_websocket(core):
    from core.server import app
    with TestClient(app).websocket_connect("/events") as ws:
        ws.send_text(json.dumps({"type": "task_request", "session": "b2c", "text": "¿cuánto tengo?"}))
        ws.send_text(json.dumps({"type": "task_request", "session": "no vale", "text": "x"}))
        ws.send_text("[]")
        assert core.next_task("b2c", timeout=2) == "¿cuánto tengo?"
    assert core.next_task("b2c", timeout=0.05) is None


def test_dictation_start_devuelve_dictation(core, monkeypatch):
    from core import server
    from voice import dictado

    def fake(session):
        dictado.dictate(session, record=lambda: [0.0], recognize=lambda _: "¿cuánto tengo entre mis bancos?",
                        check=lambda: None)
    monkeypatch.setattr(server, "_dictate", fake)
    with TestClient(server.app).websocket_connect("/events") as ws:
        ws.send_text(json.dumps({"type": "dictation_start", "session": "b2c"}))
        msgs = []
        while not any(m["type"] == "dictation" for m in msgs):
            msgs.append(json.loads(ws.receive_text()))
    dictation = next(m for m in msgs if m["type"] == "dictation")
    assert dictation == {"type": "dictation", "session": "b2c", "text": "¿Cuánto tengo entre mis bancos?"}
    assert validator("events.schema.json").is_valid(dictation)
    assert core.next_task("b2c", timeout=2) == "¿Cuánto tengo entre mis bancos?"
