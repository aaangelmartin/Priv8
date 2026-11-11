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
    say(session, text)              lo que dice 8 (tokens), en voz mixta, al canal de eventos y al móvil

Tareas que llegan mientras el agente corre (#47: app 8 o dictado con Whisper):

    submit_task(session, text, via)            la encola (lo llama core.server)
    next_task(session, timeout=None) -> str | None
                                               bloquea hasta la siguiente tarea de la
                                               sesión y devuelve su texto real; None si
                                               vence timeout. Quien la pase a Claude la
                                               tokeniza antes con tokenize_text.

El estado vive en este proceso y no se persiste.
"""

from __future__ import annotations

import json
import queue
import threading
import time
from typing import Any

from . import events, executor, provenance
from . import oraculo as _oracle
from .adapter import Adapter
from .audit import Audit
from .confirm import Confirmations, Pending
from .detect import FinanceDetector
from .leak import LeakCheck
from .policies import PolicySet, load_policies
from .screen import _replace_spans, observe_screen
from . import tokens as T
from .session import Sessions
from .vault import VaultStore

STORE = VaultStore()
SESSIONS = Sessions(STORE)
AUDIT = Audit.from_env()  # audit/priv8.jsonl firmado; PRIV8_AUDIT=off, solo memoria
TRUSTED: list[tuple[str, str]] = []
LEAK = LeakCheck(STORE)
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


# ---- tareas de la persona (#47) ----

TASK_MAX = 500  # una orden hablada o escrita; más larga no es una tarea
_tasks: dict[str, queue.Queue[str]] = {}
_tasks_lock = threading.Lock()


def _task_queue(session: str) -> queue.Queue[str]:
    with _tasks_lock:
        return _tasks.setdefault(session, queue.Queue())


def submit_task(session: str, text: str, via: str = "app") -> dict[str, Any]:
    """Encola una tarea de la persona (task_request de la app 8 o dictado del portátil).

    El texto real solo se queda en la cola, en este proceso. La auditoría guarda los
    tokens que salen de tokenizarlo y su longitud, nunca el texto."""
    text = " ".join(str(text).split())[:TASK_MAX]
    if not text:
        return {"ok": False, "detail": "tarea vacía"}
    toks = T.find(tokenize_text(session, text))
    _task_queue(session).put(text)
    record({"session": session, "kind": "task", "model_saw": None, "tokens": toks,
            "detail": f"tarea recibida - {via} - {len(text)} caracteres"})
    return {"ok": True}


def next_task(session: str, timeout: float | None = None) -> str | None:
    """Siguiente tarea de la sesión, con su texto real. Bloquea hasta que llega una;
    con timeout (segundos) devuelve None si no llega. Seguro entre hilos."""
    try:
        return _task_queue(session).get(timeout=timeout)
    except queue.Empty:
        return None


# ---- las cinco funciones ----

def check(payload: Any) -> dict[str, Any]:
    """Bloqueo final. {"allowed": bool, "findings": [clase de dato, ...]}; nunca valores."""
    return LEAK.check(payload)


def record(event: dict[str, Any]) -> dict[str, Any]:
    stored = AUDIT.record(event)
    events.publish({"type": "audit", "event": stored})
    return stored


_utterances = 0


def say(session: str, text: str) -> dict[str, Any] | None:
    """Lo que dice 8 (texto con tokens, nunca valores) como frase de voz mixta (voice.schema.json)
    al canal de eventos. Compatible con la frase fija de #43: sin tokens sale un solo segmento cloud.

    Pasa el bloqueo final: si el texto lleva un dato sin tokenizar, no se publica y devuelve None.
    Las frases sin datos van a la voz de la nube y cada token a la voz local; si una frase de la
    nube lleva un patrón (una cifra escrita), la frase entera se lee en local. El puente Android
    manda antes render_values con los valores de los tokens (adapters/android/bridge.py), y su
    voice.done queda en la auditoría como voice_out."""
    global _utterances
    from voice.segmenter import segment

    text = (text or "").strip()
    if not text or not check(text)["allowed"]:
        return None
    _utterances += 1
    utt = segment(text, lambda tok, how: "", utterance=f"u{_utterances}", session=session)
    if not utt.segments:
        return None
    utterance = utt.to_contract()
    events.publish({"type": "voice", "utterance": utterance})
    return utterance


CONFIRM = Confirmations(publish=events.publish, record=record)
HOOKS: dict[str, Any] = {"provenance": provenance.check, "confirm": CONFIRM.hook}


def _perform_pending(p: Pending) -> dict[str, Any]:
    sess = p.session
    action = dict(p.action)
    action.pop("label", None)
    if "text" in action:
        action["text"] = sess.vault.render(action["text"])
    if sess.adapter is None:
        return {"denied": "sin_regla", "detail": "la sesión no tiene adaptador conectado"}
    res = sess.adapter.perform(action)
    record({"session": sess.id, "kind": "act", "confirm": p.request["id"], "approved_by": "persona",
            "model_saw": " ".join(x for x in ("act", p.action["op"], p.action.get("target"),
                                              p.action.get("text")) if x),
            "tokens": T.find(p.action.get("text", ""))})
    return {"ok": True} if res.get("ok") else {
        "denied": "adaptador", "detail": f"el adaptador no pudo: {res.get('error', 'otro')}"}


def approve(result: dict[str, Any]) -> dict[str, Any]:
    """Respuesta de la persona (approval_result de confirm.schema.json). Si aprueba a
    tiempo, ejecuta la acción retenida y devuelve {"ok": true}."""
    return CONFIRM.approve(result, _perform_pending)


def pending(session: str | None = None) -> list[dict[str, Any]]:
    return CONFIRM.pending(session)


def expire_due() -> list[str]:
    return CONFIRM.expire_due()


def render_values(session: str, toks: list[str]) -> dict[str, str]:
    """Valores reales de unos tokens, SOLO para la zona de confianza (puente, app 8)."""
    vault = SESSIONS.get(session).vault
    return {t: vault.value(t) for t in toks if t in vault}


APP_OCHO = "es.priv8.ocho"


def pause_before_policy(raw: dict[str, Any]) -> str | None:
    """Regla de pausa de los contratos v1.1, que se mira antes que la política y en este orden:
    diálogo del sistema; pantalla de confirmación de 8; foco en un campo rojo."""
    if raw.get("system_dialog"):
        return "dialogo_sistema"
    if raw.get("app") == APP_OCHO and raw.get("screen") == "confirmacion":
        return "confirmacion"
    focus = raw.get("focus")
    if focus and any(e.get("id") == focus and e.get("password") for e in raw.get("elements", [])):
        return "autenticacion"
    return None


def no_policy_detail(adapter: Any) -> str:
    """Denegación de una pantalla sin política, con la forma de volver a una que sí la tiene."""
    apps = [a for a in (getattr(adapter, "apps", None) or {}) if a in policies()]
    back = " o ".join(f"act open_app {a}" for a in apps) or "act open_app con la app del encargo"
    return f"No hay política para esta pantalla. Vuelve con {back}."


def observe(session: str) -> dict[str, Any]:
    t0 = time.perf_counter()
    sess = SESSIONS.get(session)
    if sess.adapter is None:
        return {"denied": "sin_regla", "detail": "la sesión no tiene adaptador conectado"}
    ta = time.perf_counter()
    raw = sess.adapter.snapshot()
    adapter_ms = _ms(ta)
    paused = pause_before_policy(raw)
    if paused:  # la pausa manda sobre la política: no se lee nada de esa ventana
        sess.last_paused = paused
        obs = {"session": session, "app": raw.get("app", ""), "screen": raw.get("screen"),
               "seq": raw.get("seq", 0), "paused": paused, "elements": [], "budget_left": sess.budget_left}
        record({"session": session, "kind": "paused", "app": raw.get("app"), "screen": raw.get("screen"),
                "detail": paused, "ms": {"core": _ms(t0) - adapter_ms, "adapter": adapter_ms, "model": None}})
        return obs
    screen = policies().screen_for(raw)
    recover = getattr(sess.adapter, "recover", None)
    if screen is None and callable(recover) and recover():
        # El adaptador ha vuelto a una pantalla conocida de la app (p. ej. tras un back que salía).
        record({"session": session, "kind": "blocked", "reason": "sin_regla", "app": raw.get("app"),
                "model_saw": None, "detail": "pantalla sin política: vuelta a la pantalla de inicio"})
        ta = time.perf_counter()
        raw = sess.adapter.snapshot()
        adapter_ms += _ms(ta)
        screen = None if pause_before_policy(raw) else policies().screen_for(raw)
    if screen is None:
        sess.last_raw, sess.last_screen = None, None
        record({"session": session, "kind": "blocked", "reason": "sin_regla", "app": raw.get("app"),
                "model_saw": None, "detail": "pantalla sin política: no sale",
                "ms": {"core": _ms(t0), "adapter": adapter_ms, "model": None}})
        return {"denied": "sin_regla", "detail": no_policy_detail(sess.adapter)}
    obs, counts = observe_screen(raw, screen, sess.vault, sess.budget_left, _detector(session))
    verdict = check(json.dumps(obs, ensure_ascii=False))
    if not verdict["allowed"]:
        sess.last_raw, sess.last_screen = None, None
        record({"session": session, "kind": "blocked", "reason": "fuga", "app": raw.get("app"),
                "screen": screen.id, "detail": "observe: " + ", ".join(verdict["findings"]),
                "ms": {"core": _ms(t0), "adapter": adapter_ms, "model": None}})
        return {"denied": "fuga", "detail": "La pantalla tenía datos sin tokenizar y no sale"}
    sess.last_raw, sess.last_screen, sess.last_paused = raw, screen, obs["paused"]
    events.publish({"type": "screen", "session": session, "raw": raw, "observed": obs})  # solo local
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
    base = {"session": session, "model_saw": saw, "tokens": T.find(text or ""),
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
    t0 = time.perf_counter()
    result = _oracle.ask(SESSIONS.get(session), op, list(args))
    base = {"session": session, "model_saw": f"oracle {op} " + " ".join(args),
            "tokens": [a for a in args if T.parse(a)],
            "ms": {"core": _ms(t0), "adapter": None, "model": None}}
    if "denied" in result:
        record({**base, "kind": "blocked", "reason": result["denied"], "detail": result["detail"]})
    else:
        record({**base, "kind": "oracle", "detail": str(result.get("tramo") or result["result"])})
    return result
