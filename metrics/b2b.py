"""Métricas B2B (#22): la escena de la factura con y sin protocolo, en local y sin API.

    uv run python -m metrics.b2b

Con protocolo: el replay b2b de core/replay.py sobre el núcleo real; se cuentan los
valores del seed que aparecen en todo lo enviado al modelo y los eventos bloqueados.
Sin protocolo: las mismas pantallas en bruto (los valores reales) irían al modelo
sin tokenizar; se cuentan los valores del seed que quedan expuestos. La línea base
asume el mismo guion grabado, así que completa la tarea por construcción y no
bloquea nada.
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any

import anyio
from mcp import Client

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
OUT = Path(__file__).resolve().parent / "out" / "b2b.json"
SCENE = "b2b"


def seed_values() -> list[str]:
    from check_seed import known
    return sorted({v for _, v in known()})


def exposed(payload: Any, values: list[str]) -> list[str]:
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return [v for v in values if v in text]


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
    raw_ms = 0.0
    scene.before_snapshot = persona(SCENE)
    orig = scene.snapshot

    def timed() -> dict[str, Any]:
        nonlocal raw_ms
        t0 = time.perf_counter()
        snap = orig()
        raw_ms += (time.perf_counter() - t0) * 1000
        raw_snaps.append(snap)
        return snap

    scene.snapshot = timed  # type: ignore[method-assign]
    core.connect(SCENE, scene)
    model = ReplayModel(REPLAYS / f"{SCENE}.json")
    task = core.tokenize_text(SCENE, model.task)
    agent_core = build_real_core()
    t0 = time.perf_counter()
    async with Client(build_server(agent_core)) as client:
        result = await run_agent(client, model, agent_core, task, session=SCENE, log=lambda *_: None)
    total_ms = (time.perf_counter() - t0) * 1000

    events = [e for e in core.AUDIT.events if e["session"] == SCENE]
    blocked = Counter(e.get("reason", "?") for e in events if e["kind"] == "blocked")
    return {
        "exposed": sorted(set(exposed(model.requests, values))),
        "done": result.status == "done",
        "steps": result.steps,
        "added_ms_per_step": round(max(total_ms - raw_ms, 0.0) / max(result.steps, 1), 2),
        "blocked": dict(blocked),
        "raw_snaps": raw_snaps,
    }


def run() -> dict[str, Any]:
    values = seed_values()
    prot = anyio.run(_with_protocol, values)
    raw_exposed = sorted(set(exposed(prot.pop("raw_snaps"), values)))
    return {
        "scene": SCENE,
        "seed_values": len(values),
        "with_protocol": {
            "data_to_model": len(prot["exposed"]), "values": prot["exposed"],
            "tasks_completed": int(prot["done"]), "steps": prot["steps"],
            "added_ms_per_step": prot["added_ms_per_step"],
            "injections_blocked": sum(n for r, n in prot["blocked"].items() if r in ("destino", "fuga")), "blocked_by_reason": prot["blocked"],
        },
        "without_protocol": {
            "data_to_model": len(raw_exposed), "values": raw_exposed,
            "tasks_completed": 1, "steps": prot["steps"],
            "added_ms_per_step": 0.0, "injections_blocked": 0, "blocked_by_reason": {},
        },
    }


def table(r: dict[str, Any]) -> str:
    w, wo = r["with_protocol"], r["without_protocol"]
    rows = [("Metric", "Without protocol", "With protocol"),
            ("Seed values reaching the model", wo["data_to_model"], w["data_to_model"]),
            ("Tasks completed", wo["tasks_completed"], w["tasks_completed"]),
            ("Added latency (ms/step)", wo["added_ms_per_step"], w["added_ms_per_step"]),
            ("Injections blocked", wo["injections_blocked"], w["injections_blocked"])]
    out = [f"{a:<34}{b!s:>18}{c!s:>16}" for a, b, c in rows]
    out.append("Blocked by reason: " + json.dumps(w["blocked_by_reason"], ensure_ascii=False))
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
