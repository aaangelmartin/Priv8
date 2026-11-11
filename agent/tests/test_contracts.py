"""Payloads validate against contracts v1 (docs/contracts/, PR #58).

The schemas are not vendored. They are loaded from PRIV8_CONTRACTS_DIR, or from
<repo>/docs/contracts by default; the tests skip if neither exists (before PR
#58 is merged into this branch). To run them against the PR branch:

    git archive origin/docs/4-contratos-v1 docs/contracts | tar -x -C /tmp/priv8
    PRIV8_CONTRACTS_DIR=/tmp/priv8/docs/contracts uv run pytest
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from mcp import Client
from referencing import Registry, Resource

from agent.agent import ReplayModel, run_agent
from conftest import AGENT_DIR, REPLAY
from agent.fakes import build_fake_core
from agent.server import _VALIDATORS, TOOL_DEFS, build_server

CONTRACTS = Path(os.environ.get("PRIV8_CONTRACTS_DIR") or AGENT_DIR.parent / "docs" / "contracts")
BASE_URI = "https://priv8.dev/contracts/"

pytestmark = pytest.mark.skipif(not (CONTRACTS / "tools.schema.json").is_file(),
                                reason=f"contracts v1 not found at {CONTRACTS} (PR #58); set PRIV8_CONTRACTS_DIR")


@pytest.fixture(scope="module")
def schema():
    registry = Registry().with_resources(
        (BASE_URI + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )

    def validator(name: str, definition: str | None = None) -> Draft202012Validator:
        ref = BASE_URI + name + (f"#/$defs/{definition}" if definition else "")
        return Draft202012Validator({"$ref": ref}, registry=registry)

    return validator


def _assert_valid(validator: Draft202012Validator, payload: object) -> None:
    errors = list(validator.iter_errors(payload))
    assert not errors, f"{errors[0].message} in {json.dumps(payload, ensure_ascii=False)[:300]}"


async def _replay_world():
    core, fake = build_fake_core()
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, "registrar factura")
        # A few more shapes: denied, sum, matches, held without approval.
        extra = [
            ("act", {"session": "s1", "op": "type", "target": "e10", "text": "‹IBAN_2-correo›"}),
            ("act", {"session": "s1", "op": "type", "target": "e6", "text": "‹PROVEEDOR_9-correo›"}),
            ("oracle", {"session": "s1", "op": "sum", "args": ["‹IMPORTE_1-positivo›", "‹IMPORTE_2-positivo›"]}),
            ("oracle", {"session": "s1", "op": "matches", "args": ["‹IBAN_1-maestro›", "‹IBAN_2-correo›"]}),
            ("act", {"session": "s1", "op": "scroll", "direction": "down"}),
        ]
        for name, args in extra:
            r = await client.call_tool(name, args)
            result.tool_calls.append({"name": name, "input": args, "result": r.structured_content})
    return result, fake


async def test_tool_inputs_and_results_match_tools_schema(schema):
    result, _ = await _replay_world()
    assert result.status == "done"
    for call in result.tool_calls:
        _assert_valid(schema("tools.schema.json", f"{call['name']}_input"), call["input"])
        _assert_valid(schema("tools.schema.json", f"{call['name']}_result"), call["result"])


async def test_observe_returns_observation_schema(schema):
    result, _ = await _replay_world()
    observations = [c["result"] for c in result.tool_calls if c["name"] == "observe"]
    assert len(observations) == 2
    for obs in observations:
        _assert_valid(schema("observation.schema.json"), obs)


async def test_audit_events_match_audit_schema(schema):
    _, fake = await _replay_world()
    kinds = {e["kind"] for e in fake.audit.events}
    assert {"task", "observe_sent", "act", "oracle", "held", "approval", "blocked"} <= kinds
    for event in fake.audit.events:
        _assert_valid(schema("audit.schema.json"), event)
    assert fake.audit.events[0]["prev"] == "sha256:" + "0" * 64
    assert fake.audit.verify()


def test_fake_adapter_snapshot_matches_snapshot_schema(schema):
    _, fake = build_fake_core()
    _assert_valid(schema("snapshot.schema.json"), fake.adapter.snapshot())


@pytest.mark.parametrize("tool", ["observe", "act", "oracle"])
def test_tools_json_accepts_the_contract_examples(tool):
    examples = sorted((CONTRACTS / "examples").glob(f"tools.{tool}_input.*.json"))
    invalid = sorted((CONTRACTS / "examples" / "invalid").glob(f"tools.{tool}_input.*.json"))
    assert examples, f"no contract examples for {tool}_input"
    for path in examples:
        assert _VALIDATORS[tool].is_valid(json.loads(path.read_text(encoding="utf-8"))), path.name
    for path in invalid:
        assert not _VALIDATORS[tool].is_valid(json.loads(path.read_text(encoding="utf-8"))), path.name


def test_tools_json_properties_match_the_contract():
    contract = json.loads((CONTRACTS / "tools.schema.json").read_text(encoding="utf-8"))["$defs"]
    for tool in TOOL_DEFS:
        mine, theirs = tool["input_schema"], contract[f"{tool['name']}_input"]
        assert set(mine["properties"]) == set(theirs["properties"]), tool["name"]
        assert set(mine["required"]) == set(theirs["required"]), tool["name"]
        assert mine["additionalProperties"] is False and theirs["additionalProperties"] is False
