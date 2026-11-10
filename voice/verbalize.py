"""Spanish verbalization for the local voice.

The local voice (TextToSpeech on the phone, Web Speech in the console) is the
only one that says figures and names. Engines read "1.234,56 €" in different
ways, some of them wrong ("uno punto dos tres cuatro"), so the core hands the
device a sentence that is already spelled out:

    "1.234,56 €" -> "mil doscientos treinta y cuatro euros con cincuenta y seis"

Everything here runs in the trusted zone. Nothing in this module is ever sent
to the cloud voice.
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

_UNITS = [
    "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete",
    "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
    "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
]
_TENS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta",
         8: "ochenta", 9: "noventa"}
_HUNDREDS = {1: "ciento", 2: "doscientos", 3: "trescientos", 4: "cuatrocientos",
             5: "quinientos", 6: "seiscientos", 7: "setecientos", 8: "ochocientos",
             9: "novecientos"}

MAX_INT = 10**12 - 1


def _apocope(words: str) -> str:
    """'uno' -> 'un' before a noun or 'mil': veintiún euros, treinta y un mil."""
    if words.endswith("veintiuno"):
        return words[: -len("veintiuno")] + "veintiún"
    if words == "uno" or words.endswith(" uno"):
        return words[:-1]
    return words


def _below_thousand(n: int) -> str:
    assert 0 <= n < 1000
    if n < 30:
        return _UNITS[n]
    if n < 100:
        tens, unit = divmod(n, 10)
        return _TENS[tens] + (f" y {_UNITS[unit]}" if unit else "")
    hundreds, rest = divmod(n, 100)
    if n == 100:
        return "cien"
    head = _HUNDREDS[hundreds]
    return head + (f" {_below_thousand(rest)}" if rest else "")


def number_to_words(n: int, *, apocope: bool = False) -> str:
    """Cardinal in Spanish, masculine. apocope=True for use before a noun.

    >>> number_to_words(21)
    'veintiuno'
    >>> number_to_words(21, apocope=True)
    'veintiún'
    >>> number_to_words(1_234)
    'mil doscientos treinta y cuatro'
    """
    if n < 0:
        return "menos " + number_to_words(-n, apocope=apocope)
    if n > MAX_INT:
        raise ValueError("number too large to verbalize")
    if n < 1000:
        words = _below_thousand(n)
        return _apocope(words) if apocope else words

    parts: list[str] = []
    millions, rest = divmod(n, 1_000_000)
    if millions:
        parts.append("un millón" if millions == 1
                     else f"{number_to_words(millions, apocope=True)} millones")
    thousands, units = divmod(rest, 1000)
    if thousands:
        parts.append("mil" if thousands == 1
                     else f"{_apocope(_below_thousand(thousands))} mil")
    if units:
        words = _below_thousand(units)
        parts.append(_apocope(words) if apocope else words)
    return " ".join(parts)


_AMOUNT_RE = re.compile(
    r"^\s*(?P<sign>[-−+]?)\s*(?:€\s*)?(?P<num>\d[\d.\s ]*(?:,\d+)?)\s*(?:€|eur|euros?)?\s*$",
    re.IGNORECASE,
)


def parse_amount(text: str) -> Decimal:
    """Parse a Spanish-formatted amount: '1.234,56 €', '-200 €', '3.412,5'.

    Dots and spaces are thousands separators and the comma is the decimal
    mark. A plain '1234.56' (one dot, not three digits after it) is also
    accepted as a decimal point, since some screens show it that way.
    """
    m = _AMOUNT_RE.match(text)
    if not m:
        raise ValueError(f"not an amount: {text!r}")
    num = re.sub(r"[\s ]", "", m.group("num"))
    if "," in num:
        num = num.replace(".", "").replace(",", ".")
    elif num.count(".") == 1 and not re.fullmatch(r"\d{1,3}\.\d{3}", num):
        pass  # '1234.56': decimal point
    else:
        num = num.replace(".", "")
    try:
        value = Decimal(num)
    except InvalidOperation as exc:  # pragma: no cover - regex guards this
        raise ValueError(f"not an amount: {text!r}") from exc
    return -value if m.group("sign") in ("-", "−") else value


def verbalize_amount(value: str | Decimal | int) -> str:
    """'1.234,56 €' -> 'mil doscientos treinta y cuatro euros con cincuenta y seis'."""
    amount = parse_amount(value) if isinstance(value, str) else Decimal(value)
    sign = "menos " if amount < 0 else ""
    amount = abs(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    euros = int(amount)
    cents = int((amount - euros) * 100)

    if euros == 0 and cents:
        return f"{sign}{number_to_words(cents, apocope=True)} {'céntimo' if cents == 1 else 'céntimos'}"

    words = number_to_words(euros, apocope=True)
    # "un millón de euros", "dos millones de euros", but "un millón cien euros"
    joiner = " de " if euros >= 1_000_000 and euros % 1_000_000 == 0 else " "
    out = f"{sign}{words}{joiner}{'euro' if euros == 1 else 'euros'}"
    if cents:
        out += f" con {number_to_words(cents)}"
    return out


_DIGIT_WORDS = _UNITS[:10]


def spell_characters(text: str) -> str:
    """Read an identifier character by character, keeping its groups.

    'ES91 2100' -> 'E S nueve uno, dos uno cero cero'. Used for IBAN, DNI,
    phone numbers and codes, where reading '2100' as 'dos mil cien' is wrong.
    """
    groups = [g for g in re.split(r"[\s\-]+", text.strip()) if g]
    spoken = []
    for group in groups:
        spoken.append(" ".join(
            _DIGIT_WORDS[int(ch)] if ch.isdigit() else ch.upper()
            for ch in group if ch.isalnum()
        ))
    return ", ".join(s for s in spoken if s)


def verbalize(value: str, say_as: str) -> str:
    """Spell out a real value for the local voice, per the say_as enum of voice.schema.json."""
    if say_as == "currency":
        return verbalize_amount(value)
    if say_as == "number":
        return number_to_words(int(parse_amount(value)))
    if say_as in ("digits", "phone", "iban"):
        return spell_characters(value)
    return value  # "text", "name" and "date": the engine reads them as they are
