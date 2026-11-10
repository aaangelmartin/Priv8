"""Final block (bloqueo final) for the cloud voice.

Every sentence that would go to ElevenLabs passes through a LeakCheck first.
If it finds a sensitive pattern, the sentence does not leave: the segmenter
demotes it to the local voice and records an audit event.

LeakCheck is a port. The core (core/, issue "Bloqueo final en toda salida")
owns the canonical detector; when it lands, wrap it in a class with the same
``check`` method and pass it to the segmenter. PatternLeakCheck below is the
default so this package works and is testable on its own.

Findings carry the kind and the span of the match, never the matched value,
so they can go to the audit log as they are.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

from .tokens import TOKEN_FRAGMENT_RE


@dataclass(frozen=True)
class Finding:
    kind: str  # iban | dni | nie | card | amount | number | token | vault
    start: int
    end: int


class LeakCheck(Protocol):
    def check(self, text: str) -> list[Finding]:
        """Return every sensitive pattern found in text. Empty means it may leave."""
        ...


# --- validators -----------------------------------------------------------

def iban_is_valid(candidate: str) -> bool:
    s = re.sub(r"[\s\-]", "", candidate).upper()
    if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{11,30}", s):
        return False
    rearranged = s[4:] + s[:4]
    digits = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(digits) % 97 == 1


_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"


def dni_is_valid(candidate: str) -> bool:
    s = re.sub(r"[\s\-]", "", candidate).upper()
    m = re.fullmatch(r"(\d{8})([A-Z])", s)
    return bool(m) and _DNI_LETTERS[int(m.group(1)) % 23] == m.group(2)


def nie_is_valid(candidate: str) -> bool:
    s = re.sub(r"[\s\-]", "", candidate).upper()
    m = re.fullmatch(r"([XYZ])(\d{7})([A-Z])", s)
    if not m:
        return False
    number = "XYZ".index(m.group(1)) * 10**7 + int(m.group(2))
    return _DNI_LETTERS[number % 23] == m.group(3)


def luhn_is_valid(candidate: str) -> bool:
    digits = [int(ch) for ch in candidate if ch.isdigit()]
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


# --- patterns -------------------------------------------------------------

_IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:[\s\-]?[A-Z0-9]){11,30}\b", re.IGNORECASE)
_DNI_RE = re.compile(r"\b\d{8}[\s\-]?[A-Z]\b", re.IGNORECASE)
_NIE_RE = re.compile(r"\b[XYZ][\s\-]?\d{7}[\s\-]?[A-Z]\b", re.IGNORECASE)
_CARD_RE = re.compile(r"\b\d(?:[\s\-]?\d){12,18}\b")

_NUMBER_WORDS = (
    r"cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|"
    r"catorce|quince|dieci\w+|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|"
    r"setenta|ochenta|noventa|cien|ciento|\w+cientos|quinientos|mil|millón|millones"
)
_AMOUNT_RES = [
    # 1.234,56 € · 200€ · 3.412,58 EUR · 50 euros
    re.compile(r"\d[\d.,\s ]*\s*(?:€|eur\b|euros?\b|céntimos?\b)", re.IGNORECASE),
    # € 200
    re.compile(r"€\s*\d"),
    # Spanish-formatted figures even without a currency: 1.234,56 · 3.412 · 12,50
    re.compile(r"\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b|\b\d+,\d{2}\b"),
    # spelled-out money: "doscientos euros", "mil quinientos euros"
    re.compile(rf"\b(?:(?:{_NUMBER_WORDS})\b[\s,y]*)+(?:de\s+)?(?:euros?|céntimos?)\b",
               re.IGNORECASE),
]


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _words(text: str) -> str:
    """Casefolded, accent-free words joined by single spaces."""
    return " ".join(re.findall(r"[a-z0-9ñ]+", _fold(text)))


def _compact(text: str) -> str:
    return re.sub(r"[^a-z0-9ñ]", "", _fold(text))


class PatternLeakCheck:
    """Default leak check: validated patterns plus the known vault values.

    known_values are the real values of the session (the vault's right-hand
    column: IBAN, names, amounts as shown on screen). Matching ignores case,
    accents and punctuation and works on whole words, so "Lucía Ferrer" also
    catches "lucia ferrer," without "Ana" firing inside "mañana". Values with
    digits are also matched with separators removed, so "ES91 2100..." catches
    "ES912100...".

    Any digit at all in a cloud sentence is refused (kind "number"): figures
    are the local voice's job, so a stray "200" is treated as a leak.
    """

    def __init__(self, known_values: Iterable[str] = ()):
        self._words: set[str] = set()
        self._compact: set[str] = set()
        self.add_known_values(known_values)

    def add_known_values(self, values: Iterable[str]) -> None:
        for value in values:
            words = _words(value)
            if len(words) >= 2:
                self._words.add(words)
            compact = _compact(value)
            if any(ch.isdigit() for ch in compact) and len(compact) >= 3:
                self._compact.add(compact)

    def check(self, text: str) -> list[Finding]:
        findings: list[Finding] = []

        for m in TOKEN_FRAGMENT_RE.finditer(text):
            findings.append(Finding("token", m.start(), m.end()))
        for m in _IBAN_RE.finditer(text):
            if iban_is_valid(m.group()):
                findings.append(Finding("iban", m.start(), m.end()))
        for m in _NIE_RE.finditer(text):
            if nie_is_valid(m.group()):
                findings.append(Finding("nie", m.start(), m.end()))
        for m in _DNI_RE.finditer(text):
            if dni_is_valid(m.group()):
                findings.append(Finding("dni", m.start(), m.end()))
        for m in _CARD_RE.finditer(text):
            if luhn_is_valid(m.group()):
                findings.append(Finding("card", m.start(), m.end()))
        for rx in _AMOUNT_RES:
            for m in rx.finditer(text):
                findings.append(Finding("amount", m.start(), m.end()))
        for m in re.finditer(r"\d+", text):
            findings.append(Finding("number", m.start(), m.end()))

        # Vault spans refer to the folded text; enough to say "it is there".
        words = f" {_words(text)} "
        for value in self._words:
            i = words.find(f" {value} ")
            if i >= 0:
                findings.append(Finding("vault", i, i + len(value)))
        compact = _compact(text)
        for value in self._compact:
            i = compact.find(value)
            if i >= 0:
                findings.append(Finding("vault", i, i + len(value)))

        findings.sort(key=lambda f: (f.start, f.kind))
        return findings
