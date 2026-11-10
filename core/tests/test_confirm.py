"""Confirmación humana: transferir, enviar y firmar quedan retenidos hasta la persona."""

import importlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"


def validator(ref):
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + ref}, registry=reg)


def revision():
    return {"source": "android", "app": "es.priv8.banks.alcor", "screen": None, "seq": 9,
            "focus": None, "system_dialog": None, "elements": [
                {"id": "r0", "role": "other", "sel": "id/screen_revision"},
                {"id": "r1", "role": "text", "text": "200,00 €", "sel": "id/rev_importe"},
                {"id": "r2", "role": "text", "text": "Lucía Ferrer · Nimbo Bróker", "sel": "id/rev_beneficiario"},
                {"id": "r3", "role": "text", "text": "ES08 9300 0001 0522 0033 4455", "sel": "id/rev_iban_destino"},
                {"id": "r4", "role": "button", "label": "Enviar", "sel": "id/btn_enviar", "actions": ["tap"]}]}


class Phone:
    def __init__(self):
        self.performed = []

    def snapshot(self):
        return revision()

    def perform(self, a):
        self.performed.append(a)
        return {"ok": True}


class Clock:
    t = 1000.0

    def __call__(self):
        return self.t


@pytest.fixture
def env():
    from core import events
    events.clear()
    import core as c
    c = importlib.reload(c)
    clock = Clock()
    c.CONFIRM.clock = clock
    seen = []
    events.subscribe(seen.append)
    phone = Phone()
    c.connect("s2", phone)
    c.observe("s2")
    return c, phone, clock, seen


def requests(seen):
    return [m for m in seen if m.get("type") == "confirm_request"]


def test_transferir_queda_retenida_y_pide_confirmacion(env):
    c, phone, _, seen = env
    r = c.act("s2", "tap", "r4")
    assert r == {"held": {"confirm": "c1"}}
    assert phone.performed == []
    req = requests(seen)[-1]
    assert not list(validator("confirm.schema.json").iter_errors(req))
    assert req["kind"] == "transferir" and req["sca"] == "persona" and req["expires_s"] == 300
    locals_ = [s["token"] for s in req["summary"] if s["voice"] == "local"]
    assert [t.split("_")[0] for t in locals_] == ["‹IMPORTE", "‹PERSONA", "‹IBAN"]
    clouds = " ".join(s["text"] for s in req["summary"] if s["voice"] == "cloud")
    assert c.check(clouds)["allowed"]  # lo que va a ElevenLabs no lleva datos
    vals = c.render_values("s2", locals_)
    assert vals[locals_[0]] == "200,00 €"
    assert c.AUDIT.events[-1]["kind"] == "held"


def test_repetir_la_accion_no_duplica_la_peticion(env):
    c, _, _, seen = env
    c.act("s2", "tap", "r4")
    assert c.act("s2", "tap", "r4") == {"held": {"confirm": "c1"}}
    assert len(requests(seen)) == 1


def test_aprobada_por_voz_se_ejecuta(env):
    c, phone, clock, seen = env
    c.act("s2", "tap", "r4")
    clock.t += 30
    r = c.approve({"type": "approval_result", "id": "c1", "ok": True, "via": "voz", "by": "persona"})
    assert r == {"ok": True}
    assert phone.performed == [{"op": "tap", "target": "r4"}]
    kinds = [e["kind"] for e in c.AUDIT.events[-2:]]
    assert kinds == ["approval", "act"] and c.AUDIT.events[-2]["approved_by"] == "persona"
    for e in c.AUDIT.events:
        assert not list(validator("audit.schema.json").iter_errors(e))
    assert c.pending("s2") == []


def test_cancelada(env):
    c, phone, _, seen = env
    c.act("s2", "tap", "r4")
    r = c.approve({"type": "approval_result", "id": "c1", "ok": False, "via": "voz", "by": "persona",
                   "reason": "cancelado"})
    assert r["denied"] == "cancelado" and phone.performed == []
    res = [m for m in seen if m.get("type") == "approval_result"][-1]
    assert res["reason"] == "cancelado"
    assert not list(validator("confirm.schema.json").iter_errors(res))


def test_caduca_a_los_5_minutos(env):
    c, phone, clock, seen = env
    c.act("s2", "tap", "r4")
    clock.t += 301
    r = c.approve({"type": "approval_result", "id": "c1", "ok": True, "via": "voz", "by": "persona"})
    assert r["denied"] == "caducado" and phone.performed == []


def test_expire_due_publica_caducado(env):
    c, _, clock, seen = env
    c.act("s2", "tap", "r4")
    clock.t += 299
    assert c.expire_due() == []
    clock.t += 2
    assert c.expire_due() == ["c1"]
    res = [m for m in seen if m.get("type") == "approval_result"][-1]
    assert res == {"type": "approval_result", "id": "c1", "ok": False, "via": "sistema",
                   "by": "sistema", "reason": "caducado"}


def test_solo_la_persona_aprueba_y_una_vez(env):
    c, phone, _, _ = env
    c.act("s2", "tap", "r4")
    assert c.approve({"type": "approval_result", "id": "c1", "ok": True, "via": "voz",
                      "by": "sistema"})["denied"] == "cancelado"
    assert c.approve({"type": "approval_result", "id": "c1", "ok": True, "via": "voz",
                      "by": "persona"})["denied"] == "cancelado"
    assert c.approve({"type": "approval_result", "id": "c99", "ok": True, "via": "voz",
                      "by": "persona"})["denied"] == "cancelado"
    assert phone.performed == []


def test_lo_no_critico_no_se_retiene(env):
    c, phone, _, _ = env
    assert c.act("s2", "key", text="back") == {"ok": True}
