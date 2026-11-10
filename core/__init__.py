"""Núcleo de Priv8 CUA (Camino 1), como librería en el proceso del agente.

API que usa agent/core_adapter.py (decisión del 10 nov, opción A):

    observe(session)                      → #8
    act(session, op, target, text, ...)   → #8
    oracle(session, op, args)             → #11
    check(payload)                        → bloqueo final (#9)
    record(event)                         → auditoría (#13)

El estado (bóvedas por sesión) vive en este proceso y no se persiste.
"""

from __future__ import annotations

from typing import Any

from .leak import LeakCheck
from .vault import VaultStore

STORE = VaultStore()
LEAK = LeakCheck(STORE)


def check(payload: Any) -> dict[str, Any]:
    """Bloqueo final. {"allowed": bool, "findings": [clase de dato, ...]}; nunca valores."""
    return LEAK.check(payload)


def trust(known: list[tuple[str, str]]) -> None:
    """Añade valores sensibles de confianza (p. ej. del seed) que check() buscará siempre."""
    global LEAK
    LEAK = LeakCheck(STORE, known=[*LEAK._known, *known])
