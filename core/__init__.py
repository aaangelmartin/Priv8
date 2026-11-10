"""Núcleo de Priv8 CUA (Camino 1), como librería en el proceso del agente.

API que usa agent/core_adapter.py (decisión del 10 nov, opción A):

    observe(session)                                   pantalla tokenizada
    act(session, op, target=None, text=None, direction=None)
    oracle(session, op, args)                          #11
    check(payload)                                     bloqueo final
    record(event)                                      auditoría

Y para quien monta el proceso:

    connect(session, adapter)       adaptador (web o puente Android) de la sesión
    tokenize_text(session, text)    orden de la persona → texto con tokens
    trust([(tipo, valor), ...])     valores de confianza (seed) que se buscan siempre

El estado vive en este proceso y no se persiste.
"""

from __future__ import annotations

import json
import time
from typing import Any

from . import executor, provenance
from .adapter import Adapter
from .audit import Audit
from .detect import FinanceDetector
from .leak import LeakCheck
from .policies import PolicySet, load_policies
from .screen import _replace_spans, observe_screen
from .session import Sessions
from .vault import VaultStore

STORE = VaultStore()
SESSIONS = Sessions(STORE)
AUDIT = Audit()
TRUSTED: list[tuple[str, str]] = []
LEAK = LeakCheck(STORE)
HOOKS: dict[str, Any] = {"provenance": provenance.check, "confirm": None}
_policies: PolicySet | None = None


def policies() -> PolicySet:
    global _policies
    if _policies is None:
        _policies = load_policies()
    return _policies


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


# ---- montaje ----

def connect(session: str, adapter: Adapter) -> None:
    SESSIONS.get(session).adapter = adapter


def trust(known: list[tuple[str, str]]) -> None:
    global LEAK
    TRUSTED.extend(known)
    LEAK = LeakCheck(STORE, known=TRUSTED)


def _detector(session: str) -> FinanceDetector:
    return FinanceDetector(known=TRUSTED, vault=SESSIONS.get(session).vault)


def tokenize_text(session: str, text: str, origen: str = "titular") -> str:
    """Lo que dice o escribe la persona, con sus datos cambiados por tokens, antes de ir a Claude."""
    vault = SESSIONS.get(session).vault
    out, red = _replace_spans(text, _detector(session)(text), vault, origen)
    return out if not red else "[la persona dijo un dato que nunca sale]"


# ---- las cinco funciones ----

def check(payload: Any) -> dict[str, Any]:
    """Bloqueo final. {"allowed": bool, "findings": [clase de dato, ...]}; nunca valores."""
    return LEAK.check(payload)


def record(event: dict[str, Any]) -> dict[str, Any]:
    return AUDIT.record(event)


def observe(session: str) -> dict[str, Any]:
    t0 = time.perf_counter()
    sess = SESSIONS.get(session)
    if sess.adapter is None:
        return {"denied": "sin_regla", "detail": "la sesión no tiene adaptador conectado"}
    ta = time.perf_counter()
    raw = sess.adapter.snapshot()
    adapter_ms = _ms(ta)
    screen = policies().screen_for(raw)
    if screen is None:
        sess.last_raw, sess.last_screen = None, None
        record({"session": session, "kind": "blocked", "reason": "sin_regla", "app": raw.get("app"),
                "model_saw": None, "detail": "pantalla sin política: no sale",
                "ms": {"core": _ms(t0), "adapter": adapter_ms, "model": None}})
        return {"denied": "sin_regla", "detail": "No hay política para esta pantalla"}
    obs, counts = observe_screen(raw, screen, sess.vault, sess.budget_left, _detector(session))
    verdict = check(json.dumps(obs, ensure_ascii=False))
    if not verdict["allowed"]:
        sess.last_raw, sess.last_screen = None, None
        record({"session": session, "kind": "blocked", "reason": "fuga", "app": raw.get("app"),
                "screen": screen.id, "detail": "observe: " + ", ".join(verdict["findings"]),
                "ms": {"core": _ms(t0), "adapter": adapter_ms, "model": None}})
        return {"denied": "fuga", "detail": "La pantalla tenía datos sin tokenizar y no sale"}
    sess.last_raw, sess.last_screen, sess.last_paused = raw, screen, obs["paused"]
    toks = sorted({t for e in obs["elements"] for t in e.get("tokens", [])})
    record({"session": session, "kind": "observe_sent", "app": raw.get("app"), "screen": screen.id,
            "model_saw": f"observe {screen.id}", "tokens": toks, "counts": counts,
            "ms": {"core": _ms(t0) - adapter_ms, "adapter": adapter_ms, "model": None}})
    return obs


def act(session: str, op: str, target: str | None = None, text: str | None = None,
        direction: str | None = None) -> dict[str, Any]:
    t0 = time.perf_counter()
    sess = SESSIONS.get(session)
    result = executor.execute(sess, op, target, text, direction,
                              provenance=HOOKS["provenance"], confirm=HOOKS["confirm"])
    saw = " ".join(x for x in ("act", op, target, text) if x)
    from .tokens import find
    base = {"session": session, "model_saw": saw, "tokens": find(text or ""),
            "app": (sess.last_raw or {}).get("app"),
            "screen": sess.last_screen.id if sess.last_screen else None,
            "ms": {"core": _ms(t0), "adapter": None, "model": None}}
    if "denied" in result:
        record({**base, "kind": "blocked", "reason": result["denied"], "detail": result["detail"]})
    elif "held" in result:
        record({**base, "kind": "held", "confirm": result["held"]["confirm"]})
    else:
        record({**base, "kind": "act"})
    return result


def oracle(session: str, op: str, args: list[str]) -> dict[str, Any]:
    return {"denied": "sin_regla", "detail": "oráculo pendiente (#11)"}
