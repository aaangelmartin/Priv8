"""A tokenized snapshot reaches the model, and no seed value ever does."""

from __future__ import annotations

import json

from mcp import Client

from agent import ReplayModel, run_agent
from conftest import REPLAY, seed_leaks
from fakes import SEED, _el
from server import build_server


async def _run_replay(core):
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, "registrar factura")
    return model, result


async def test_observe_returns_tokens_not_values(world):
    core, _ = world
    async with Client(build_server(core)) as client:
        r = await client.call_tool("observe", {"session": "s1"})
    snap = r.structured_content
    assert snap["screen"] == "factura.alta"
    by_id = {e["id"]: e for e in snap["elements"]}
    assert by_id["e10"]["text"] == "‹IBAN_1·maestro›" and by_id["e10"]["cls"] == "ambar"
    assert "‹IBAN_2·correo›" in by_id["e5"]["text"]
    assert by_id["e12"]["text"] is None and by_id["e12"]["cls"] == "rojo"
    assert by_id["e13"]["cls"] == "verde"
    assert seed_leaks(r.structured_content) == []
    assert seed_leaks([c.text for c in r.content]) == []


async def test_tokenized_snapshot_reaches_the_model(world):
    core, _ = world
    model, result = await _run_replay(core)
    assert result.status == "done"
    second = json.dumps(model.requests[1], ensure_ascii=False)
    assert "‹IBAN_1·maestro›" in second and "‹PROVEEDOR_1·correo›" in second


async def test_no_seed_value_in_any_model_bound_payload(world):
    core, _ = world
    model, _ = await _run_replay(core)
    assert len(model.requests) == 6
    for request in model.requests:
        assert seed_leaks(request) == [], request


async def test_audit_log_shows_only_tokens_and_verifies(world):
    core, fake = world
    await _run_replay(core)
    model_facing = [{k: e.get(k) for k in ("model_saw", "tokens", "detail")}
                    for e in fake.audit.events]
    assert seed_leaks(model_facing) == []
    assert fake.audit.verify()


async def test_final_block_stops_an_untokenized_value(world):
    core, fake = world
    original = fake.adapter.snapshot

    def leaky_snapshot():
        snap = original()
        # A value no policy knows: the tokenizer misses it, the final block must not.
        snap["elements"].append(_el("e99", "text", None, "Pagar a ES28 1465 0100 9417 9846 5321"))
        return snap

    fake.adapter.snapshot = leaky_snapshot
    async with Client(build_server(core)) as client:
        r = await client.call_tool("observe", {"session": "s1"})
    assert r.structured_content["denied"] == "fuga"
    assert "ES28" not in json.dumps(r.structured_content)
    blocked = fake.audit.events[-1]
    assert blocked["kind"] == "blocked" and blocked["reason"] == "fuga"


async def test_agent_holds_a_request_with_a_real_value(world):
    core, fake = world
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, f"Paga a {SEED['iban_maestro']}")
    assert result.status == "blocked"
    assert model.requests == []  # nothing left for Claude
    assert fake.audit.events[-1]["reason"] == "fuga"
