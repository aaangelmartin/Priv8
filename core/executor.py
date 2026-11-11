"""Ejecutor: el modelo escribe tokens, el ejecutor pone el valor real en pantalla.

Antes de tocar la pantalla comprueba, en este orden:
1. Que haya pantalla observada y el elemento exista en ella.
2. Que el agente no esté en pausa (la persona se autentica) y que el elemento
   no sea rojo, una contraseña ni algo que solo pulsa la persona.
3. Que todos los tokens del texto existan en la bóveda de la sesión.
4. Procedencia y destino (#10): un hueco que rellena `provenance`.
5. Confirmación humana (#12): un hueco que rellena `confirm`.
Después rehidrata en local y llama a adapter.perform().
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .policies import Rule
from .session import Session

OPS = {"tap", "type", "key", "scroll", "open_app", "back", "send", "call"}
NEEDS_TARGET = {"tap", "type", "send"}
NEEDS_TEXT = {"type", "key", "open_app", "call"}

# hook(session, op, element, rule, text) -> act_result con denied/held, o None para seguir
Hook = Callable[[Session, str, dict | None, Rule | None, str | None], dict | None]


def denied(reason: str, detail: str) -> dict[str, Any]:
    return {"denied": reason, "detail": detail}


def execute(sess: Session, op: str, target: str | None = None, text: str | None = None,
            direction: str | None = None, *, provenance: Hook | None = None,
            confirm: Hook | None = None) -> dict[str, Any]:
    if op not in OPS:
        return denied("sin_regla", f"operación desconocida: {op}")
    if op in NEEDS_TARGET and not target:
        return denied("sin_regla", f"{op} necesita target")
    if op in NEEDS_TEXT and not text:
        return denied("sin_regla", f"{op} necesita text")
    if sess.adapter is None:
        return denied("sin_regla", "la sesión no tiene adaptador conectado")
    if sess.last_paused:
        return denied("rojo", f"en pausa ({sess.last_paused}): lo está haciendo la persona; "
                              "espera y vuelve a observar")
    if sess.last_raw is None or sess.last_screen is None:
        return denied("sin_regla", "observa la pantalla antes de actuar")

    el, rule = None, None
    if target:
        el = sess.element(target)
        if el is None:
            return denied("sin_regla", f"{target} no está en la última pantalla: observa de nuevo")
        rule = sess.last_screen.rule_for(el)
        if el.get("password") or (rule and rule.cls == "rojo"):
            return denied("rojo", "ese campo nunca lo toca el agente: lo rellena la persona")
        if rule and rule.solo_persona:
            return denied("rojo", "ese control lo pulsa la persona")

    if text:
        unknown = sess.vault.unknown_tokens(text)
        if unknown:
            return denied("token_desconocido", f"tokens que no existen en esta sesión: {', '.join(unknown)}")

    for hook in (provenance, confirm):
        if hook is not None:
            verdict = hook(sess, op, el, rule, text)
            if verdict is not None:
                return verdict

    action: dict[str, Any] = {"op": op}
    if target:
        action["target"] = target
    if text is not None:
        action["text"] = sess.vault.render(text)  # valor real, solo en local
    if direction:
        action["direction"] = direction
    result = sess.adapter.perform(action)
    if result.get("ok"):
        return {"ok": True}
    return denied("adaptador", f"el adaptador no pudo: {result.get('error', 'otro')}")
