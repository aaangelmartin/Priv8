"""La fachada del núcleo de punta a punta, con un adaptador falso y el contrato."""

import importlib
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "docs" / "contracts"
IBAN_MAESTRO = "ES91 2100 0418 4502 0005 1332"


def validator(ref):
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + ref}, registry=reg)


class FakeWeb:
    def __init__(self):
        self.performed = []
        self.raw = json.loads((CONTRACTS / "examples" / "snapshot.web-factura.json").read_text(encoding="utf-8"))
        self.raw["elements"].append({"id": "e8", "role": "textbox", "label": "Clave", "password": True,
                                     "text": "secreto", "actions": ["type"]})

    def snapshot(self):
        return json.loads(json.dumps(self.raw))

    def perform(self, action):
        self.performed.append(action)
        return {"ok": True}


@pytest.fixture
def core():
    import core as c
    return importlib.reload(c)


def test_las_cinco_funciones_para_el_agente(core):
    from agent.core_adapter import build_real_core
    built = build_real_core()
    assert built.leak.check("‹IBAN_1›").ok


def test_observe_tokeniza_y_registra(core):
    web = FakeWeb()
    core.connect("s1", web)
    obs = core.observe("s1")
    assert not list(validator("observation.schema.json").iter_errors(obs))
    dump = json.dumps(obs, ensure_ascii=False)
    assert "0418" not in dump and "Lumen" not in dump and "secreto" not in dump
    ev = core.AUDIT.events[-1]
    assert ev["kind"] == "observe_sent" and ev["counts"]["ambar"] >= 3
    for e in core.AUDIT.events:
        assert not list(validator("audit.schema.json").iter_errors(e))


def test_act_rehidrata_en_local(core):
    web = FakeWeb()
    core.connect("s1", web)
    obs = core.observe("s1")
    iban_tok = next(e["text"] for e in obs["elements"] if e["id"] == "e7")
    assert core.act("s1", "type", "e7", iban_tok) == {"ok": True}
    assert web.performed[-1] == {"op": "type", "target": "e7", "text": IBAN_MAESTRO}
    assert core.AUDIT.events[-1]["kind"] == "act"
    assert IBAN_MAESTRO not in json.dumps(core.AUDIT.events, ensure_ascii=False)


@pytest.mark.parametrize("args, reason", [
    (("type", "e7", "‹IBAN_9·correo›"), "token_desconocido"),
    (("type", "e8", "hola"), "rojo"),
    (("tap", "zz"), "sin_regla"),
    (("type", "e7"), "sin_regla"),
    (("borrar", "e7"), "sin_regla"),
])
def test_act_rechaza(core, args, reason):
    web = FakeWeb()
    core.connect("s1", web)
    core.observe("s1")
    r = core.act("s1", *args)
    assert r["denied"] == reason
    assert web.performed == []
    assert core.AUDIT.events[-1]["kind"] == "blocked"
    assert not list(validator("audit.schema.json").iter_errors(core.AUDIT.events[-1]))


def test_act_sin_observar(core):
    core.connect("s2", FakeWeb())
    assert core.act("s2", "tap", "e9")["denied"] == "sin_regla"


def test_pantalla_sin_politica_no_sale(core):
    web = FakeWeb()
    web.raw["url"] = "http://127.0.0.1:5173/otra"
    core.connect("s1", web)
    assert core.observe("s1")["denied"] == "sin_regla"


def test_orden_de_voz_se_tokeniza(core):
    core.connect("s3", FakeWeb())
    t = core.tokenize_text("s3", "Pasa 200 € al bróker")
    assert "200" not in t
    assert t.startswith("Pasa ‹IMPORTE_1·positivo› al")
    assert core.SESSIONS.get("s3").vault.lookup("‹IMPORTE_1·positivo›").origenes == {"titular"}
    assert core.check(t)["allowed"]


class Fijo:
    def __init__(self, raw):
        self.raw, self.performed = raw, []

    def snapshot(self):
        return json.loads(json.dumps(self.raw))

    def perform(self, a):
        self.performed.append(a)
        return {"ok": True}


@pytest.mark.parametrize("raw, reason", [
    ({"source": "android", "app": "es.priv8.ocho", "screen": "confirmacion", "seq": 3, "elements": []},
     "confirmacion"),
    ({"source": "android", "app": "com.android.permissioncontroller", "screen": None, "seq": 4,
      "system_dialog": "permiso", "elements": []}, "dialogo_sistema"),
    ({"source": "android", "app": "desconocida", "screen": None, "seq": 5, "system_dialog": "oculta",
      "elements": []}, "dialogo_sistema"),
    ({"source": "android", "app": "es.priv8.banks.alcor", "screen": None, "seq": 6, "focus": "n1",
      "elements": [{"id": "n1", "role": "textbox", "password": True, "text": None}]}, "autenticacion"),
])
def test_pausa_antes_que_la_politica(core, raw, reason):
    """Ventanas sin política (diálogos, la confirmación de 8) dan pausa, no sin_regla (#78)."""
    core.connect("p", Fijo(raw))
    obs = core.observe("p")
    assert obs["paused"] == reason and obs["elements"] == []
    assert not list(validator("observation.schema.json").iter_errors(obs))
    assert core.AUDIT.events[-1]["kind"] == "paused"
    assert core.act("p", "key", text="back")["denied"] == "rojo"


def test_fallo_del_adaptador(core):
    web = FakeWeb()
    web.perform = lambda a: {"ok": False, "error": "target_no_encontrado"}
    core.connect("s1", web)
    core.observe("s1")
    assert core.act("s1", "tap", "e9")["denied"] == "adaptador"


def test_el_audit_encadena(core):
    a = core.record({"session": "s", "kind": "task"})
    b = core.record({"session": "s", "kind": "task"})
    assert b["prev"] == a["hash"] and b["seq"] == a["seq"] + 1
