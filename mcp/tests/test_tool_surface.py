"""The agent sees exactly observe, act and oracle, and nothing else."""

from __future__ import annotations

import sys

import mcp_types as types
import pytest
from mcp import Client, MCPError, StdioServerParameters
from mcp.server import Server

from agent import ReplayModel, ToolSurfaceError, load_tools, run_agent
from conftest import MCP_DIR, REPLAY
from server import build_server

EXPECTED = {"observe", "act", "oracle"}


async def test_only_three_tools_in_process(world):
    core, _ = world
    async with Client(build_server(core)) as client:
        listed = await client.list_tools()
        assert {t.name for t in listed.tools} == EXPECTED
        assert len(listed.tools) == 3
        for t in listed.tools:
            assert t.input_schema["additionalProperties"] is False
            assert "session" in t.input_schema["required"]


async def test_no_resources_or_prompts(world):
    core, _ = world
    async with Client(build_server(core)) as client:
        caps = client.server_capabilities
        assert caps.tools is not None
        assert caps.resources is None and caps.prompts is None
        with pytest.raises(MCPError):
            await client.list_resources()
        with pytest.raises(MCPError):
            await client.list_prompts()


async def test_unknown_tool_is_refused_and_audited(world):
    core, fake = world
    async with Client(build_server(core)) as client:
        r = await client.call_tool("eval", {"session": "s1", "code": "1+1"})
    assert r.is_error
    assert r.structured_content["denied"] == "sin_regla"
    assert fake.audit.events[-1]["kind"] == "blocked"


async def test_invalid_input_is_refused(world):
    core, fake = world
    async with Client(build_server(core)) as client:
        r = await client.call_tool("act", {"session": "s1", "op": "eval", "target": "e6"})
    assert r.structured_content["denied"] == "sin_regla"
    assert fake.adapter.performed == []


async def test_only_three_tools_over_stdio():
    params = StdioServerParameters(command=sys.executable, args=[str(MCP_DIR / "server.py"), "--transport", "stdio"])
    async with Client(params) as client:
        listed = await client.list_tools()
    assert {t.name for t in listed.tools} == EXPECTED


async def test_agent_refuses_a_wider_tool_surface(world):
    core, _ = world
    extra = types.Tool(name="eval", description="", input_schema={"type": "object"})

    async def list_tools(ctx, params):
        return types.ListToolsResult(tools=[*[types.Tool(name=n, description="", input_schema={"type": "object"})
                                              for n in EXPECTED], extra])

    rogue = Server("rogue", on_list_tools=list_tools)
    async with Client(rogue) as client:
        with pytest.raises(ToolSurfaceError):
            await load_tools(client)
        with pytest.raises(ToolSurfaceError):
            await run_agent(client, ReplayModel(REPLAY), core, "registrar factura")


async def test_model_receives_only_the_three_tools(world):
    core, _ = world
    model = ReplayModel(REPLAY)
    async with Client(build_server(core)) as client:
        await run_agent(client, model, core, "registrar factura")
    for request in model.requests:
        assert {t["name"] for t in request["tools"]} == EXPECTED
