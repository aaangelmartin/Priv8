"""Procedencia y política de destino.

Cada valor de la bóveda recuerda en qué orígenes se ha visto (propio, maestro,
correo, tercero, titular). La política dice qué orígenes acepta cada campo de
destino. Así, un IBAN que solo ha aparecido en un correo no puede escribirse
en el IBAN de pago aunque el correo lo pida, y la llamada de verificación va
al teléfono de la ficha, no al que trae el correo.

Es el hueco `provenance` del ejecutor: devuelve un act_result denied o None.
"""

from __future__ import annotations

import re
from typing import Any

from . import tokens as T
from .policies import Rule
from .session import Session

CALL_ACCEPTS = frozenset({"maestro", "propio"})


def _denied(detail: str) -> dict[str, Any]:
    return {"denied": "destino", "detail": detail}


def check(sess: Session, op: str, el: dict | None, rule: Rule | None,
          text: str | None) -> dict[str, Any] | None:
    if op == "call":
        return _check_tokens(sess, text or "", "TEL", CALL_ACCEPTS, "la llamada")
    if op != "type" or rule is None or rule.campo is None or rule.acepta is None:
        return None
    return _check_tokens(sess, text or "", rule.tipo, set(rule.acepta), rule.campo)


def _check_tokens(sess: Session, text: str, tipo: str | None, accepts: set[str],
                  campo: str) -> dict[str, Any] | None:
    toks = T.find(text)
    rest = T.TOKEN_RE.sub("", text)
    if not toks or re.search(r"\S", rest):
        return _denied(f"{campo} solo admite tokens; no se escribe texto literal")
    for tok in toks:
        entry = sess.vault.lookup(tok)
        if entry is None:  # el ejecutor ya lo para; por si se llama aparte
            return {"denied": "token_desconocido", "detail": f"{tok} no existe en esta sesión"}
        if tipo and entry.tipo != tipo:
            return _denied(f"{campo} espera un {tipo}, no un {entry.tipo}")
        if not entry.origenes & accepts:
            seen = ", ".join(sorted(entry.origenes)) or "desconocido"
            ok = ", ".join(sorted(accepts))
            return _denied(f"{tipo or entry.tipo} de origen {seen} no entra en {campo} (acepta: {ok})")
    return None
