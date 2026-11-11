"""Snapshot crudo → observación tokenizada (observation.schema.json).

Aplica la política de la pantalla, el detector (si lo hay) y la bóveda. Lo
rojo sale con text = None y nunca entra en la bóveda. El bloqueo final (#9)
revisa el resultado antes de que salga.

Modo estricto (#177, por defecto): solo sale el texto que cubre una regla del sitio (o la
regla de la pantalla, sin_regla: ambar). Un texto suelto de la página sin regla no entra en
la observación, y un elemento marcado sin regla sale con su rol, su etiqueta y sus acciones,
pero sin su texto. En modo permisivo (#154), lo uno y lo otro pasan por el detector.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Protocol

from . import tokens as T
from .policies import Rule, Screen
from .vault import Vault


INICIALES = re.compile(r"[A-ZÁÉÍÓÚÑÜ]{1,3}")  # texto suelto de 1 a 3 mayúsculas: iniciales, verde


@dataclass(frozen=True)
class Span:
    """Un dato encontrado por el detector en un texto."""

    start: int
    end: int
    tipo: str  # tipo de token, o "ROJO" para lo que nunca sale
    origen: str | None = None


class Detector(Protocol):
    def __call__(self, text: str) -> list[Span]: ...


def no_detector(text: str) -> list[Span]:
    return []


def _replace_spans(text: str, spans: list[Span], vault: Vault, origen: str | None,
                   rasgo_signo: bool = True) -> tuple[str | None, bool]:
    """Sustituye cada span por su token. Devuelve (texto, hay_rojo)."""
    if any(s.tipo == "ROJO" for s in spans):
        return None, True
    out, pos = [], 0
    for s in sorted(spans, key=lambda s: s.start):
        if s.start < pos:  # solapado con el anterior: ya tapado
            continue
        out.append(text[pos:s.start])
        out.append(vault.tokenize(s.tipo, text[s.start:s.end], s.origen or origen,
                                  rasgo_signo=rasgo_signo))
        pos = s.end
    out.append(text[pos:])
    return "".join(out), False


def _apply_rule(text: str, rule: Rule, vault: Vault, origen: str | None) -> str:
    o = rule.origen or origen
    if rule.extract:
        m = re.search(rule.extract, text)
        if m and m.group(1).strip():
            tok = vault.tokenize(rule.tipo, m.group(1), o, rule.rasgo_signo)
            return text[:m.start(1)] + tok + text[m.end(1):]
    return vault.tokenize(rule.tipo, text, o, rule.rasgo_signo)


def transform_element(el: dict[str, Any], screen: Screen, vault: Vault,
                      detect: Detector, estricto: bool = True) -> dict[str, Any]:
    rule = screen.rule_for(el)
    label = T.neutralize(el["label"]) if el.get("label") else el.get("label")
    text = T.neutralize(el["text"]) if el.get("text") else el.get("text")
    out: dict[str, Any] = {"id": el["id"], "role": el["role"]}

    # La etiqueta es interfaz, pero también puede llevar datos ("Ver movimientos de Ángel").
    if label:
        label, red = _replace_spans(label, detect(label), vault, screen.origen)
        if red:
            label = None

    if el.get("password") or (rule and rule.cls == "rojo"):
        cls, text = "rojo", None
    elif rule and rule.cls == "ambar":
        cls = "ambar"
        if text and text.strip():
            text = _apply_rule(text, rule, vault, screen.origen)
    elif rule:  # verde por regla: la regla manda, pero el detector también mira
        cls = "verde"
        if text:
            text, red = _replace_spans(text, detect(text), vault, screen.origen)
            if red:
                cls = "rojo"
    elif estricto and (el.get("extra") or screen.sin_regla != "ambar"):
        # Modo estricto (#177): ninguna regla cubre este texto, así que no sale. El elemento
        # se queda (se puede tocar o escribir en él) pero el modelo no sabe qué dice.
        cls, text = "verde", None
    elif el.get("extra"):
        # Texto suelto de la página (#154): sin regla, siempre el detector, sea cual sea la
        # pantalla. Lo que encuentra va con su token (ámbar) o no sale (rojo); lo demás, verde.
        cls = "verde"
        if text and INICIALES.fullmatch(text.strip()):
            pass  # las iniciales de un avatar («SL», «CP») no son un dato
        elif text:
            text, red = _replace_spans(text, detect(text), vault, screen.origen)
            if red:
                cls, text = "rojo", None
    elif screen.sin_regla == "ambar":
        cls = "ambar" if text and text.strip() else "verde"
        if cls == "ambar":
            text = vault.tokenize("CODIGO", text, screen.origen)
    else:
        cls = "verde"
        if text and screen.detector:
            text, red = _replace_spans(text, detect(text), vault, screen.origen)
            if red:
                cls = "rojo"

    toks = list(dict.fromkeys(T.find(label or "") + T.find(text or "")))
    if cls == "verde" and toks:
        cls = "ambar"
    out["label"] = label
    out["text"] = text
    out["cls"] = cls
    if toks:
        out["tokens"] = toks
    if el.get("actions"):
        out["actions"] = list(el["actions"])
    return out


def paused_reason(raw: dict[str, Any], screen: Screen) -> str | None:
    if raw.get("system_dialog"):
        return "dialogo_sistema"
    if screen.paused:
        return screen.paused
    focus = raw.get("focus")
    if focus:
        for el in raw.get("elements", []):
            if el.get("id") == focus and (el.get("password") or el.get("sel") in screen.pause_on_focus):
                return "autenticacion"
    return None


def observe_screen(raw: dict[str, Any], screen: Screen, vault: Vault, budget_left: int,
                   detect: Detector | None = None,
                   leak: Any = None, estricto: bool = True) -> tuple[dict[str, Any], dict[str, int]]:
    """Devuelve (observación, recuento por clase).

    leak(texto) -> {"allowed": bool}: el bloqueo final por elemento para los textos sueltos
    (#154). Uno que no lo pasa no sale (rojo, sin texto) en vez de tumbar la pantalla entera.
    estricto: solo lo que cubre una regla (#177); False es el modo permisivo (#154)."""
    detect = detect or no_detector
    todos = raw.get("elements", [])
    # Modo estricto: un texto suelto sin regla del sitio ni siquiera entra en la observación.
    raws = [el for el in todos if not (estricto and el.get("extra") and screen.rule_for(el) is None)]
    done: dict[int, dict[str, Any]] = {}
    # Primero lo marcado (sus reglas llenan la bóveda: el proveedor del PDF, el IBAN del correo)
    # y después los textos sueltos, para que el detector ya reconozca esos valores en ellos.
    for i, el in enumerate(raws):
        if not el.get("extra"):
            done[i] = transform_element(el, screen, vault, detect, estricto)
    # Lo que las reglas del sitio tapan en un elemento marcado tampoco sale suelto en otro sitio
    # de la página (el remitente del correo repetido en la cabecera): mismo tipo de token.
    tapados: list[tuple[str, str]] = []
    for i, el in enumerate(raws):
        out = done.get(i)
        if out and out["cls"] != "verde" and el.get("text"):
            p = T.parse((out.get("tokens") or [""])[0])
            tapados.append((" ".join(str(el["text"]).split()).casefold(), p.tipo if p else "CODIGO"))
    for i, el in enumerate(raws):
        if el.get("extra"):
            out = transform_element(el, screen, vault, detect, estricto)
            plano = " ".join((out.get("text") or "").split())
            if out["cls"] == "verde" and len(plano) >= 8:
                tipo = next((t for real, t in tapados if plano.casefold() in real), None)
                if tipo:
                    tok = vault.tokenize(tipo, plano, screen.origen)
                    out = {**out, "cls": "ambar", "text": tok, "tokens": [tok]}
            if leak is not None and out["cls"] != "rojo":
                if not leak(" ".join(x for x in (out.get("label"), out.get("text")) if x))["allowed"]:
                    out = {**out, "cls": "rojo", "text": None, "label": None}
                    out.pop("tokens", None)
            done[i] = out
    elements = [done[i] for i in range(len(raws))]
    counts = {"verde": 0, "ambar": 0, "rojo": 0}
    for e in elements:
        counts[e["cls"]] += 1
    obs = {
        "session": vault.session,
        "app": raw["app"],
        "screen": screen.id,
        "seq": raw.get("seq", 0),
        "paused": paused_reason(raw, screen),
        "elements": elements,
        "budget_left": budget_left,
    }
    return obs, counts
