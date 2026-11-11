"""Lo que comparten los grabadores de los casos de la demo (#187): el catálogo y las comprobaciones.

El catálogo es data/casos.json. Cada caso dice qué debe pasar en una grabación buena
(`comprueba`); como el modelo no siempre sigue el flujo ensayado, el grabador repite el
intento si no pasa.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CASOS = ROOT / "data" / "casos.json"


def casos(vertical: str | None = None) -> list[dict[str, Any]]:
    todos = json.loads(CASOS.read_text(encoding="utf-8"))["casos"]
    return [c for c in todos if vertical is None or c["vertical"] == vertical]


def caso(id_: str) -> dict[str, Any]:
    for c in casos():
        if c["id"] == id_:
            return c
    raise SystemExit(f"No hay ningún caso {id_!r} en data/casos.json")


def grabables(vertical: str) -> list[dict[str, Any]]:
    """Los que se graban con el agente (los que tienen pedido y una sesión propia)."""
    return [c for c in casos(vertical) if c.get("pedido") and str(c.get("feed", "")).startswith("sesion-")]


def _audit(msgs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [m["event"] for m in msgs if m.get("type") == "audit"]


def falta(msgs: list[dict[str, Any]], comprueba: list[str], *, estricto: bool = True) -> str | None:
    """None si los mensajes grabados cumplen cada comprobación; si no, la primera que falla. Con
    `estricto` (al grabar) además rechaza un oráculo sin preguntas."""
    ev = _audit(msgs)
    pantallas = [m.get("observed") or {} for m in msgs if m.get("type") == "screen"]
    for c in comprueba:
        if c == "confirmacion" and not any(m.get("type") == "confirm_request" for m in msgs):
            return "no pide confirmación"
        if c == "aprobada" and not any(e.get("kind") == "approval" and e.get("approved_by") for e in ev):
            return "no hay aprobación en el registro"
        if c.startswith("bloqueo:") and not any(e.get("kind") == "blocked" and e.get("reason") == c.split(":", 1)[1] for e in ev):
            return f"no hay bloqueo {c.split(':', 1)[1]}"
        if c == "oraculo" and not any(e.get("kind") == "oracle" for e in ev):
            return "no pregunta al oráculo"
        if c == "pausa" and not any(p.get("paused") for p in pantallas):
            return "8 no mira a otro lado en ninguna pantalla"
        if c == "rojo" and not any(el.get("cls") == "rojo" for p in pantallas for el in p.get("elements", [])):
            return "ninguna pantalla tiene un dato rojo"
    if estricto and any(e.get("kind") == "blocked" and e.get("reason") == "presupuesto" for e in ev):
        return "el oráculo se queda sin preguntas"
    return None
