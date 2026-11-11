"""Spend limits: a task stops when it reaches its budget, and the session stops all later tasks."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from agent import agent as A


def _resp(tin, tout, uses=True):
    usage = SimpleNamespace(input_tokens=tin, output_tokens=tout,
                            cache_creation_input_tokens=0, cache_read_input_tokens=0)
    content = ([SimpleNamespace(type="tool_use", id="t1", name="observe", input={"session": "s1"})]
               if uses else [SimpleNamespace(type="text", text="Hecho.")])
    return SimpleNamespace(stop_reason="tool_use" if uses else "end_turn", content=content, usage=usage)


def test_cost_from_usage():
    r = _resp(1_000_000, 100_000)
    assert A.cost_usd(r, "claude-haiku-5-5") == pytest.approx(0.10 + 0.05)
    assert A.cost_usd(r, "modelo-desconocido") == pytest.approx(4.0 + 2.0)  # the dearest row
    assert A.cost_usd(SimpleNamespace(), "claude-haiku-5-5") == 0.0


def test_dolares_sin_punto_medio():
    assert A._dolares(0.5) == "0,50 $"


from mcp import Client  # noqa: E402

from agent.agent import ReplayModel, run_agent, write_replay  # noqa: E402
from agent.server import build_server  # noqa: E402


class _Costly(ReplayModel):
    """A replay whose every response costs `usd` (input tokens only, Haiku prices)."""

    def __init__(self, path, usd):
        super().__init__(path)
        self.model = "claude-haiku-5-5"
        self._tin = int(usd / 0.10 * 1_000_000)

    async def create(self, **kw):
        r = await super().create(**kw)
        r = dict(r) if isinstance(r, dict) else r
        if isinstance(r, dict):
            r["usage"] = {"input_tokens": self._tin, "output_tokens": 0}
        return r


def _replay(tmp_path):
    use = {"type": "tool_use", "id": "t0", "name": "observe", "input": {"session": "s1"}}
    path = tmp_path / "r.json"
    write_replay(path, "registrar factura", [
        {"stop_reason": "tool_use", "content": [use]},
        {"stop_reason": "tool_use", "content": [dict(use, id="t1")]},
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Listo."}]},
    ])
    return path


async def test_task_stops_at_its_budget(world, tmp_path, monkeypatch):
    core, _ = world
    monkeypatch.setattr(A, "TASK_BUDGET_USD", 0.05)
    monkeypatch.setitem(A.SPENT, "session", 0.0)
    model = _Costly(_replay(tmp_path), usd=0.03)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task)
    assert result.status == "budget" and result.steps == 2
    assert "límite de gasto" in result.final_text and "0,05 $" in result.final_text


async def test_session_budget_blocks_the_next_task(world, tmp_path, monkeypatch):
    core, _ = world
    monkeypatch.setattr(A, "SESSION_BUDGET_USD", 0.50)
    monkeypatch.setitem(A.SPENT, "session", 0.50)
    model = _Costly(_replay(tmp_path), usd=0.01)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task)
    assert result.status == "budget" and result.steps == 0 and model.requests == []
