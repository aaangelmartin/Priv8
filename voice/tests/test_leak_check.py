import pytest

from voice.leak_check import (
    PatternLeakCheck,
    dni_is_valid,
    iban_is_valid,
    luhn_is_valid,
    nie_is_valid,
)

IBAN = "ES91 2100 0418 4502 0005 1332"


def kinds(text, **kw):
    return {f.kind for f in PatternLeakCheck(**kw).check(text)}


def test_validators():
    assert iban_is_valid(IBAN)
    assert iban_is_valid(IBAN.replace(" ", ""))
    assert not iban_is_valid("ES92 2100 0418 4502 0005 1332")
    assert dni_is_valid("12345678Z")
    assert not dni_is_valid("12345678A")
    assert nie_is_valid("X1234567L")
    assert not nie_is_valid("X1234567A")
    assert luhn_is_valid("4111 1111 1111 1111")
    assert not luhn_is_valid("4111 1111 1111 1112")


@pytest.mark.parametrize("text, kind", [
    (f"Tu cuenta es {IBAN}", "iban"),
    ("El titular tiene DNI 12345678Z", "dni"),
    ("NIE X1234567L registrado", "nie"),
    ("Tarjeta 4111-1111-1111-1111", "card"),
    ("Tienes 1.234,56 € disponibles", "amount"),
    ("Tienes 200€", "amount"),
    ("Saldo de 3.412,58", "amount"),
    ("Voy a pasar doscientos euros", "amount"),
    ("Son mil quinientos euros", "amount"),
    ("Voy a pasar 200 al bróker", "number"),
    ("Entre tus cuentas tienes ‹SUMA_1›", "token"),
    ("Un token roto ‹SUMA_", "token"),
])
def test_sensitive_patterns_are_found(text, kind):
    assert kind in kinds(text)


@pytest.mark.parametrize("text", [
    "Entre tus tres cuentas tienes",
    "Voy a pasar",
    "a tu cuenta de",
    "¿Lo confirmas?",
    "Hecho. La transferencia está enviada.",
    "Lo tienes en euros",
    "Nos vemos mañana",
])
def test_data_free_sentences_pass(text):
    assert PatternLeakCheck(known_values=["Ana", "Lucía Ferrer"]).check(text) == []


def test_invalid_checksums_are_not_reported_as_ids():
    assert "iban" not in kinds("ES92 2100 0418 4502 0005 1332")
    assert "dni" not in kinds("12345678A")


def test_known_vault_values_ignore_case_accents_and_separators():
    check = PatternLeakCheck(known_values=["Lucía Ferrer", "Nimbo Bróker", IBAN])
    assert {f.kind for f in check.check("Hola, lucia FERRER.")} == {"vault"}
    assert {f.kind for f in check.check("a tu cuenta de Nimbo Broker")} == {"vault"}
    assert "vault" in {f.kind for f in check.check("cuenta es912100041845020005 1332")}


def test_vault_names_match_whole_words_only():
    check = PatternLeakCheck(known_values=["Ana"])
    assert check.check("Nos vemos mañana") == []
    assert [f.kind for f in check.check("Se lo paso a Ana")] == ["vault"]


def test_add_known_values():
    check = PatternLeakCheck()
    assert check.check("Talleres Norte") == []
    check.add_known_values(["Talleres Norte"])
    assert [f.kind for f in check.check("pago de Talleres Norte")] == ["vault"]


def test_findings_never_carry_the_value():
    finding = PatternLeakCheck().check(f"IBAN {IBAN}")[0]
    assert set(vars(finding)) == {"kind", "start", "end"}
