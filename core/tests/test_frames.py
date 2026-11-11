"""Pantalla real en la consola (#147): el mensaje frame, su canal y que nunca llega al registro."""

import importlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"
IMG = "aW1hZ2VuIHJlYWwgY29uIDIwMCwwMCDigqw="  # base64 de «imagen real con 200,00 €»


def validator():
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + "events.schema.json"}, registry=reg)


class Phone:
    """Adaptador que sabe capturar (tiene on_frame), con la pantalla de revisión de Banca Alcor."""

    def __init__(self):
        self.on_frame = None
        self.watching = lambda: 0
        self.screen = None

    def snapshot(self):
        return {"source": "android", "app": "es.priv8.banks.alcor", "screen": self.screen, "seq": 1,
                "focus": None, "system_dialog": None, "elements": [
                    {"id": "r0", "role": "other", "sel": "id/screen_revision", "bounds": [0, 0, 1080, 2400]},
                    {"id": "r1", "role": "text", "text": "200,00 €", "sel": "id/rev_importe", "bounds": [40, 300, 600, 360]},
                    {"id": "r4", "role": "button", "label": "Enviar", "sel": "id/btn_enviar", "bounds": [40, 2000, 1040, 2120]}]}

    def perform(self, a):
        return {"ok": True}

    def boxes(self):
        return {e["id"]: e["bounds"] for e in self.snapshot()["elements"]}


@pytest.fixture
def core():
    from core import events
    events.clear()
    import core as c
    return importlib.reload(c)


def _frame(phone, **over):
    f = {"app": "es.priv8.banks.alcor", "w": 1080, "h": 2400, "img": IMG, "mime": "image/jpeg",
         "boxes": phone.boxes(), "where": {"app": "es.priv8.banks.alcor", "screen": None}}
    f.update(over)
    return f


def test_connect_da_al_adaptador_donde_mandar_fotogramas(core):
    phone = Phone()
    core.connect("s1", phone)
    assert callable(phone.on_frame)
    assert phone.watching() == 0
    seen = []
    unsub = core.events.subscribe_frames(seen.append)
    assert phone.watching() == 1
    core.observe("s1")
    phone.on_frame(_frame(phone))
    unsub()
    assert phone.watching() == 0
    assert [m["session"] for m in seen] == ["s1"]


def test_frame_sigue_el_contrato_y_lleva_las_cajas_de_la_observacion(core):
    phone = Phone()
    core.connect("s1", phone)
    obs = core.observe("s1")
    msg = core.frame("s1", _frame(phone))
    assert not list(validator().iter_errors(msg))
    assert msg["fresh"] is True and msg["screen"] == obs["screen"]
    by_id = {r["id"]: r for r in msg["rects"]}
    cls = {e["id"]: e["cls"] for e in obs["elements"]}
    assert set(by_id) == {e["id"] for e in obs["elements"]}
    for rid, r in by_id.items():
        assert r["cls"] == cls[rid]
    importe = by_id["r1"]
    assert (importe["x"], importe["y"], importe["w"], importe["h"]) == (40, 300, 560, 60)
    assert importe["cls"] == "ambar" and importe["token"].startswith("‹IMPORTE_")
    # Lo que va en el texto de cada caja es lo que leyó el modelo: nunca el valor real.
    assert all("200,00" not in (r.get("text") or "") for r in msg["rects"])


def test_otra_pantalla_no_lleva_cajas(core):
    phone = Phone()
    core.connect("s1", phone)
    core.observe("s1")
    msg = core.frame("s1", _frame(phone, where={"app": "es.priv8.banks.alcor", "screen": "otra"}))
    assert msg["fresh"] is False and msg["rects"] == [] and msg["screen"] is None
    assert not list(validator().iter_errors(msg))
    msg = core.frame("s2", _frame(phone))  # sesión que aún no ha observado nada
    assert msg["fresh"] is False and msg["rects"] == []


def test_los_fotogramas_nunca_llegan_al_registro_ni_al_canal_normal(core, monkeypatch):
    phone = Phone()
    core.connect("s1", phone)
    core.observe("s1")
    recorded, published = [], []
    real_record = core.AUDIT.record
    monkeypatch.setattr(core.AUDIT, "record", lambda ev: recorded.append(ev) or real_record(ev))
    unsub = core.events.subscribe(published.append)  # lo que oyen el puente y la app 8
    for _ in range(5):
        core.frame("s1", _frame(phone))
    unsub()
    assert recorded == []
    assert published == []


def test_el_websocket_solo_manda_fotogramas_a_quien_los_pide(core):
    from starlette.testclient import TestClient

    from core import server
    server = importlib.reload(server)
    phone = Phone()
    core.connect("s1", phone)
    core.observe("s1")
    client = TestClient(server.app)
    with client.websocket_connect("/events") as plain:
        assert core.events.frame_watchers() == 0
        with client.websocket_connect("/events?frames=1") as ws:
            assert core.events.frame_watchers() == 1
            core.frame("s1", _frame(phone))
            m = json.loads(ws.receive_text())
            assert m["type"] == "frame" and m["img"] == IMG
        core.say("s1", "Hecho.")  # el cliente normal sigue recibiendo lo suyo, sin fotogramas
        assert json.loads(plain.receive_text())["type"] == "voice"
    assert core.events.frame_watchers() == 0


def test_quien_llega_tarde_recibe_el_ultimo_fotograma(core):
    phone = Phone()
    core.connect("s1", phone)
    core.observe("s1")
    for i in range(3):
        core.frame("s1", _frame(phone, w=1000 + i))
    seen = []
    core.events.subscribe_frames(seen.append)()
    assert [m["w"] for m in seen] == [1002]
