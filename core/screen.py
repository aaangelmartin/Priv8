"""Snapshot crudo → observación tokenizada (observation.schema.json).

Aplica la política de la pantalla, el detector (si lo hay) y la bóveda. Lo
rojo sale con text = None y nunca entra en la bóveda. El bloqueo final (#9)
revisa el resultado antes de que salga.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Protocol

from . import tokens as T
from .policies import Rule, Screen
from .vault import Vault


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
                      detect: Detector) -> dict[str, Any]:
    rule = screen.rule_for(el)
    label = T.neutralize(el["label"]) if el.get("label") else el.get("label")
    text = T.neutralize(el["text"]) if el.get("text") else el.get("text")
    out: dict[str, Any] = {"id": el["id"], "role": el["role"]}

    # La etiqueta es interfaz, pero también puede llevar datos ("Ver movimientos de Lucía").
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
                   detect: Detector | None = None) -> tuple[dict[str, Any], dict[str, int]]:
    """Devuelve (observación, recuento por clase)."""
    detect = detect or no_detector
    elements = [transform_element(el, screen, vault, detect) for el in raw.get("elements", [])]
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
