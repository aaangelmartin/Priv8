"""Feeds de la consola para el arranque de la demo (#45): el mismo trámite con y sin protocolo.

    uv run python -m metrics.feeds        # make sin-protocolo

Ejecuta la escena B2B de metrics/b2b.py (núcleo real, respuestas grabadas, sin API)
y guarda lo que el núcleo publica a la consola en dos feeds:

- apps/console/public/con-protocolo.json: los mensajes tal cual (el modelo ve tokens).
- apps/console/public/sin-protocolo.json: lo que recibiría el modelo sin Priv8. Cada
  pantalla va en bruto en el lado de la IA, con los valores del seed que lleva marcados
  y la cuenta acumulada; las acciones llevan los valores reales. Sin protocolo no hay
  oráculo, bloqueos ni confirmaciones, así que esos mensajes no están.

La cuenta final de valores del seed es la de `make metrics` (without_protocol.data_to_model).
Se abren con ?feed=con-protocolo y ?feed=sin-protocolo. Cada mensaje lleva `at`, el
segundo en que la consola lo reproduce.
"""

from __future__ import annotations

import copy
import json
import os
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from metrics import b2b

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "apps" / "console" / "public"

# Ritmo de reproducción (s): cuánto se espera antes de cada mensaje según su tipo.
PAUSA = {"screen": 1.4, "observe_sent": 0.35, "act": 0.6, "oracle": 0.9, "blocked": 1.3,
         "confirm_request": 0.9, "held": 0.25, "approval_result": 1.7, "approval": 0.25, "task": 1.0, "fin": 1.5}
PAUSA_SIN = {**PAUSA, "screen": 2.4, "observe_sent": 0.5, "act": 0.9}


def capture() -> tuple[list[dict[str, Any]], dict[str, Any], Callable[[str], str]]:
    """Ejecuta la escena con protocolo y devuelve los mensajes de la consola, las métricas y el render local."""
    import core
    from core import events

    msgs: list[dict[str, Any]] = []
    stop = events.subscribe(lambda m: msgs.append(copy.deepcopy(m)))
    try:
        result = b2b.run()
    finally:
        stop()
    vault = core.SESSIONS.get(b2b.SCENE).vault
    return msgs, result, vault.render


def _paso(m: dict[str, Any]) -> str:
    return m["event"]["kind"] if m["type"] == "audit" else m["type"]


def _tareas(msgs: list[dict[str, Any]]) -> tuple[int | None, int | None]:
    """Índices de la orden inicial y del mensaje final de 8 (el resto de `task` son pasos internos)."""
    idx = [i for i, m in enumerate(msgs) if m["type"] == "audit" and m["event"]["kind"] == "task"]
    return (idx[0], idx[-1]) if idx else (None, None)


def _cronometrar(feed: list[dict[str, Any]], pausa: dict[str, float]) -> list[dict[str, Any]]:
    t, out = 0.6, []
    for m in feed:
        t += pausa.get(_paso(m), 0.8)
        out.append({"at": round(t, 2), "msg": m})
    return out


def con_protocolo(msgs: list[dict[str, Any]], result: dict[str, Any], values: list[str]) -> list[dict[str, Any]]:
    first, last = _tareas(msgs)
    keep = [m for i, m in enumerate(msgs)
            if m["type"] in ("screen", "confirm_request", "approval_result")
            or (m["type"] == "audit" and (m["event"]["kind"] != "task" or i in (first, last)))]
    vistos: set[str] = set()
    for m in keep:  # la cuenta de la consola sale de lo observado, no se da por hecha
        if m["type"] == "screen":
            vistos |= set(b2b.exposed(m["observed"], values))
            m["total"] = len(vistos)
    w = result["with_protocol"]
    # Los bloqueos se cuentan en los mensajes de esta ejecución: la auditoría en memoria
    # del núcleo acumula los de ejecuciones anteriores en el mismo proceso.
    bloqueos = sum(1 for m in keep if m["type"] == "audit" and m["event"]["kind"] == "blocked")
    keep.append({"type": "fin", "protocolo": True, "valores_al_modelo": w["data_to_model"],
                 "bloqueos": bloqueos, "pasos": w["steps"]})
    return _cronometrar(keep, PAUSA)


def _en_claro(el: dict[str, Any], values: list[str]) -> list[str]:
    texto = " ".join(str(el.get(k) or "") for k in ("label", "text"))
    return [v for v in values if v in texto]


def sin_protocolo(msgs: list[dict[str, Any]], result: dict[str, Any], render: Callable[[str], str],
                  values: list[str]) -> list[dict[str, Any]]:
    first, _ = _tareas(msgs)
    feed: list[dict[str, Any]] = []
    vistos: list[str] = []
    for i, m in enumerate(msgs):
        if m["type"] == "screen":
            raw = m["raw"]
            els = []
            for e in raw.get("elements", []):
                claro = _en_claro(e, values)
                els.append({"id": e["id"], "role": e["role"], "label": e.get("label"), "text": e.get("text"),
                            "cls": "claro" if claro else "verde", "claro": claro})
            aqui = sorted({v for e in els for v in e["claro"]})
            vistos += [v for v in aqui if v not in vistos]
            observed = {"app": m["observed"]["app"], "screen": m["observed"].get("screen"), "elements": els}
            feed.append({"type": "screen", "session": m["session"], "protocolo": False, "raw": raw,
                         "observed": observed, "en_claro": aqui, "total": len(vistos)})
        elif m["type"] == "audit":
            e = dict(m["event"])
            e.pop("ms", None)  # sin núcleo no hay latencia del núcleo
            if e["kind"] == "observe_sent":
                prev = feed[-1] if feed and feed[-1]["type"] == "screen" else None
                e["counts"] = None
                e["claro"] = len(prev["en_claro"]) if prev else 0
            elif e["kind"] == "act" or (e["kind"] == "task" and i == first):
                if e.get("model_saw"):
                    e["model_saw"] = render(e["model_saw"])
            else:
                continue  # oráculo, bloqueos, retenciones y aprobaciones son del protocolo
            feed.append({"type": "audit", "event": e})
    wo = result["without_protocol"]
    if set(vistos) != set(wo["values"]):
        raise ValueError(f"el feed sin protocolo no cuadra con metrics/b2b.py: {vistos} != {wo['values']}")
    feed.append({"type": "fin", "protocolo": False, "valores_al_modelo": len(vistos), "valores": vistos,
                 "bloqueos": wo["injections_blocked"], "pasos": wo["steps"]})
    return _cronometrar(feed, PAUSA_SIN)


def build() -> dict[str, list[dict[str, Any]]]:
    msgs, result, render = capture()
    values = b2b.seed_values()
    return {"con-protocolo": con_protocolo(msgs, result, values), "sin-protocolo": sin_protocolo(msgs, result, render, values)}


def main() -> int:
    os.environ.setdefault("PRIV8_AUDIT", "off")
    feeds = build()
    for name, feed in feeds.items():
        path = PUBLIC / f"{name}.json"
        path.write_text(json.dumps(feed, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        fin = feed[-1]["msg"]
        print(f"{path.relative_to(ROOT)}: {len(feed)} mensajes · {feed[-1]['at']:.1f} s · "
              f"{fin['valores_al_modelo']} valores del seed al modelo · {fin['bloqueos']} bloqueos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
