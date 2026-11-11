"""One owner per audit event: a replay over a real core leaves each event once.

The real core (`core/`) records its own observe_sent, act, held, approval,
oracle and blocked events. Before this test the MCP server recorded them again,
so with PRIV8_CORE=real every tool call appeared twice in the signed log.

The stub below is a `core` module with the five functions of 'Lo que el núcleo
expone', backed by `FakeCore`, which records its own events the same way.
"""

from __future__ import annotations

import json
import sys
import types
from collections import Counter

import pytest
from mcp import Client

from agent.agent import ReplayModel, run_agent
from agent.core_adapter import build_real_core
from agent.fakes import SEED, FakeCore, FakeLeakCheck
from agent.server import build_server
from conftest import REPLAY

TOOL_EVENTS = {"observe_sent", "act", "held", "oracle", "blocked"}


def make_recording_core() -> tuple[types.ModuleType, FakeCore]:
    fake = FakeCore()
    leak = FakeLeakCheck(fake.vault, red_values=[SEED["clave"]])
    mod = types.ModuleType("core")
    mod.observe = fake.observe
    mod.act = fake.act
    mod.oracle = fake.oracle
    mod.record = fake.audit.record

    def check(payload):
        v = leak.check(payload)
        return {"allowed": v.ok, "findings": list(v.matched)}

    mod.check = check
    return mod, fake


@pytest.fixture
def recording_core(monkeypatch):
    mod, fake = make_recording_core()
    monkeypatch.setitem(sys.modules, "core", mod)
    return fake


def _identity(event: dict) -> str:
    """An event without what the log adds. A double record shows up as two equal neighbours."""
    body = {k: v for k, v in event.items() if k not in ("seq", "ts", "prev", "hash", "sig", "ms")}
    return json.dumps(body, sort_keys=True, ensure_ascii=False)


def _adjacent_twins(events: list[dict]) -> list[int]:
    ids = [_identity(e) for e in events]
    return [i for i in range(1, len(ids)) if ids[i] == ids[i - 1]]


async def test_replay_over_real_core_records_each_event_once(recording_core):
    fake = recording_core
    core = build_real_core()
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task)
    assert result.status == "done"

    events = fake.audit.events
    calls = Counter(c["name"] for c in result.tool_calls)
    kinds = Counter(e["kind"] for e in events)

    # One core event per tool call, never one from the core and one from the server.
    assert kinds["observe_sent"] == calls["observe"]
    assert kinds["oracle"] == calls["oracle"]
    direct = [e for e in events if e["kind"] == "act" and "confirm" not in e]
    approved = [e for e in events if e["kind"] == "act" and "confirm" in e]
    assert len(direct) + kinds["held"] + kinds["blocked"] == calls["act"]
    # A held action runs once, after the person approves it.
    assert len(approved) == kinds["held"] == kinds["approval"]
    assert {e["confirm"] for e in approved} == {e["confirm"] for e in events if e["kind"] == "held"}

    # The loop owns task events: start, one per model step, end.
    assert kinds["task"] == result.steps + 2
    assert set(kinds) <= TOOL_EVENTS | {"approval", "task"}
    # The final answer is recorded once (in its step event); the end event only marks the end.
    if result.final_text:
        said = [e for e in events if e["kind"] == "task" and e.get("model_saw") == result.final_text]
        assert len(said) == 1
    assert not [e for e in events if e["kind"] == "task"][-1].get("model_saw")

    # No event appears twice and the single chain still verifies.
    assert _adjacent_twins(events) == []
    assert fake.audit.verify()
    # The adapter mirror keeps only what the agent side recorded.
    assert {e["kind"] for e in core.audit.events} == {"task"}


async def test_fake_core_path_records_each_event_once(world):
    core, fake = world
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task)
    calls = Counter(c["name"] for c in result.tool_calls)
    kinds = Counter(e["kind"] for e in fake.audit.events)
    assert kinds["observe_sent"] == calls["observe"]
    assert kinds["oracle"] == calls["oracle"]
    assert _adjacent_twins(fake.audit.events) == []
