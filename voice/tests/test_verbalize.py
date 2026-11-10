from decimal import Decimal

import pytest

from voice.verbalize import (
    number_to_words,
    parse_amount,
    spell_characters,
    verbalize,
    verbalize_amount,
)


@pytest.mark.parametrize("n, words", [
    (0, "cero"),
    (1, "uno"),
    (15, "quince"),
    (16, "dieciséis"),
    (21, "veintiuno"),
    (22, "veintidós"),
    (30, "treinta"),
    (31, "treinta y uno"),
    (99, "noventa y nueve"),
    (100, "cien"),
    (101, "ciento uno"),
    (200, "doscientos"),
    (555, "quinientos cincuenta y cinco"),
    (777, "setecientos setenta y siete"),
    (999, "novecientos noventa y nueve"),
    (1000, "mil"),
    (1001, "mil uno"),
    (1234, "mil doscientos treinta y cuatro"),
    (2000, "dos mil"),
    (21000, "veintiún mil"),
    (31000, "treinta y un mil"),
    (100000, "cien mil"),
    (101000, "ciento un mil"),
    (1_000_000, "un millón"),
    (2_500_000, "dos millones quinientos mil"),
    (21_000_000, "veintiún millones"),
])
def test_number_to_words(n, words):
    assert number_to_words(n) == words


def test_apocope_before_a_noun():
    assert number_to_words(1, apocope=True) == "un"
    assert number_to_words(21, apocope=True) == "veintiún"
    assert number_to_words(31, apocope=True) == "treinta y un"
    assert number_to_words(1001, apocope=True) == "mil un"


@pytest.mark.parametrize("text, value", [
    ("1.234,56 €", Decimal("1234.56")),
    ("3.412,58 €", Decimal("3412.58")),
    ("200 €", Decimal("200")),
    ("200€", Decimal("200")),
    ("€ 200", Decimal("200")),
    ("-45,10 €", Decimal("-45.10")),
    ("4.873", Decimal("4873")),
    ("1 234,5 EUR", Decimal("1234.5")),
    ("1234.56", Decimal("1234.56")),
    ("1.000.000 €", Decimal("1000000")),
])
def test_parse_amount(text, value):
    assert parse_amount(text) == value


def test_parse_amount_rejects_text():
    with pytest.raises(ValueError):
        parse_amount("Lucía Ferrer")


@pytest.mark.parametrize("text, spoken", [
    ("1.234,56 €", "mil doscientos treinta y cuatro euros con cincuenta y seis"),
    ("4.873 €", "cuatro mil ochocientos setenta y tres euros"),
    ("200 €", "doscientos euros"),
    ("1 €", "un euro"),
    ("1,00 €", "un euro"),
    ("21 €", "veintiún euros"),
    ("31,01 €", "treinta y un euros con uno"),
    ("0,50 €", "cincuenta céntimos"),
    ("0,01 €", "un céntimo"),
    ("-45,10 €", "menos cuarenta y cinco euros con diez"),
    ("1.000.000 €", "un millón de euros"),
    ("2.000.000,00 €", "dos millones de euros"),
    ("1.000.100 €", "un millón cien euros"),
    ("3.412,58 €", "tres mil cuatrocientos doce euros con cincuenta y ocho"),
])
def test_verbalize_amount(text, spoken):
    assert verbalize_amount(text) == spoken


def test_verbalize_amount_rounds_half_up_to_cents():
    assert verbalize_amount(Decimal("10.005")) == "diez euros con uno"
    assert verbalize_amount(Decimal("10.004")) == "diez euros"


def test_spell_characters_keeps_groups():
    assert spell_characters("ES91 2100") == "E S nueve uno, dos uno cero cero"
    assert spell_characters("12345678-Z") == "uno dos tres cuatro cinco seis siete ocho, Z"


def test_verbalize_dispatches_on_say_as():
    assert verbalize("200 €", "currency") == "doscientos euros"
    assert verbalize("3", "number") == "tres"
    assert verbalize("ES91", "characters") == "E S nueve uno"
    assert verbalize("Nimbo Bróker", "name") == "Nimbo Bróker"
