import json

import pytest

from voice.leak_check import PatternLeakCheck
from voice.segmenter import Segment, VaultRenderer, segment
from voice.tokens import TOKEN_RE

# Invented values, as in data/seed.json
VAULT = {
    "‹SUMA_1›": "4.873,00 €",
    "‹IMPORTE_6›": "200 €",
    "‹PROVEEDOR_2›": "Nimbo Bróker",
    "‹PERSONA_1›": "Lucía Ferrer",
    "‹IBAN_1›": "ES91 2100 0418 4502 0005 1332",
}
render = VaultRenderer(VAULT)
check = PatternLeakCheck(known_values=VAULT.values())


def seg(template, **kw):
    kw.setdefault("leak_check", check)
    return segment(template, render, utterance="u18", session="s2", **kw)


def test_sum_example_from_the_contract():
    u = seg("Entre tus tres cuentas tienes ‹SUMA_1›.")
    assert u.to_contract() == {
        "utterance": "u18",
        "session": "s2",
        "segments": [
            {"voice": "cloud", "text": "Entre tus tres cuentas tienes"},
            {"voice": "local", "token": "‹SUMA_1›", "say_as": "currency"},
        ],
    }
    assert not u.blocked
    assert u.segments[1].spoken == "cuatro mil ochocientos setenta y tres euros"
    assert [s.speech for s in u.segments] == [
        "Entre tus tres cuentas tienes", "cuatro mil ochocientos setenta y tres euros"]


def test_confirmation_example_keeps_order():
    u = seg("Voy a pasar ‹IMPORTE_6› a tu cuenta de ‹PROVEEDOR_2-propio›. ¿Lo confirmas?")
    assert [(s.voice, s.token) for s in u.segments] == [
        ("cloud", None),
        ("local", "‹IMPORTE_6›"),
        ("cloud", None),
        ("local", "‹PROVEEDOR_2-propio›"),
        ("cloud", None),
    ]
    assert u.cloud_texts == ["Voy a pasar", "a tu cuenta de", "¿Lo confirmas?"]
    assert u.segments[1].spoken == "doscientos euros"
    assert u.segments[3].say_as == "name"
    assert u.segments[3].spoken == "Nimbo Bróker"


def test_token_label_is_optional_for_lookup():
    u = seg("Hola, ‹PERSONA_1-titular›")
    assert u.segments[1].spoken == "Lucía Ferrer"


def test_punctuation_between_tokens_is_not_a_segment():
    u = seg("‹IMPORTE_6›, ‹PROVEEDOR_2›")
    assert [s.voice for s in u.segments] == ["local", "local"]


def test_unknown_token_is_never_guessed():
    with pytest.raises(KeyError):
        seg("Tienes ‹SUMA_9›")


def test_iban_is_spelled_out_locally():
    u = seg("Lo envío a ‹IBAN_1-maestro›")
    assert u.segments[1].say_as == "iban"
    assert u.segments[1].spoken.startswith("E S nueve uno, dos uno cero cero")


def test_leak_keeps_the_whole_sentence_local_and_audits_it():
    events = []
    u = seg("Lucía Ferrer, entre tus cuentas tienes ‹SUMA_1›. ¿Algo más?", audit=events.append)
    assert u.blocked
    assert u.cloud_texts == []
    assert all(s.voice == "local" for s in u.segments)
    assert u.to_contract()["segments"] == [
        {"voice": "local", "text": "Lucía Ferrer, entre tus cuentas tienes"},
        {"voice": "local", "token": "‹SUMA_1›", "say_as": "currency"},
        {"voice": "local", "text": "¿Algo más?"},
    ]
    assert events == [{
        "kind": "blocked", "reason": "fuga", "session": "s2", "utterance": "u18",
        "target": "elevenlabs", "findings": ["vault"],
    }]


def test_raw_figure_written_by_the_model_never_goes_cloud():
    events = []
    u = seg("Vas a enviar 200 € a ‹PROVEEDOR_2›", audit=events.append)
    assert u.cloud_texts == []
    assert u.blocked
    assert "amount" in events[0]["findings"]


def test_default_leak_check_is_used_when_none_given():
    u = segment("Tu IBAN es ES91 2100 0418 4502 0005 1332", render,
                utterance="u1", session="s1")
    assert u.blocked
    assert u.segments[0].voice == "local"


def test_audit_event_has_no_real_values():
    events = []
    seg("Lucía Ferrer, pasa 200 € a ‹PROVEEDOR_2›", audit=events.append)
    dumped = json.dumps(events, ensure_ascii=False)
    for value in [*VAULT.values(), "Lucía", "200", "doscientos"]:
        assert value not in dumped


TEMPLATES = [
    "Entre tus tres cuentas tienes ‹SUMA_1›.",
    "Voy a pasar ‹IMPORTE_6› a tu cuenta de ‹PROVEEDOR_2-propio›. ¿Lo confirmas?",
    "Hola, ‹PERSONA_1-titular›. Tu saldo es ‹SUMA_1›",
    "Lo envío a ‹IBAN_1-maestro› desde la cuenta de ‹PERSONA_1›",
    "‹PERSONA_1›, ¿pasamos ‹IMPORTE_6›?",
    "Hecho.",
    # the model misbehaves and writes data itself
    "Tienes 4.873,00 € en total, Lucía Ferrer",
    "Paso doscientos euros a Nimbo Bróker",
    "Tu cuenta ES91 2100 0418 4502 0005 1332 está lista",
    "Hola Lucía Ferrer, tienes ‹SUMA_1›",
]


@pytest.mark.parametrize("template", TEMPLATES)
def test_no_token_or_value_reaches_cloud_text(template):
    u = seg(template)
    rendered = [s.spoken for s in u.segments if s.token]
    for text in u.cloud_texts:
        assert not TOKEN_RE.search(text)
        assert "‹" not in text and "›" not in text
        assert check.check(text) == []
        for value in [*VAULT.values(), *rendered]:
            assert value.casefold() not in text.casefold()
        assert not any(ch.isdigit() for ch in text)


def test_segment_contract_shapes():
    assert Segment("cloud", text="Hola").to_contract() == {"voice": "cloud", "text": "Hola"}
    local = Segment("local", token="‹IMPORTE_6›", say_as="currency", spoken="doscientos euros")
    assert local.to_contract() == {"voice": "local", "token": "‹IMPORTE_6›", "say_as": "currency"}
    assert local.speech == "doscientos euros"
    assert Segment("local", text="Lo leo yo").to_contract() == {"voice": "local", "text": "Lo leo yo"}
