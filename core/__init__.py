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
    frame(session, f)               fotograma de la pantalla real, con las cajas de la última
                                    observación, solo a la consola local (#147)

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
    # Pantalla real en la consola (#147): el adaptador que sabe capturar recibe dónde
    # mandar los fotogramas y cómo saber si alguien mira.
    if hasattr(adapter, "on_frame"):
        adapter.on_frame = lambda f, s=session: frame(s, f)
        adapter.watching = events.frame_watchers
    # Vista de 8 y los ojos de 8 en la ventana (#154): el adaptador web censura su copia con
    # lo que vio el modelo y pasa el mismo bloqueo final; todo dentro del proceso.
    if hasattr(adapter, "on_core_event"):
        vault = SESSIONS.get(session).vault
        adapter.session = session
        adapter.p8_render = vault.value
        adapter.p8_render_text = vault.render
        adapter.p8_secrets = lambda v=vault: [*v.values(), *(x for _, x in TRUSTED)]
        adapter.p8_check = lambda text: check(text)
        adapter.p8_mask = lambda text, s=session: mask_text(s, text)
        adapter.p8_preview = lambda raw, s=session: preview(s, raw)
        old = getattr(adapter, "_p8_unsubscribe", None)
        if callable(old):
            old()
        adapter._p8_unsubscribe = events.subscribe(adapter.on_core_event)


def trust(known: list[tuple[str, str]]) -> None:
    global LEAK
    TRUSTED.extend(known)
    LEAK = LeakCheck(STORE, known=TRUSTED)


def _detector(session: str) -> FinanceDetector:
    return FinanceDetector(known=TRUSTED, vault=SESSIONS.get(session).vault)


def _squash(s: str) -> str:
    return "".join(s.split()).casefold()


def mask_text(session: str, text: str) -> list[list[Any]] | None:
    """Texto de interfaz para la vista de 8 (#154): None si no lleva nada sensible y sale tal
    cual; si no, sus partes [["t", texto], ["tok", token], ["x", largo]]. Cada dato que encuentra
    el detector (IBAN, DNI/NIE, tarjeta, teléfono, correo, importes, nombres, valores de la
    bóveda y de confianza) va como su token si la bóveda ya lo tiene, o como marcador. Si lo que
    queda aún no pasa el bloqueo final, el texto entero es un marcador. No crea tokens."""
    if not text or not text.strip():
        return None
    spans = sorted(_detector(session)(text), key=lambda s: s.start)
    if not spans:
        return None if check(text)["allowed"] else [["x", len(text.strip())]]
    tokens = {_squash(e.value): e.token for e in SESSIONS.get(session).vault.entries()}
    parts: list[list[Any]] = []
    pos = 0
    for s in spans:
        if s.start < pos:
            continue
        if s.start > pos:
            parts.append(["t", text[pos:s.start]])
        tok = tokens.get(_squash(text[s.start:s.end])) if s.tipo != "ROJO" else None
        parts.append(["tok", tok] if tok else ["x", s.end - s.start])
        pos = s.end
    if pos < len(text):
        parts.append(["t", text[pos:]])
    plain = " ".join(p[1] for p in parts if p[0] == "t")
    if not check(plain)["allowed"]:
        return [["x", len(text.strip())]]
    return parts


def preview(session: str, raw: dict[str, Any]) -> dict[str, Any] | None:
    """Lo que vería el modelo de `raw` si 8 lo observara ahora, solo para la vista de 8 (#154):
    la misma clasificación que observe(), sin mandarla al modelo, sin auditoría y sin tocar la
    última observación. None si la pantalla no tiene política o no pasa el bloqueo final (la
    vista de 8 la tapa con el detector). Con pausa, la observación vacía y su motivo."""
    sess = SESSIONS.get(session)
    paused = pause_before_policy(raw)
    if paused:
        return {"session": session, "app": raw.get("app", ""), "screen": raw.get("screen"), "seq": raw.get("seq", 0),
                "paused": paused, "elements": [], "budget_left": sess.budget_left}
    screen = policies().screen_for(raw)
    if screen is None:
        return None
    obs, _ = observe_screen(raw, screen, sess.vault, sess.budget_left, _detector(session), leak=check)
    return obs if check(json.dumps(obs, ensure_ascii=False))["allowed"] else None


def tokenize_text(session: str, text: str, origen: str = "titular") -> str:
    """Lo que dice o escribe la persona, con sus datos cambiados por tokens, antes de ir a Claude."""
    vault = SESSIONS.get(session).vault
    out, red = _replace_spans(text, _detector(session)(text), vault, origen)
    return out if not red else "[la persona dijo un dato que nunca sale]"


# ---- pantalla real en la consola (#147) ----

def frame(session: str, f: dict[str, Any]) -> dict[str, Any] | None:
    """Un fotograma de la pantalla real, al canal local de fotogramas (nunca a la auditoría).

    f lo da el adaptador: {app, w, h, img (base64), mime, boxes: {id: [l, t, r, b]},
    where: {campo: valor}}. w y h son el espacio de las cajas (px CSS en web, px del
    móvil en Android), no el tamaño de la imagen. `where` dice en qué pantalla está
    (url en web; app y screen en Android): si coincide con la última observación, las
    cajas llevan la clase y los tokens que vio el modelo; si no, `fresh` es false y la
    consola tapa la pantalla entera en «lo que ve 8» (aún no la ha leído)."""
    sess = SESSIONS.get(session)
    sess.extra["frame_in"] = f  # para volver a mandarlo cuando 8 lea la pantalla (una página quieta no repinta)
    obs, seen = sess.last_obs, sess.extra.get("obs_where") or {}
    where = f.get("where") or {}
    fresh = bool(obs and obs.get("app") == f.get("app")
                 and all(seen.get(k) == v for k, v in where.items()))
    rects: list[dict[str, Any]] = []
    vista = f.get("vista") == "8"  # web (#154): la vista de 8 ya viene censurada en el DOM, sin cajas
    if fresh and not vista:
        boxes = f.get("boxes") or {}
        for el in obs.get("elements", []):
            b = boxes.get(el.get("id"))
            if not b or len(b) != 4 or b[2] <= b[0] or b[3] <= b[1]:
                continue
            toks = el.get("tokens") or []
            rects.append({"id": el["id"], "x": int(b[0]), "y": int(b[1]), "w": int(b[2] - b[0]),
                          "h": int(b[3] - b[1]), "cls": el.get("cls", "verde"),
                          "token": toks[0] if toks else None,
                          # lo que leyó el modelo de ese elemento: tokens, nunca valores
                          "text": None if el.get("cls") == "rojo" else
                          (el.get("text") if el.get("text") is not None else el.get("label"))})
    msg = {"type": "frame", "session": session, "app": f.get("app") or "",
           "screen": obs.get("screen") if fresh else None,
           "paused": (obs.get("paused") if fresh else None), "fresh": fresh,
           "w": int(f["w"]), "h": int(f["h"]), "mime": f.get("mime", "image/jpeg"),
           "img": f["img"], "rects": rects}
    if vista:
        msg["vista"] = "8"
        # Pares (#187): la pestaña real del mismo instante (lo que ves tú, #170) va en el mismo
        # mensaje, con el mismo id, para que la consola nunca enseñe una sin la otra.
        if f.get("par") is not None:
            msg["par"] = int(f["par"])
        r = f.get("real")
        if isinstance(r, dict) and isinstance(r.get("img"), str):
            msg["real"] = {"app": r.get("app") or msg["app"], "w": int(r["w"]), "h": int(r["h"]),
                           "mime": r.get("mime", "image/jpeg"), "img": r["img"]}
    events.publish_frame(msg)  # solo local, como screen.raw
    return msg


def _seen(sess: Any, raw: dict[str, Any], obs: dict[str, Any]) -> None:
    """La última pantalla que vio el modelo y dónde estaba, para casar los fotogramas."""
    sess.last_obs = obs
    sess.extra["obs_where"] = {k: raw.get(k) for k in ("app", "url", "screen")}
    f = sess.extra.get("frame_in")
    if f is not None and events.frame_watchers():  # la consola ve la censura al momento
        try:
            frame(sess.id, f)
        except Exception:  # noqa: BLE001 - la consola nunca para al agente
            pass


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
    note = getattr(sess.adapter, "note_action", None)
    if callable(note):
        note({k: v for k, v in p.action.items() if k in ("op", "target", "text")})
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
        _seen(sess, raw, obs)
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
        sess.last_raw, sess.last_screen, sess.last_obs = None, None, None
        record({"session": session, "kind": "blocked", "reason": "sin_regla", "app": raw.get("app"),
                "model_saw": None, "detail": "pantalla sin política: no sale",
                "ms": {"core": _ms(t0), "adapter": adapter_ms, "model": None}})
        return {"denied": "sin_regla", "detail": no_policy_detail(sess.adapter)}
    obs, counts = observe_screen(raw, screen, sess.vault, sess.budget_left, _detector(session), leak=check)
    verdict = check(json.dumps(obs, ensure_ascii=False))
    if not verdict["allowed"]:
        sess.last_raw, sess.last_screen, sess.last_obs = None, None, None
        record({"session": session, "kind": "blocked", "reason": "fuga", "app": raw.get("app"),
                "screen": screen.id, "detail": "observe: " + ", ".join(verdict["findings"]),
                "ms": {"core": _ms(t0), "adapter": adapter_ms, "model": None}})
        return {"denied": "fuga", "detail": "La pantalla tenía datos sin tokenizar y no sale"}
    sess.last_raw, sess.last_screen, sess.last_paused = raw, screen, obs["paused"]
    _seen(sess, raw, obs)
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
