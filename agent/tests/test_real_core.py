"""The agent CLI and MCP server over the real core (`core/`) and its demo scenes, end to end."""

from __future__ import annotations

import importlib
import json
import re
from collections import Counter
from pathlib import Path

import pytest
from mcp import Client

from agent import agent as agent_mod
from agent.agent import ReplayModel, run_agent
from agent.core_adapter import build_real_core, mount_scene, tokenize_task
from agent.server import build_server

ROOT = Path(__file__).resolve().parents[2]
REPLAYS = ROOT / "core" / "replays"
CORE_KINDS = ("observe_sent", "act", "held", "approval", "oracle", "blocked")


@pytest.fixture
def real():
    """A fresh real core: sessions, vaults, confirmations and audit start empty."""
    from core import events

    events.clear()
    import core

    return importlib.reload(core)


def seeds() -> list[str]:
    from core import scenes as s

    values = [s.PROVEEDOR, s.CIF, s.IBAN_MAESTRO, s.IBAN_TRAMPA, s.TEL_FICHA, s.TEL_CORREO, s.FACTURA,
              s.IMPORTE, s.CORREO_PROVEEDOR, s.TITULAR, *s.NIMBO, *s.MARTA, "200 €"]
    return values + [x for c in s.CUENTAS for x in c[2:]]


def seed_leaks(payload: object) -> list[str]:
    flat = re.sub(r"\s+", "", json.dumps(payload, ensure_ascii=False, default=str)).lower()
    return [v for v in seeds() if re.sub(r"\s+", "", v).lower() in flat]


@pytest.mark.parametrize("scene, expected", [
    ("b2b", {"observe_sent": 8, "act": 10, "held": 3, "approval": 3, "oracle": 1, "blocked": 2}),
    # v1.1: la observación durante la confirmación de 8 se registra como pausa, no como envío
    ("b2c", {"observe_sent": 4, "paused": 1, "act": 5, "held": 1, "approval": 1, "oracle": 1}),
])
async def test_replay_over_real_core(real, scene, expected):
    mount_scene(scene, scene, simulated_persona=True)
    model = ReplayModel(REPLAYS / f"{scene}.json")
    task = tokenize_task(scene, model.task)
    core = build_real_core()
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, task, session=scene)

    assert result.status == "done"
    # Nothing real reaches Claude: not the task, not a tool result, not the system prompt.
    assert seed_leaks(model.requests) == []
    assert all(real.check(json.dumps(r, ensure_ascii=False, default=str))["allowed"] for r in model.requests)

    # One event per core call: observes, direct acts, holds, approvals and denials add up.
    events = [e for e in real.AUDIT.events if e["session"] == scene]
    kinds = Counter(e["kind"] for e in events if e["kind"] != "task")
    assert dict(kinds) == expected
    calls = Counter(c["name"] for c in result.tool_calls)
    assert kinds["observe_sent"] + kinds["paused"] == calls["observe"]
    assert kinds["oracle"] == calls["oracle"]
    assert kinds["act"] - kinds["approval"] + kinds["held"] + kinds["blocked"] == calls["act"]
    # The agent side records only its own task events in this case.
    assert {e["kind"] for e in core.audit.events} == {"task"}


def test_cli_defaults_to_real_core(real, monkeypatch, capsys):
    monkeypatch.delenv("PRIV8_CORE", raising=False)
    assert agent_mod.main(["--scene", "b2c", "--replay", str(REPLAYS / "b2c.json")]) == 0
    out = capsys.readouterr().out
    assert "‹SUMA_1›" in out and "15.462,58" not in out
    assert real.SESSIONS.get("b2c").adapter.page == "resultado"


def test_cli_without_simulated_persona_leaves_holds_to_the_person(real, monkeypatch):
    monkeypatch.delenv("PRIV8_CORE", raising=False)
    agent_mod.main(["--scene", "b2c", "--replay", str(REPLAYS / "b2c.json"), "--no-simulated-persona"])
    assert real.SESSIONS.get("b2c").adapter.page != "resultado"
    assert [p["id"] for p in real.pending("b2c")]


def test_scene_needs_the_real_core(monkeypatch, capsys):
    monkeypatch.setenv("PRIV8_CORE", "fake")
    assert agent_mod.main(["--scene", "b2b", "--replay", "agent/replays/registrar_factura.json"]) == 2
    assert "--scene needs PRIV8_CORE=real" in capsys.readouterr().err


def test_unknown_scene_is_refused(real):
    with pytest.raises(ValueError, match="scene"):
        mount_scene("s1", "erp")
