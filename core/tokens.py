"""Gramática de tokens · docs/contracts/token.md.

‹TIPO_n-etiqueta›, con TIPO en mayúsculas, n desde 1 y etiqueta opcional
(origen o rasgo). Aquí solo hay texto: los valores reales viven en vault.py.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

OPEN, CLOSE, DOT = "‹", "›", "-"

TIPOS = frozenset({
    "IBAN", "DNI", "NIE", "CIF", "PERSONA", "PROVEEDOR", "IMPORTE", "SUMA",
    "FACTURA", "TEL", "EMAIL", "MOVIMIENTO", "RESPUESTA", "CODIGO",
})
ORIGENES = frozenset({"propio", "maestro", "correo", "tercero", "titular"})
RASGOS = frozenset({"positivo", "negativo"})
ETIQUETAS = ORIGENES | RASGOS

TOKEN_RE = re.compile(OPEN + r"([A-Z]+)_(\d+)(?:" + DOT + r"([a-z]+))?" + CLOSE)


@dataclass(frozen=True)
class Token:
    tipo: str
    n: int
    etiqueta: str | None = None

    def __post_init__(self) -> None:
        if self.tipo not in TIPOS:
            raise ValueError(f"tipo de token desconocido: {self.tipo}")
        if self.n < 1:
            raise ValueError("n empieza en 1")
        if self.etiqueta is not None and self.etiqueta not in ETIQUETAS:
            raise ValueError(f"etiqueta desconocida: {self.etiqueta}")

    def __str__(self) -> str:
        tail = f"{DOT}{self.etiqueta}" if self.etiqueta else ""
        return f"{OPEN}{self.tipo}_{self.n}{tail}{CLOSE}"


def parse(text: str) -> Token | None:
    """Token si `text` es exactamente un token válido; None si no."""
    m = TOKEN_RE.fullmatch(text)
    if not m:
        return None
    try:
        return Token(m.group(1), int(m.group(2)), m.group(3))
    except ValueError:
        return None


def find(text: str) -> list[str]:
    """Tokens válidos que aparecen en `text`, en orden, como texto completo."""
    return [m.group(0) for m in TOKEN_RE.finditer(text) if parse(m.group(0))]


def neutralize(text: str) -> str:
    """Regla 5: el texto real no puede traer comillas de token. ‹ y › pasan a < y >."""
    return text.replace(OPEN, "<").replace(CLOSE, ">")


# ---- normalización: mismo valor, mismo token ----

_SPACES = re.compile(r"\s+")


def parse_amount(text: str) -> Decimal | None:
    """'1.254,30 €', '-45,20', '+3.412,58 EUR', '1254.30' → Decimal. None si no es un importe."""
    t = text.replace("−", "-").replace("EUR", "").replace("€", "")
    t = _SPACES.sub("", t)
    if not re.fullmatch(r"[+-]?\d[\d.,]*", t):
        return None
    sign = -1 if t.startswith("-") else 1
    t = t.lstrip("+-")
    if "," in t:  # formato español: puntos de miles y coma decimal
        t = t.replace(".", "").replace(",", ".")
    elif t.count(".") > 1 or re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        t = t.replace(".", "")  # solo puntos de miles
    try:
        return sign * Decimal(t)
    except InvalidOperation:
        return None


def normalize(tipo: str, value: str) -> str:
    v = unicodedata.normalize("NFC", value).strip()
    if tipo in {"IBAN", "DNI", "NIE", "CIF", "FACTURA", "CODIGO"}:
        return re.sub(r"[\s.-]", "", v).upper()
    if tipo in {"IMPORTE", "SUMA"}:
        amount = parse_amount(v)
        return str(amount.normalize()) if amount is not None else v
    if tipo == "TEL":
        digits = re.sub(r"[^\d+]", "", v)
        return digits[3:] if digits.startswith("+34") else digits
    if tipo == "EMAIL":
        return v.lower()
    return _SPACES.sub(" ", v).casefold()
