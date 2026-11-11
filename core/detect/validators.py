"""Validadores de identificadores: IBAN mod-97, DNI/NIE, CIF y Luhn."""

from __future__ import annotations

import re

_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"
_IBAN_LEN = {"ES": 24, "PT": 25, "FR": 27, "DE": 22, "IT": 27, "GB": 22, "NL": 18, "BE": 16, "AD": 24}


def _clean(s: str) -> str:
    return re.sub(r"[\s-]", "", s).upper()


def iban(s: str) -> bool:
    v = _clean(s)
    if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{10,30}", v):
        return False
    if v[:2] in _IBAN_LEN and len(v) != _IBAN_LEN[v[:2]]:
        return False
    digits = "".join(str(int(c, 36)) for c in v[4:] + v[:4])
    return int(digits) % 97 == 1


def dni(s: str) -> bool:
    v = _clean(s)
    return bool(re.fullmatch(r"\d{8}[A-Z]", v)) and _DNI_LETTERS[int(v[:8]) % 23] == v[8]


def nie(s: str) -> bool:
    v = _clean(s)
    if not re.fullmatch(r"[XYZ]\d{7}[A-Z]", v):
        return False
    num = "XYZ".index(v[0]) * 10**7 + int(v[1:8])
    return _DNI_LETTERS[num % 23] == v[8]


def cif(s: str) -> bool:
    v = _clean(s)
    if not re.fullmatch(r"[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]", v):
        return False
    digits = v[1:8]
    even = sum(int(d) for d in digits[1::2])
    odd = sum(sum(divmod(int(d) * 2, 10)) for d in digits[0::2])
    control = (10 - (even + odd) % 10) % 10
    last = v[8]
    letter = "JABCDEFGHI"[control]
    if v[0] in "PQRSNW":
        return last == letter
    if v[0] in "ABEH":
        return last == str(control)
    return last in (str(control), letter)


def luhn(s: str) -> bool:
    d = re.sub(r"\D", "", s)
    if not 13 <= len(d) <= 19:
        return False
    total = 0
    for i, ch in enumerate(reversed(d)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0
