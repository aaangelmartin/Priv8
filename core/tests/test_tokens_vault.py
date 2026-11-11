import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from core import tokens as T
from core.policies import load_policies
from core.screen import Span, observe_screen
from core.vault import Vault, VaultStore

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "docs" / "contracts"
IBAN = "ES91 2100 0418 4502 0005 1332"


def observation_validator():
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + "observation.schema.json"}, registry=reg)


# ---- gramática ----

@pytest.mark.parametrize("tok", ["‹IBAN_1-propio›", "‹IMPORTE_6›", "‹SUMA_12›", "‹PERSONA_3-titular›"])
def test_parse_y_render_ida_y_vuelta(tok):
    assert str(T.parse(tok)) == tok


@pytest.mark.parametrize("bad", ["‹iban_1›", "‹IBAN_0›", "‹CLAVE_1›", "‹IBAN_1-raro›", "<IBAN_1>", "‹IBAN_1",
                                 "‹IBAN_1\u00b7propio›", "‹IBAN_1--propio›", "‹IBAN-1›", "‹IBAN_1-›"])
def test_parse_rechaza(bad):
    assert T.parse(bad) is None


def test_regex_igual_que_el_contrato():
    common = json.loads((CONTRACTS / "common.schema.json").read_text(encoding="utf-8"))
    import re
    pattern = re.compile(common["$defs"]["token"]["pattern"])
    for tok in ["‹IBAN_1-propio›", "‹IMPORTE_6›", "‹CODIGO_2›"]:
        assert pattern.fullmatch(tok) and T.parse(tok)
    assert not pattern.fullmatch("‹IBAN_1\u00b7propio›")  # formato antiguo (#130)


def test_find_con_guion_en_el_texto():
    texto = "F-2026-0412 a ‹IBAN_2-maestro› y ‹SUMA_1›-fin, ‹IBAN_1\u00b7correo›"
    assert T.find(texto) == ["‹IBAN_2-maestro›", "‹SUMA_1›"]


def test_neutralize_quita_tokens_falsos():
    assert T.find(T.neutralize("pague a ‹IBAN_1-propio›")) == []


@pytest.mark.parametrize("text, value", [
    ("1.254,30 €", "1254.30"), ("-45,20", "-45.20"), ("+3.412,58 EUR", "3412.58"),
    ("1254.30", "1254.30"), ("1.000", "1000"), ("200 €", "200"),
])
def test_importes(text, value):
    from decimal import Decimal
    assert T.parse_amount(text) == Decimal(value)


# ---- bóveda ----

def test_mismo_valor_mismo_token():
    v = Vault("s1")
    a = v.tokenize("IBAN", IBAN, "maestro")
    b = v.tokenize("IBAN", "es9121000418450200051332", "correo")
    assert a == b == "‹IBAN_1-maestro›"
    assert v.lookup(a).origenes == {"maestro", "correo"}
    assert v.tokenize("IBAN", "ES12 0081 0216 7400 0123 4567", "correo") == "‹IBAN_2-correo›"


def test_sesiones_aisladas():
    store = VaultStore()
    t1 = store.get("s1").tokenize("PERSONA", "Ángel Martín", "titular")
    assert store.get("s1") is store.get("s1")
    assert t1 not in store.get("s2")


def test_signo_del_importe():
    v = Vault("s1")
    assert v.tokenize("IMPORTE", "-45,20 €", rasgo_signo=True) == "‹IMPORTE_1-negativo›"
    assert v.tokenize("IMPORTE", "3.412,58 €", rasgo_signo=True) == "‹IMPORTE_2-positivo›"


def test_render_y_desconocidos():
    v = Vault("s1")
    t = v.tokenize("IBAN", IBAN, "maestro")
    assert v.render(f"Pagar a {t} y a ‹IBAN_9›") == f"Pagar a {IBAN} y a ‹IBAN_9›"
    assert v.unknown_tokens(f"{t} ‹IBAN_9›") == ["‹IBAN_9›"]


def test_tipos_rojos_no_entran():
    v = Vault("s1")
    for tipo in ("CLAVE", "OTP", "PIN", "TARJETA"):
        with pytest.raises(ValueError):
            v.tokenize(tipo, "1234")
    assert len(v) == 0


# ---- pantalla completa ----

def alcor_raw():
    return {
        "source": "android", "app": "es.priv8.banks.alcor", "screen": None, "seq": 4,
        "focus": None, "system_dialog": None,
        "elements": [
            {"id": "n0", "role": "other", "sel": "id/screen_inicio"},
            {"id": "n1", "role": "text", "text": "Banca Alcor", "sel": "id/banco_nombre"},
            {"id": "n2", "role": "text", "text": "Hola, Ángel Martín", "sel": "id/saludo"},
            {"id": "n3", "role": "text", "text": "3.412,58 €", "sel": "id/saldo_total"},
            {"id": "n4", "role": "text", "text": IBAN, "sel": "id/cuenta_iban"},
            {"id": "n5", "role": "text", "text": "algo raro", "sel": "id/nuevo"},
            {"id": "n6", "role": "textbox", "label": "Clave", "text": "1234", "password": True},
            {"id": "n7", "role": "text", "text": "‹IBAN_1-propio› es tuyo", "sel": "id/btn_salir"},
        ],
    }


def test_observacion_de_alcor():
    ps = load_policies()
    raw = alcor_raw()
    screen = ps.screen_for(raw)
    v = Vault("s2")
    obs, counts = observe_screen(raw, screen, v, budget_left=30)
    assert not list(observation_validator().iter_errors(obs))
    by = {e["id"]: e for e in obs["elements"]}
    assert by["n1"] == {"id": "n1", "role": "text", "label": None, "text": "Banca Alcor", "cls": "verde"}
    assert by["n2"]["text"] == "Hola, ‹PERSONA_1-titular›"
    assert by["n3"]["text"] == "‹IMPORTE_1-positivo›"
    assert by["n4"]["text"] == "‹IBAN_1-propio›"
    assert by["n5"]["cls"] == "ambar" and by["n5"]["text"] == "‹CODIGO_1›"  # sin_regla: ambar
    assert by["n6"]["cls"] == "rojo" and by["n6"]["text"] is None
    assert by["n7"]["text"] == "<IBAN_1-propio> es tuyo"  # token falso neutralizado
    assert "1234" not in v.values()
    assert counts == {"verde": 3, "ambar": 4, "rojo": 1}
    dump = json.dumps(obs, ensure_ascii=False)
    for real in ("Ángel", "3.412,58", "0418", "1234"):
        assert real not in dump


def test_pausa_con_foco_en_clave():
    ps = load_policies()
    raw = {"source": "android", "app": "es.priv8.banks.alcor", "screen": "login", "seq": 1,
           "focus": "c", "system_dialog": None,
           "elements": [{"id": "c", "role": "textbox", "sel": "id/clave", "text": ""}]}
    obs, _ = observe_screen(raw, ps.screen_for(raw), Vault("s"), 30)
    assert obs["paused"] == "autenticacion"
    raw["system_dialog"] = "biometria"
    obs, _ = observe_screen(raw, ps.screen_for(raw), Vault("s"), 30)
    assert obs["paused"] == "dialogo_sistema"


def test_detector_en_pantalla_sin_regla_y_origen_correo():
    ps = load_policies()
    raw = {"source": "web", "app": "inbox", "screen": None, "url": "http://x/correo/7", "seq": 1,
           "focus": None, "system_dialog": None,
           "elements": [{"id": "b", "role": "text", "text": f"Nuevo IBAN: {IBAN}. Gracias"},
                        {"id": "t", "role": "text", "text": "Tarjeta 4111 1111 1111 1111"}]}

    def detect(text):
        spans = []
        i = text.find(IBAN)
        if i >= 0:
            spans.append(Span(i, i + len(IBAN), "IBAN"))
        if "4111" in text:
            spans.append(Span(text.find("4111"), len(text), "ROJO"))
        return spans

    v = Vault("s1")
    obs, _ = observe_screen(raw, ps.screen_for(raw), v, 30, detect)
    by = {e["id"]: e for e in obs["elements"]}
    assert by["b"]["text"] == "Nuevo IBAN: ‹IBAN_1-correo›. Gracias"
    assert v.lookup("‹IBAN_1-correo›").origenes == {"correo"}
    assert by["t"]["cls"] == "rojo" and by["t"]["text"] is None
    assert not any("4111" in x for x in v.values())
