"""El mismo trámite sin protocolo (#45): lo que la consola mostraría si todo fuera en claro.

    uv run python -m metrics.sin_protocolo          # b2b y b2c
    uv run python -m metrics.sin_protocolo b2c      # una escena

Reproduce la escena de la demo con el núcleo real y las respuestas grabadas
(core/replay.py, sin API), escucha el canal de eventos (core/events.py) y escribe
esos mensajes como los vería la consola sin protocolo:

- `screen.observed`: los textos reales de la pantalla, sin tokens (todo «lo ve»).
- `audit.model_saw` y `voice`: los tokens cambiados por sus valores reales.
- Sin retenciones, confirmaciones ni bloqueos: sin protocolo no hay nada que pare
  al agente. Una acción bloqueada se queda como una acción normal (la trampa del
  IBAN del correo se escribiría). Tampoco hay registro firmado.
- Las frases del modelo son las grabadas con protocolo: en b2b, la última dice que
  pagó a la cuenta de la ficha aunque sin protocolo el campo llevaría la del correo.

Es la línea base de metrics/b2b.py y metrics/b2c.py en forma de mensajes: el mismo
guion grabado, no una ejecución con otro modelo. Sale en
metrics/out/sin-protocolo-<escena>.json con la forma de apps/console/public/demo.json
([{t, msg}]), para grabar el vídeo del arranque de la demo. Datos inventados del seed.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import anyio

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
OUT = Path(__file__).resolve().parent / "out"
TOKEN = re.compile(r"‹[^›]+›")
# Sin protocolo no existen: el agente no se para ni pide permiso.
SOLO_CON_PROTOCOLO = {"held", "approval", "blocked", "paused"}
FIRMA = ("prev", "hash", "sig")


def _render(texto: Any, valores: dict[str, str]) -> Any:
    if not isinstance(texto, str):
        return texto
    return TOKEN.sub(lambda m: valores.get(m.group(0), m.group(0)), texto)


def en_claro(msg: dict[str, Any], valores: dict[str, str]) -> dict[str, Any] | None:
    """Un mensaje del canal de eventos tal como iría sin protocolo, o None si no existiría."""
    tipo = msg.get("type")
    if tipo in ("confirm_request", "approval_result"):
        return None
    if tipo == "screen":
        raw = msg["raw"]
        reales = {e["id"]: e for e in raw.get("elements", [])}
        obs = dict(msg["observed"])
        elementos = []
        for e in obs.get("elements", []):
            r = reales.get(e["id"], {})
            nuevo = {k: v for k, v in e.items() if k != "tokens"}
            nuevo["text"] = r.get("text", _render(e.get("text"), valores))
            nuevo["label"] = r.get("label", _render(e.get("label"), valores))
            nuevo["cls"] = "verde"
            elementos.append(nuevo)
        obs["elements"] = elementos
        obs["paused"] = None
        return {**msg, "observed": obs}
    if tipo == "audit":
        ev = dict(msg["event"])
        if ev.get("kind") == "blocked" and ev.get("model_saw", "").startswith("act "):
            ev["kind"] = "act"  # sin el núcleo, la acción simplemente ocurre
            ev["detail"] = "sin protocolo nada lo para"
        elif ev.get("kind") in SOLO_CON_PROTOCOLO:
            return None
        for k in FIRMA + ("reason", "confirm"):
            ev.pop(k, None)
        ev["model_saw"] = _render(ev.get("model_saw"), valores)
        ev["tokens"] = []
        if "counts" in ev:
            total = sum(ev["counts"].values())
            ev["counts"] = {"verde": total, "ambar": 0, "rojo": 0}
        return {**msg, "event": ev}
    if tipo == "voice":
        m = json.loads(json.dumps(msg, ensure_ascii=False))
        for s in m.get("segments", []):
            if s.get("token"):
                s["text"], s["voice"] = valores.get(s["token"], s["token"]), "cloud"
                s.pop("token", None)
            s.pop("say_as", None)
        return m
    return msg


async def _capturar(escena: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    from check_seed import known

    import core
    from core import events
    from core.replay import run_scene

    core.trust(known())
    mensajes: list[dict[str, Any]] = []
    t0 = time.monotonic()
    quitar = events.subscribe(lambda m: mensajes.append({"t": round(time.monotonic() - t0, 2), "msg": m}))
    try:
        await run_scene(escena)
    finally:
        quitar()
    boveda = core.SESSIONS.get(escena).vault
    tokens = {t for m in mensajes for t in TOKEN.findall(json.dumps(m["msg"], ensure_ascii=False))}
    return mensajes, {t: boveda.value(t) for t in tokens if boveda.value(t) is not None}


def generar(escena: str) -> dict[str, Any]:
    mensajes, valores = anyio.run(_capturar, escena)
    claro = []
    for m in mensajes:
        nuevo = en_claro(m["msg"], valores)
        if nuevo is not None:
            claro.append({"t": m["t"], "msg": nuevo})
    texto = json.dumps(claro, ensure_ascii=False)
    al_modelo = [m["msg"]["event"]["model_saw"] for m in claro
                 if m["msg"].get("type") == "audit" and m["msg"]["event"].get("model_saw")]
    return {
        "escena": escena,
        "mensajes": claro,
        "con_protocolo": len(mensajes),
        "tokens_que_quedan": len(TOKEN.findall(texto)),
        "valores_reales_en_lo_que_ve_el_modelo": sorted(
            {v for v in valores.values() if any(v in s for s in al_modelo)}),
    }


def main(argv: list[str]) -> int:
    from core.scenes import SCENES

    os.environ.setdefault("PRIV8_AUDIT", "off")
    escenas = [a for a in argv if a in SCENES] or list(SCENES)
    OUT.mkdir(parents=True, exist_ok=True)
    for escena in escenas:
        r = generar(escena)
        destino = OUT / f"sin-protocolo-{escena}.json"
        destino.write_text(json.dumps(r["mensajes"], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{escena}: {len(r['mensajes'])} mensajes en claro (de {r['con_protocolo']} con protocolo), "
              f"{len(r['valores_reales_en_lo_que_ve_el_modelo'])} valores reales en lo que ve el modelo, "
              f"tokens que quedan: {r['tokens_que_quedan']} → {destino.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
