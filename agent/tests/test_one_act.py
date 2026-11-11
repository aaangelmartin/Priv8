"""One act that changes the screen per turn (#148): the loop runs the first, answers the rest."""

from __future__ import annotations

from mcp import Client

from agent.agent import NOT_RUN, SYSTEM, ReplayModel, run_agent, write_replay
from agent.server import build_server, host_instructions


def _use(i: int, name: str, **args: object) -> dict:
    return {"type": "tool_use", "id": f"t{i}", "name": name, "input": {"session": "s1", **args}}


async def _run(world, tmp_path, turn: list[dict]):
    core, fake = world
    path = tmp_path / "r.json"
    write_replay(path, "registrar factura", [
        {"stop_reason": "tool_use", "content": [_use(0, "observe")]},
        {"stop_reason": "tool_use", "content": turn},
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Listo."}]},
    ])
    model = ReplayModel(path)
    async with Client(build_server(core)) as client:
        result = await run_agent(client, model, core, model.task)
    results = model.requests[2]["messages"][-1]["content"]
    return result, fake, results


async def test_second_back_is_not_run(world, tmp_path):
    turn = [_use(1, "act", op="back"), _use(2, "act", op="back"), _use(3, "observe")]
    result, fake, results = await _run(world, tmp_path, turn)
    assert result.status == "done"
    assert [a["op"] for a in fake.adapter.performed] == ["back"]
    # every tool_use keeps its tool_result, in order; observe still runs after the skipped act
    assert [r["tool_use_id"] for r in results] == ["t1", "t2", "t3"]
    assert results[1] == {"type": "tool_result", "tool_use_id": "t2", "content": NOT_RUN, "is_error": True}
    assert "is_error" not in results[2]


async def test_taps_after_a_tap_are_not_run(world, tmp_path):
    turn = [_use(1, "act", op="tap", target="e4"), _use(2, "act", op="tap", target="e7"),
            _use(3, "act", op="type", target="e8", text="x")]
    _, fake, results = await _run(world, tmp_path, turn)
    assert [a["op"] for a in fake.adapter.performed] == ["tap"]
    assert [r["content"] for r in results[1:]] == [NOT_RUN, NOT_RUN]  # the rest of the turn too


async def test_typing_several_fields_and_oracle_still_batch(world, tmp_path):
    turn = [_use(1, "act", op="type", target="e8", text="‹FACTURA_1-correo›"),
            _use(2, "act", op="type", target="e9", text="‹IMPORTE_1-positivo›"),
            _use(3, "oracle", op="compare", args=["‹IMPORTE_1-positivo›", "‹IMPORTE_2-positivo›"]),
            _use(4, "act", op="tap", target="e13")]
    _, _, results = await _run(world, tmp_path, turn)
    assert NOT_RUN not in [r["content"] for r in results]


def test_the_rule_is_in_the_prompt_and_the_mcp_instructions():
    rule = "Haz una sola acción act por turno y vuelve a observar"
    assert rule in SYSTEM and rule in host_instructions("b2b", "web")
    assert "act open_app" in SYSTEM and "alba-core o inbox" in host_instructions("b2b", "web")
