"""Modo replay (#14): las dos escenas de la demo con el núcleo real y el bucle del agente."""

import importlib

import anyio
import pytest


@pytest.fixture
def replay():
    from core import events
    events.clear()
    import core
    importlib.reload(core)
    from core import replay as r
    return importlib.reload(r)


def test_b2b_factura(replay):
    import core
    res = anyio.run(replay.run_scene, "b2b")
    assert res["status"] == "done" and res["leaks"] == 0
    assert res["held"] == 3 and res["approval"] == 3
    blocked = [e for e in core.AUDIT.events if e["session"] == "b2b" and e["kind"] == "blocked"]
    assert {e["reason"] for e in blocked} == {"destino"}
    scene_log = core.SESSIONS.get("b2b").adapter.log
    assert {"op": "call", "text": "912 345 678"} in scene_log
    assert all("ES42" not in str(a) for a in scene_log)  # el IBAN del correo nunca llega a la pantalla


def test_b2c_transferencia(replay):
    import core
    res = anyio.run(replay.run_scene, "b2c")
    assert res["status"] == "done" and res["leaks"] == 0
    assert res["held"] == 1 and res["approval"] == 1
    scene = core.SESSIONS.get("b2c").adapter
    assert scene.page == "resultado" and scene.form["importe"] == "200 €"
    assert any(e["kind"] == "observe_sent" for e in core.AUDIT.events if e["session"] == "b2c")
