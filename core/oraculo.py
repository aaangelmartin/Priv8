"""Oráculo: calcula sin revelar (tools.schema.json oracle_input / oracle_result).

- sum: suma importes y devuelve un token nuevo ‹SUMA_n› y su tramo. La cifra
  solo se oye o se ve en local, con el renderizador.
- compare: mayor, menor o igual entre dos importes.
- matches: si dos valores del mismo tipo son el mismo (IBAN de la factura y
  de la ficha, por ejemplo).

Presupuesto: cada pregunta gasta una de la sesión (30 por defecto). Además,
cada token entra como mucho en PER_TOKEN preguntas de compare o matches: así
el agente no puede reconstruir una cifra por búsqueda binaria contra importes
de referencia que él mismo consiga que aparezcan en pantalla.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from . import tokens as T
from .session import Session

PER_TOKEN = 3
AMOUNT_TIPOS = {"IMPORTE", "SUMA"}
TRAMOS = [(Decimal(100), "0–100"), (Decimal(1000), "100–1.000"), (Decimal(10000), "1.000–10.000"),
          (Decimal(100000), "10.000–100.000")]


def tramo(x: Decimal) -> str:
    if x < 0:
        return "negativo"
    for top, name in TRAMOS:
        if x < top:
            return name
    return "más de 100.000"


def fmt_eur(x: Decimal) -> str:
    q = x.quantize(Decimal("0.01"))
    sign = "-" if q < 0 else ""
    euros, cents = divmod(abs(q), 1)
    return f"{sign}{int(euros):,}".replace(",", ".") + f",{int(cents * 100):02d} €"


def _denied(reason: str, detail: str) -> dict[str, Any]:
    return {"denied": reason, "detail": detail}


def ask(sess: Session, op: str, args: list[str]) -> dict[str, Any]:
    if op not in ("sum", "compare", "matches"):
        return _denied("sin_regla", f"operación desconocida: {op}")
    if len(args) < 2 or (op != "sum" and len(args) != 2):
        return _denied("sin_regla", "sum necesita dos o más tokens; compare y matches, dos")
    entries = []
    for tok in args:
        e = sess.vault.lookup(tok)
        if e is None:
            return _denied("token_desconocido", f"{tok} no existe en esta sesión")
        entries.append(e)
    if op in ("sum", "compare") and any(e.tipo not in AMOUNT_TIPOS for e in entries):
        return _denied("sin_regla", f"{op} solo trabaja con importes")
    if op == "matches" and entries[0].tipo != entries[1].tipo:
        return _denied("sin_regla", "matches compara dos valores del mismo tipo")
    if sess.budget_left <= 0:
        return _denied("presupuesto", "Sin preguntas al oráculo en esta sesión")
    uses = sess.extra.setdefault("oracle_uses", {})
    if op != "sum":
        spent = [t for t in args if uses.get(t, 0) >= PER_TOKEN]
        if spent:
            return _denied("presupuesto", f"{', '.join(spent)} ya no admite más comparaciones")
        for t in args:
            uses[t] = uses.get(t, 0) + 1
    sess.budget_left -= 1

    if op == "sum":
        total = sum((T.parse_amount(e.value) or Decimal(e.norm) for e in entries), Decimal(0))
        tok = sess.vault.tokenize("SUMA", fmt_eur(total))
        return {"result": tok, "tramo": tramo(total), "budget_left": sess.budget_left}
    if op == "compare":
        a, b = (T.parse_amount(e.value) or Decimal(e.norm) for e in entries)
        res = "igual" if a == b else ("mayor" if a > b else "menor")
        return {"result": res, "budget_left": sess.budget_left}
    res = "coincide" if entries[0].norm == entries[1].norm else "no coincide"
    return {"result": res, "budget_left": sess.budget_left}
