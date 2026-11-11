"""Métricas B2C (#46): «¿cuánto tengo?» y la transferencia al bróker, con y sin protocolo.

    uv run python -m metrics.b2c

Misma forma que metrics/b2b.py (#22), sobre la escena b2c (Banca Alcor) y su replay:

- Datos al modelo: valores del seed (identificadores, nombres y saldos de los bancos)
  que aparecen en todo lo enviado al modelo.
- Voz: cada frase de 8 pasa por voice/segmenter.py. Con protocolo, a ElevenLabs solo
  va el texto «cloud» y las cifras y nombres los lee la voz local. Sin protocolo, la
  frase ya rellenada iría entera a ElevenLabs. En los dos casos se cuentan las frases
  cuyo texto para la nube lleva algo sensible según PatternLeakCheck (patrones, cualquier
  cifra y valores del seed). Las frases son el texto de cada respuesta del modelo y la
  frase de confirmación del núcleo.
- Tareas completadas.

La línea base sin protocolo reutiliza el mismo guion grabado: completa la tarea por
construcción y no bloquea nada. Todo en local, sin API.
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import anyio
from mcp import Client

from metrics.b2b import exposed

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
OUT = Path(__file__).resolve().parent / "out" / "b2c.json"
SCENE = "b2c"


def seed_values() -> list[str]:
    """known() del seed más los saldos de los bancos, que en B2C son el dato principal."""
    from check_seed import known, load
    seed = load()
    values = {v for _, v in known(seed)}
    for banco in seed["bancos"].values():
        if isinstance(banco, dict):
            values.update(c["saldo"] for c in banco.get("cuentas", []))
    return sorted(values)


class _VaultTable:
    """Lo que VaultRenderer espera (una tabla token → valor) sobre la bóveda de la sesión."""

    def __init__(self, vault):
        self._vault = vault

    def get(self, token: str, default=None):
        return self._vault.value(token) or default


def _speech(lines: list[str], vault, values: list[str]) -> dict[str, Any]:
    from voice.leak_check import PatternLeakCheck
    from voice.segmenter import VaultRenderer, segment

    check = PatternLeakCheck(known_values=values)
    render = VaultRenderer(_VaultTable(vault))
    cloud_with, cloud_without, local, blocked = [], [], 0, 0
    for n, line in enumerate(lines, 1):
        u = segment(line, render, utterance=f"u{n}", session=SCENE, leak_check=check)
        blocked += int(u.blocked)
        cloud_with += [s.text for s in u.segments if s.voice == "cloud"]
        local += sum(1 for s in u.segments if s.voice == "local" and s.token)
        cloud_without.append(vault.render(line))

    def leaks(texts: list[str]) -> tuple[int, list[str]]:
        found = [check.check(t) for t in texts]
        return sum(1 for f in found if f), sorted({x.kind for f in found for x in f})

    (n_with, k_with), (n_without, k_without) = leaks(cloud_with), leaks(cloud_without)
    return {"utterances": len(lines), "local_segments": local, "kept_local": blocked,
            "cloud_with": cloud_with, "cloud_without": cloud_without,
            "leaks_with": n_with, "kinds_with": k_with, "leaks_without": n_without, "kinds_without": k_without}


async def _with_protocol(values: list[str]) -> dict[str, Any]:
    import core
    from agent.agent import ReplayModel, run_agent
    from agent.core_adapter import build_real_core
    from agent.server import build_server
    from check_seed import known
    from core.replay import REPLAYS, persona
    from core.scenes import SCENES

    core.trust(known())
    scene = SCENES[SCENE]()
    raw_snaps: list[dict[str, Any]] = []
    # La persona confirma como en core/replay.py; la frase de confirmación también la dice 8.
    confirmations: list[str] = []
    approve = persona(SCENE)

    def persona_and_keep() -> None:
        for req in core.pending(SCENE):
            confirmations.append(" ".join(s.get("text") or s.get("token", "") for s in req["summary"]))
        approve()

    scene.before_snapshot = persona_and_keep
    orig = scene.snapshot

    def keep() -> dict[str, Any]:
        snap = orig()
        raw_snaps.append(snap)
        return snap

    scene.snapshot = keep  # type: ignore[method-assign]
    core.connect(SCENE, scene)
    model = ReplayModel(REPLAYS / f"{SCENE}.json")
    task = core.tokenize_text(SCENE, model.task)
    agent_core = build_real_core()
    async with Client(build_server(agent_core)) as client:
        result = await run_agent(client, model, agent_core, task, session=SCENE, log=lambda *_: None)

    # Lo que dice 8: el texto de cada respuesta del modelo (plantillas con tokens).
    lines = [b["text"] for r in model.responses for b in r["content"] if b["type"] == "text" and b["text"].strip()]
    lines += confirmations
    events = [e for e in core.AUDIT.events if e["session"] == SCENE]
    return {
        "exposed": sorted(set(exposed(model.requests, values))),
        "done": result.status == "done",
        "steps": result.steps,
        "blocked": dict(Counter(e.get("reason", "?") for e in events if e["kind"] == "blocked")),
        "speech": _speech(lines, core.SESSIONS.get(SCENE).vault, values),
        "raw_snaps": raw_snaps,
    }


def run() -> dict[str, Any]:
    values = seed_values()
    prot = anyio.run(_with_protocol, values)
    raw_exposed = sorted(set(exposed(prot.pop("raw_snaps"), values)))
    sp = prot["speech"]
    return {
        "scene": SCENE,
        "seed_values": len(values),
        "utterances": sp["utterances"],
        "with_protocol": {
            "data_to_model": len(prot["exposed"]), "values": prot["exposed"],
            "utterances_with_data_to_elevenlabs": sp["leaks_with"], "finding_kinds": sp["kinds_with"],
            "elevenlabs_text": sp["cloud_with"],
            "local_voice_segments": sp["local_segments"], "utterances_kept_local": sp["kept_local"],
            "tasks_completed": int(prot["done"]), "steps": prot["steps"],
            "blocked_by_reason": prot["blocked"],
        },
        "without_protocol": {
            "data_to_model": len(raw_exposed), "values": raw_exposed,
            "utterances_with_data_to_elevenlabs": sp["leaks_without"], "finding_kinds": sp["kinds_without"],
            "elevenlabs_text": sp["cloud_without"],
            "local_voice_segments": 0, "utterances_kept_local": 0,
            "tasks_completed": 1, "steps": prot["steps"], "blocked_by_reason": {},
        },
    }


def table(r: dict[str, Any]) -> str:
    w, wo = r["with_protocol"], r["without_protocol"]
    rows = [("Metric", "Without protocol", "With protocol"),
            ("Seed values reaching the model", wo["data_to_model"], w["data_to_model"]),
            ("Utterances with data to ElevenLabs", wo["utterances_with_data_to_elevenlabs"],
             w["utterances_with_data_to_elevenlabs"]),
            ("Figures and names by local voice", wo["local_voice_segments"], w["local_voice_segments"]),
            ("Tasks completed", wo["tasks_completed"], w["tasks_completed"])]
    out = [f"{a:<36}{b!s:>18}{c!s:>16}" for a, b, c in rows]
    out.append(f"Utterances: {r['utterances']} - blocked by reason: "
               + json.dumps(w["blocked_by_reason"], ensure_ascii=False))
    return "\n".join(out)


def main() -> int:
    os.environ.setdefault("PRIV8_AUDIT", "off")
    r = run()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(r, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(table(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
