"""Bloqueo final: nada con un dato sensible sale hacia Claude ni ElevenLabs.

check(payload) revisa el texto que está a punto de salir (petición entera,
serializada) y devuelve {"allowed": bool, "findings": [...]}. findings dice
qué clase de dato apareció ("IBAN", "boveda:PERSONA"…), nunca el valor.

Busca:
- patrones validados del detector (IBAN, DNI, NIE, CIF, importes, teléfonos,
  correos) y lo rojo (tarjetas, códigos de un solo uso);
- cualquier valor real guardado en alguna bóveda, también sin espacios y con
  otras mayúsculas;
- valores sensibles de una lista de confianza (seed), aunque no estén en la
  bóveda todavía.

Los nombres por contexto ("Hola, Lucía") no se usan aquí: darían falsos
positivos con el texto propio del agente. Los nombres se cubren con la bóveda
y la lista de confianza.

Falla cerrado: si algo va mal al revisar, no sale.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from typing import Any

from . import tokens as T
from .detect import FinanceDetector
from .vault import VaultStore

_COMPACT_TIPOS = {"IBAN", "DNI", "NIE", "CIF", "TEL", "FACTURA", "CODIGO"}


def _readable(payload: str) -> str:
    """Si es JSON, lo reescribe sin escapes \\uXXXX para que 'Lucía' se lea como tal."""
    try:
        return json.dumps(json.loads(payload), ensure_ascii=False)
    except (ValueError, TypeError):
        return payload


class LeakCheck:
    def __init__(self, store: VaultStore | None = None,
                 known: Iterable[tuple[str, str]] = ()):
        self.store = store
        self._known = [(t, v) for t, v in known if v and len(v.strip()) >= 3]
        self._detector = FinanceDetector()

    def _secrets(self) -> list[tuple[str, str]]:
        out = list(self._known)
        if self.store is not None:
            for vault in self.store.all():
                out += [(e.tipo, e.value) for e in vault.entries() if e.tipo != "SUMA"]
        return out

    def check(self, payload: str | Any) -> dict[str, Any]:
        try:
            text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
            text = _readable(text)
            # Los tokens no cuentan: se quitan antes de buscar patrones.
            bare = T.TOKEN_RE.sub(" ", text)
            findings: set[str] = set()
            for span in self._detector(bare):
                if span.tipo == "PERSONA":
                    continue
                findings.add("rojo" if span.tipo == "ROJO" else span.tipo)
            low = bare.casefold()
            compact = re.sub(r"[\s.-]", "", bare).upper()
            for tipo, value in self._secrets():
                v = value.strip()
                if v.casefold() in low:
                    findings.add(f"boveda:{tipo}")
                elif tipo in _COMPACT_TIPOS:
                    c = re.sub(r"[\s.-]", "", v).upper()
                    if len(c) >= 6 and c in compact:
                        findings.add(f"boveda:{tipo}")
            return {"allowed": not findings, "findings": sorted(findings)}
        except Exception as exc:  # falla cerrado
            return {"allowed": False, "findings": [f"error:{type(exc).__name__}"]}
