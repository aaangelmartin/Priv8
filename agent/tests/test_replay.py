"""Replay of «registrar factura» completes with only observe, act and oracle."""

from __future__ import annotations

import json

import pytest
from mcp import Client

from agent import agent as agent_mod
from agent.agent import ReplayExhausted, ReplayModel, run_agent, write_replay
from conftest import REPLAY
from agent.fakes import SEED
from agent.server import build_server


async def test_replay_registers_the_invoice(world):
    core, fake = world
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task)

    assert result.status == "done" and result.steps == 6
    assert {c["name"] for c in result.tool_calls} == {"observe", "act", "oracle"}
    assert fake.adapter.screen == "factura.registrada"
    assert fake.adapter.registered == {
        "factura.proveedor": SEED["proveedor"],
        "factura.cif": SEED["cif"],
        "factura.numero": SEED["factura"],
        "factura.importe": SEED["importe_correo"],
        "pago.iban": SEED["iban_maestro"],
    }
    assert "‹FACTURA_1-correo›" in result.final_text

    steps = [e for e in fake.audit.events if e["kind"] == "task" and e.get("detail", "").startswith("paso ")]
    assert [int(e["detail"].split()[1]) for e in steps] == [1, 2, 3, 4, 5, 6]
    assert all("model" in e["ms"] for e in steps)
    assert fake.audit.verify()


async def test_step_limit_stops_the_loop(world):
    core, fake = world
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task, max_steps=2)
    assert result.status == "step_limit"
    assert fake.adapter.screen == "factura.alta"
    assert fake.audit.events[-1]["detail"].startswith("límite de pasos")


async def test_short_replay_fails_loudly(world, tmp_path):
    core, _ = world
    data = json.loads(REPLAY.read_text(encoding="utf-8"))
    short = tmp_path / "short.json"
    write_replay(short, data["task"], data["responses"][:2])
    async with Client(build_server(core)) as client:
        with pytest.raises(ReplayExhausted):
            await run_agent(client, ReplayModel(short), core, "registrar factura")


def test_replay_cli_runs_without_api_key(monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert agent_mod.main(["--replay", str(REPLAY)]) == 0
    assert "‹FACTURA_1-correo›" in capsys.readouterr().out


def test_live_request_shape(monkeypatch):
    """The live path sends the documented request; no network call is made."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-not-a-key")
    live = agent_mod.AnthropicModel()
    seen = {}

    class Done:
        stop_reason = "end_turn"
        content = []

    async def fake_create(**kwargs):
        seen.update(kwargs)
        return Done()

    monkeypatch.setattr(live.client.beta.messages, "create", fake_create)
    import anyio

    anyio.run(lambda: live.create(system="s", messages=[{"role": "user", "content": "x"}], tools=[]))
    assert seen["model"] == "claude-opus-5-5"
    assert seen["thinking"] == {"type": "adaptive"}
    assert seen["output_config"] == {"effort": "high"}
    assert "tool_choice" not in seen
