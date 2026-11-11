"""Detector del perfil Finanzas.

Busca datos sensibles en texto libre y devuelve Spans (core/screen.py):
- Patrones con validación: IBAN (mod-97), DNI y NIE (letra), CIF (dígito de
  control), tarjeta (Luhn, roja), importes, teléfonos, correos.
- Códigos de un solo uso junto a palabras como "código" u "OTP" (rojos).
- Valores ya conocidos: los de la bóveda de la sesión y los de una lista de
  confianza (datos de la persona o de la empresa).
- Nombres de personas tras saludos y fórmulas habituales ("Hola,", "Sr.",
  "Atentamente,") y nombres conocidos.

Las reglas por sitio (selectores) están en las políticas; esto cubre lo que
no tiene regla y el bloqueo final.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

from ..screen import Span
from . import validators as V

ROJO = "ROJO"

# Mayúsculas o minúsculas; grupos separados por espacio, guion o salto de línea.
IBAN_RE = re.compile(r"\b[A-Za-z]{2}\d{2}(?:[ \t\- ]?\n?[ \t]*[A-Za-z0-9]{4}){3,7}(?:[ \-]?[A-Za-z0-9]{1,3})?\b")
CARD_RE = re.compile(r"(?<![\w])\d(?:[ -]?\d){12,18}(?![\d])")
DNI_RE = re.compile(r"\b\d{8}[ -]?[A-Za-z]\b")
NIE_RE = re.compile(r"\b[XYZxyz][ -]?\d{7}[ -]?[A-Za-z]\b")
CIF_RE = re.compile(r"\b[ABCDEFGHJNPQRSUVWabcdefghjnpqrsuvw][ -]?\d{7}[0-9A-Ja-j]\b")
AMOUNT_RE = re.compile(
    r"(?<![\w.,])[-+−]?\s?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s?(?:€|EUR\b)"
    r"|(?:€|EUR)\s?[-+]?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?(?![\d])"
)
PHONE_RE = re.compile(r"(?<![\w+])(?:\+34[ ]?)?[6789]\d{2}(?:[ ]?\d{3}[ ]?\d{3}|(?:[ ]?\d{2}){3})(?![\d])")
# Números de documento con serie y año: F-2026-0412, FA-2026-0877 (factura); PED-2026-3325 (otro código).
DOC_RE = re.compile(r"\b([A-Za-z]{1,4})[-/](?:19|20)\d{2}[-/]\d{2,6}\b")
FACTURA_SERIES = {"F", "FA", "FAC", "FRA", "FV", "FC"}
# "Factura nº 1234", "factura 2026/88": lo que sigue a la palabra, si lleva una cifra.
FACTURA_KW_RE = re.compile(r"(?i)\bfactura\s+(?:n\.?\s*[º°o]\.?\s*|n[uú]m(?:ero|\.)?\s*)?([A-Za-z0-9][\w/\-]*\d[\w/\-]*)")
# Lo que sigue a "factura" y no es un número: años, fechas, trimestres ("factura 2026", "factura Q4").
NOT_FACTURA_RE = re.compile(r"(?i)(?:19|20)\d{2}(?:[-/]\d{1,2}){0,2}|\d{1,2}(?:[-/]\d{1,2})?[-/](?:19|20)?\d{2}|q[1-4]|t[1-4]")
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b")
OTP_RE = re.compile(r"(?i)(?:c[oó]digo|code|otp|clave|pin|contraseña|password)\D{0,25}?(\d{4,8})\b")
NAME_AFTER_RE = re.compile(
    r"(?:\bHola,?|\bEstimad[oa]s?|\bQuerid[oa]|\bSr\.|\bSra\.|\bD\.|\bDña\.|\bAtentamente,?|"
    r"\bSaludos,?|\bUn saludo,?|\bFirmado:?|\bTitular:?|\bBeneficiario:?|\bde|\ba)\s+"
    r"((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)(?:\s+(?:de\s+|del\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})"
)
# Nombres de la interfaz que no son datos: las entidades simuladas de la demo. Ante la
# duda, un nombre propio tras "de" o "a" se tokeniza; solo estos quedan en claro.
PUBLIC_NAMES = frozenset({"banca alcor", "brezo banco", "nimbo bróker", "alba core"})


class FinanceDetector:
    """detect(text) → list[Span]. `known` son (tipo, valor) de confianza; la bóveda se
    consulta en cada llamada si se pasa."""

    def __init__(self, known: Iterable[tuple[str, str]] = (), vault=None):
        self._known = [(t, v) for t, v in known if v and len(v.strip()) >= 3]
        self.vault = vault

    def _known_values(self) -> list[tuple[str, str]]:
        vals = list(self._known)
        if self.vault is not None:
            vals += [(e.tipo, e.value) for e in self.vault.entries() if e.tipo != "SUMA"]
        # Más largos primero: "Lucía Ferrer - Nimbo Bróker" antes que "Lucía Ferrer".
        return sorted(vals, key=lambda tv: -len(tv[1]))

    def __call__(self, text: str) -> list[Span]:
        if not text:
            return []
        spans: list[Span] = []

        def add(start, end, tipo):
            spans.append(Span(start, end, tipo))

        ibans = _ibans(text)
        for s, e in ibans:
            add(s, e, "IBAN")
        for m in OTP_RE.finditer(text):
            add(m.start(1), m.end(1), ROJO)
        for m in CARD_RE.finditer(text):
            inside_iban = any(s <= m.start() and m.end() <= e for s, e in ibans)
            if V.luhn(m.group(0)) and not inside_iban:
                add(m.start(), m.end(), ROJO)
        for m in NIE_RE.finditer(text):
            if V.nie(m.group(0)):
                add(m.start(), m.end(), "NIE")
        for m in DNI_RE.finditer(text):
            if V.dni(m.group(0)):
                add(m.start(), m.end(), "DNI")
        for m in CIF_RE.finditer(text):
            if V.cif(m.group(0)):
                add(m.start(), m.end(), "CIF")
        for m in EMAIL_RE.finditer(text):
            add(m.start(), m.end(), "EMAIL")
        for m in DOC_RE.finditer(text):
            add(m.start(), m.end(), "FACTURA" if m.group(1).upper() in FACTURA_SERIES else "CODIGO")
        for m in FACTURA_KW_RE.finditer(text):
            if not NOT_FACTURA_RE.fullmatch(m.group(1)):
                add(m.start(1), m.end(1), "FACTURA")
        for m in AMOUNT_RE.finditer(text):
            s, e = m.span()
            while s < e and text[s] == " ":
                s += 1
            add(s, e, "IMPORTE")
        for m in PHONE_RE.finditer(text):
            add(m.start(), m.end(), "TEL")
        for tipo, value in self._known_values():
            for m in re.finditer(re.escape(value), text, flags=re.IGNORECASE):
                add(m.start(), m.end(), tipo)
        for m in NAME_AFTER_RE.finditer(text):
            if m.group(1).casefold() not in PUBLIC_NAMES:
                add(m.start(1), m.end(1), "PERSONA")
        return _resolve(spans)


def _ibans(text: str) -> list[tuple[int, int]]:
    """IBAN válidos. El patrón puede tragarse una palabra de después ("… 1332 para"):
    se prueban finales cada vez más cortos, en límites de grupo, hasta que valide."""
    found = []
    for m in IBAN_RE.finditer(text):
        s = m.start()
        ends = [r.end() + s for r in re.finditer(r"[A-Za-z0-9]+", m.group(0))]
        for end in reversed(ends):
            if V.iban(text[s:end]):
                found.append((s, end))
                break
    return found


_PRIORITY = {ROJO: 0, "IBAN": 1, "NIE": 2, "DNI": 2, "CIF": 2, "EMAIL": 3,
             "IMPORTE": 4, "TEL": 5}


def _resolve(spans: list[Span]) -> list[Span]:
    """Quita solapes: gana lo rojo, luego el más largo, luego el de más prioridad."""
    ordered = sorted(spans, key=lambda s: (s.tipo != ROJO, -(s.end - s.start),
                                           _PRIORITY.get(s.tipo, 6), s.start))
    chosen: list[Span] = []
    for s in ordered:
        if all(s.end <= c.start or s.start >= c.end for c in chosen):
            chosen.append(s)
    return sorted(chosen, key=lambda s: s.start)
