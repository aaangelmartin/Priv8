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


def falta(msgs: list[dict[str, Any]], comprueba: list[str]) -> str | None:
    """None si los mensajes grabados cumplen cada comprobación; si no, la primera que falla."""
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
    if any(e.get("kind") == "blocked" and e.get("reason") == "presupuesto" for e in ev):
        return "el oráculo se queda sin preguntas"
    return None


# ------------------------------------------------------------------ pares de fotogramas (#187)
#
# En una sesión web grabada, «Lo que ves tú» (la pestaña real) y «Lo que ve el modelo» (la vista
# de 8) son la misma pantalla en el mismo instante: el adaptador las captura juntas y las emite en
# un solo mensaje (frame con vista "8", `par` y la real en `real`). En priv8-sesion/1 van juntas:
#
#   pares: [{at, par, real: {src, w, h, app, par}, ocho: {src, w, h, app, screen, fresh, paused, par, ...}}]
#
# Las grabaciones anteriores tenían dos listas sueltas (los fotogramas de la vista de 8 dentro de
# `eventos` y la pestaña real en `real`). migrar() las empareja: cada fotograma real con el de la
# vista de 8 más cercano en el tiempo, sin volver nunca atrás; el par lleva `dt` (segundos entre
# los dos originales) y la sesión `migrado: true`. Android no tiene vista de 8 (el modelo se
# dibuja con los mensajes screen): sus capturas siguen en `real` y no se tocan.
# apps/console/src/reproductor.js hace lo mismo al reproducir una grabación antigua.

PAR_DT_MAX = 0.6  # en una grabación migrada, lo más separados que pueden estar los dos de un par (s)


def _es_vista8(m: dict[str, Any]) -> bool:
    return m.get("type") == "frame" and m.get("vista") != "real"


def emparejar(vistas: list[dict[str, Any]], reales: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pares de dos listas sueltas: vistas [{at, msg}] (frames de la vista de 8) y reales
    [{at, src, w, h, app}]. Cada real con la vista más cercana en el tiempo (el índice nunca
    retrocede); el par sale cuando ya existen los dos (at = el mayor). Sin reales, cada vista sola."""
    vs = sorted(vistas, key=lambda e: e["at"])
    rs = sorted(reales, key=lambda r: r["at"])
    out: list[dict[str, Any]] = []
    if not rs:
        for n, v in enumerate(vs, 1):
            out.append({"at": v["at"], "par": n, "real": None, "ocho": {**v["msg"], "par": n}})
        return out
    if not vs:
        return []
    k = 0
    for r in rs:
        while k + 1 < len(vs) and abs(vs[k + 1]["at"] - r["at"]) <= abs(vs[k]["at"] - r["at"]):
            k += 1
        v = vs[k]
        n = len(out) + 1
        at = max(r["at"], v["at"], out[-1]["at"] if out else 0.0)
        real = {kk: vv for kk, vv in r.items() if kk != "at"}
        out.append({"at": round(at, 3), "par": n, "dt": round(v["at"] - r["at"], 3),
                    "real": {**real, "par": n}, "ocho": {**v["msg"], "par": n}})
    return out


def migrar(d: dict[str, Any]) -> dict[str, Any]:
    """Una sesión del formato anterior (dos listas sueltas) con sus fotogramas en pares. Las que
    ya tienen `pares`, y las que no tienen vista de 8 (Android, provisionales), tal cual."""
    if isinstance(d.get("pares"), list):
        return d
    ev = d.get("eventos") or []
    vistas = [e for e in ev if _es_vista8(e.get("msg") or {})]
    if not vistas:
        return d
    pares = emparejar(vistas, d.get("real") or [])
    return {**d, "eventos": [e for e in ev if not _es_vista8(e.get("msg") or {})], "real": [],
            "pares": pares, "migrado": True}


def pares_incoherentes(d: dict[str, Any]) -> str | None:
    """None si cada momento de la sesión enseña las dos pantallas del mismo paso; si no, por qué.

    - Ningún fotograma de la vista de 8 suelto en `eventos` ni pestaña real suelta junto a pares.
    - Cada par: la vista de 8 y, si hay pestaña real, la del mismo id de par, del mismo tamaño.
    - Los pares en orden (at y par crecientes).
    - En una grabación migrada, los dos originales a menos de PAR_DT_MAX segundos."""
    ev = d.get("eventos") or []
    sueltos = [e for e in ev if (e.get("msg") or {}).get("type") == "frame"]
    pares = d.get("pares")
    if pares is None:
        if any(_es_vista8(e["msg"]) for e in sueltos):
            return "fotogramas de la vista de 8 sueltos en eventos (sin pares)"
        return None  # Android o sin fotogramas: el modelo se dibuja con los mensajes screen
    if sueltos:
        return f"{len(sueltos)} fotogramas sueltos en eventos además de los pares"
    if d.get("real"):
        return "pestaña real suelta además de los pares"
    prev_at, prev_par = -1.0, 0
    for i, p in enumerate(pares):
        o, r = p.get("ocho"), p.get("real")
        if not isinstance(o, dict) or not o.get("src"):
            return f"el par {i} no tiene la vista de 8"
        if r is not None and not (isinstance(r, dict) and r.get("src")):
            return f"el par {i} tiene la pestaña real vacía"
        n = p.get("par")
        if not isinstance(n, int) or n <= prev_par:
            return f"el par {i} no tiene un id creciente"
        if o.get("par") != n or (r is not None and r.get("par") != n):
            return f"el par {i} junta fotogramas de pasos distintos ({o.get('par')} y {(r or {}).get('par')})"
        if r is not None and not d.get("migrado") and (r.get("w"), r.get("h")) != (o.get("w"), o.get("h")):
            return f"el par {i} junta pantallas de distinto tamaño"
        if not isinstance(p.get("at"), (int, float)) or p["at"] < prev_at:
            return f"el par {i} va antes que el anterior"
        if d.get("migrado") and abs(p.get("dt") or 0) > PAR_DT_MAX:
            return f"el par {i} junta fotogramas a {abs(p['dt']):.2f} s"
        prev_at, prev_par = p["at"], n
    return None
