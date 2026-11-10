"""Modo replay sin claves (#14): las dos escenas de la demo con el núcleo real.

    python -m core.replay            # las dos escenas
    python -m core.replay b2b        # factura del proveedor (Alba Core y correo)
    python -m core.replay b2c        # saldo y transferencia en Banca Alcor

Usa el bucle del agente de agent/ tal cual (ReplayModel, servidor MCP en el
proceso y run_agent) con respuestas grabadas en core/replays/. Las pantallas
son las escenas en memoria de core/scenes.py; el núcleo (bóveda, políticas,
detector, procedencia, confirmación, bloqueo final, auditoría) es el real.

La orden de la persona pasa por core.tokenize_text antes de llegar al bucle.
Una persona simulada aprueba lo retenido y pone la huella. Al final se
comprueba que ninguna petición al modelo llevaba valores reales y que la
auditoría verifica.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import anyio
from mcp import Client

import core
from core.audit import Audit, load_or_create_key, verify
from core.scenes import SCENES

ROOT = Path(__file__).resolve().parent.parent
REPLAY_LOG = ROOT / "audit" / "replay.jsonl"

REPLAYS = ROOT / "core" / "replays"
TITLES = {"b2b": "B2B · factura del proveedor", "b2c": "B2C · saldo y transferencia"}


def say(msg: str = "") -> None:
    print(msg, file=sys.stderr, flush=True)


def persona(session: str):
    """Lo que hace la persona en la demo: confirma lo retenido antes de la siguiente pantalla."""
    def approve_pending() -> None:
        for req in core.pending(session):
            frase = " ".join(s.get("text") or s.get("token", "") for s in req["summary"])
            say(f"    8 pide confirmación: «{frase}» · persona: «confirmo»")
            core.approve({"type": "approval_result", "id": req["id"], "ok": True, "via": "voz", "by": "persona"})
    return approve_pending


async def run_scene(name: str) -> dict:
    from agent.agent import ReplayModel, run_agent
    from agent.core_adapter import build_real_core
    from agent.server import build_server

    session = name
    scene = SCENES[name]()
    scene.before_snapshot = persona(session)
    core.connect(session, scene)

    model = ReplayModel(REPLAYS / f"{name}.json")
    task = core.tokenize_text(session, model.task)  # lo que dice la persona, sin datos
    agent_core = build_real_core()
    say(f"\n== {TITLES[name]} ==\n   persona: {model.task}\n   al modelo: {task}\n")
    async with Client(build_server(agent_core)) as client:
        result = await run_agent(client, model, agent_core, task, session=session, log=say)

    leaks = [i for i, req in enumerate(model.requests, 1)
             if not core.check(json.dumps(req, ensure_ascii=False))["allowed"]]
    vault = core.SESSIONS.get(session).vault
    events = [e for e in core.AUDIT.events if e["session"] == session]
    kinds = {k: sum(1 for e in events if e["kind"] == k) for k in ("observe_sent", "act", "held", "approval", "blocked")}
    say(f"\n   8 dice (renderizado en local): {vault.render(result.final_text or '')}")
    say(f"   estado={result.status} · pasos={result.steps} · peticiones al modelo={len(model.requests)} "
        f"· con valores reales={len(leaks)}")
    say("   auditoría: " + " · ".join(f"{k}={v}" for k, v in kinds.items()))
    say(f"   acciones reales en pantalla: {len(scene.log)}")
    return {"scene": name, "status": result.status, "leaks": len(leaks), **kinds}


async def main_async(names: list[str]) -> int:
    results = [await run_scene(n) for n in names]
    ok = all(r["status"] == "done" and r["leaks"] == 0 for r in results)
    if core.AUDIT.path:
        lines = core.AUDIT.path.read_text(encoding="utf-8").splitlines()
        errors = verify(lines, core.AUDIT.public_key)
        say(f"\nRegistro firmado {core.AUDIT.path.relative_to(ROOT)}: "
            + ("OK, " + str(len(lines)) + " líneas" if not errors else f"MAL: {errors[0]}"))
        ok = ok and not errors
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    names = [a for a in argv if a in SCENES] or list(SCENES)
    if os.environ.get("PRIV8_AUDIT", "").lower() != "off":
        # Registro propio de esta ejecución, firmado con la clave local del núcleo.
        REPLAY_LOG.parent.mkdir(parents=True, exist_ok=True)
        REPLAY_LOG.write_text("", encoding="utf-8")
        key = load_or_create_key(Path(os.environ.get("PRIV8_AUDIT_KEY", str(ROOT / "audit" / "priv8.key"))))
        core.AUDIT = Audit(REPLAY_LOG, key)
    return anyio.run(main_async, names)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
