"""Segmenter output validates against docs/contracts/voice.schema.json and, wrapped
for the phone, against the voice messages of bridge.schema.json (contracts v1.1)."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from voice.leak_check import PatternLeakCheck
from voice.segmenter import VaultRenderer, segment

HERE = Path(__file__).parent
CONTRACTS = HERE.parents[1] / "docs" / "contracts"


def load(name):
    return json.loads((CONTRACTS / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def validator():
    registry = Registry()
    for name in ("common.schema.json", "voice.schema.json"):
        schema = load(name)
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
    return Draft202012Validator(load("voice.schema.json"), registry=registry)


VAULT = {
    "‹SUMA_1›": "4.873,00 €",
    "‹IMPORTE_6›": "200 €",
    "‹PROVEEDOR_2›": "Nimbo Bróker",
    "‹PERSONA_1›": "Lucía Ferrer",
    "‹IBAN_1›": "ES91 2100 0418 4502 0005 1332",
    "‹TEL_1›": "612 345 678",
    "‹FACTURA_1›": "F-2026-0042",
}
CHECK = PatternLeakCheck(known_values=VAULT.values())


def seg(template):
    return segment(template, VaultRenderer(VAULT), utterance="u18", session="s2",
                   leak_check=CHECK)


def test_contract_examples(validator):
    assert validator.is_valid(load("examples/voice.suma.json"))
    assert not validator.is_valid(load("examples/invalid/voice.token-en-cloud.json"))


def test_sum_matches_the_contract_example(validator):
    out = seg("Entre tus tres cuentas tienes ‹SUMA_1›.").to_contract()
    assert out == load("examples/voice.suma.json")


@pytest.mark.parametrize("template", [
    "Entre tus tres cuentas tienes ‹SUMA_1›.",
    "Voy a pasar ‹IMPORTE_6› a tu cuenta de ‹PROVEEDOR_2-propio›. ¿Lo confirmas?",
    "Hola, ‹PERSONA_1-titular›",
    "Lo envío a ‹IBAN_1-maestro›",
    "Te llamo al ‹TEL_1-maestro› por la factura ‹FACTURA_1-correo›",
    "‹IMPORTE_6›",
    # blocked: the whole sentence is read locally, still schema-valid
    "Lucía Ferrer, tienes ‹SUMA_1›",
    "Paso 200 € a ‹PROVEEDOR_2›",
])
def test_segmenter_output_is_schema_valid(validator, template):
    out = seg(template).to_contract()
    errors = [e.message for e in validator.iter_errors(out)]
    assert errors == []


def test_contract_form_has_no_rendered_values():
    out = json.dumps(seg("Voy a pasar ‹IMPORTE_6› a ‹PROVEEDOR_2›").to_contract(),
                     ensure_ascii=False)
    for value in ("200", "doscientos", "Nimbo"):
        assert value not in out


@pytest.fixture(scope="module")
def bridge():
    registry = Registry()
    for path in CONTRACTS.glob("*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
    schema = load("bridge.schema.json")
    if "voice" not in schema.get("$defs", {}):
        pytest.skip("bridge.schema.json has no voice message (contracts v1)")
    return Draft202012Validator(schema, registry=registry)


def test_utterance_goes_over_the_bridge(bridge):
    """The core sends the utterance and the values of its local tokens to the phone."""
    utt = seg("Voy a pasar ‹IMPORTE_6› a tu cuenta de ‹PROVEEDOR_2›. ¿Lo confirmas?").to_contract()
    toks = [s["token"] for s in utt["segments"] if "token" in s]
    assert toks
    messages = [
        {"type": "render_values", "session": utt["session"], "values": {t: VAULT[t] for t in toks}},
        {"type": "voice", "utterance": utt},
        {"type": "voice.audio", "utterance": utt["utterance"], "index": 0, "format": "pcm_24000"},
        {"type": "voice.audio.end", "utterance": utt["utterance"], "index": 0},
        {"type": "voice.done", "utterance": utt["utterance"], "ok": True, "gap_ms": {"max": 180, "mean": 95}},
    ]
    for msg in messages:
        assert [e.message for e in bridge.iter_errors(msg)] == [], msg["type"]
