"""Priv8 CUA MCP server: exactly three closed tools, observe, act and oracle.

No other tool, no resources, no prompts. Every result goes through the core's
leak check (the final block) before it is returned, and every call leaves an
audit event (audit.schema.json).

    python mcp/server.py                     # streamable HTTP on 127.0.0.1:8701/mcp
    python mcp/server.py --transport stdio   # stdio, for MCP hosts that spawn it

Follows contracts v1 (docs/contracts/tools.schema.json, PR #58). Until the real
core lands, the server runs over `fakes.FakeCore`.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

import anyio
import mcp_types as types
from jsonschema import Draft202012Validator
from mcp.server import Server

from core_port import JSON, NO_SESSION, Core, tokens_in

log = logging.getLogger("priv8.mcp")

TOOLS_FILE = Path(__file__).with_name("tools.json")
TOOL_DEFS: list[JSON] = json.loads(TOOLS_FILE.read_text(encoding="utf-8"))["tools"]
TOOL_NAMES: frozenset[str] = frozenset(t["name"] for t in TOOL_DEFS)
assert TOOL_NAMES == {"observe", "act", "oracle"}, "Priv8 exposes exactly observe, act and oracle"
_SCHEMAS = {t["name"]: t["input_schema"] for t in TOOL_DEFS}
# Model-facing schema plus the contract's conditional rules (which ops need target or text).
_VALIDATORS = {t["name"]: Draft202012Validator({**t["input_schema"], "allOf": t.get("x-priv8-rules", [])})
               for t in TOOL_DEFS}
_SESSION_OK = Draft202012Validator(_SCHEMAS["observe"]["properties"]["session"])

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8701

# What the model gets back when the final block stops a payload. Safe by construction.
LEAK_BLOCKED: JSON = {"denied": "fuga", "detail": "la respuesta contenía un dato sin tokenizar y no sale"}


class ToolGateway:
    """The tool logic, independent of the MCP transport (also used by tests)."""

    def __init__(self, core: Core) -> None:
        self.core = core

    def call(self, name: str, arguments: dict[str, Any] | None) -> JSON:
        args = arguments or {}
        session = args.get("session")
        if not _SESSION_OK.is_valid(session):
            session = NO_SESSION
        if name not in TOOL_NAMES:
            self._audit(session, "blocked", reason="sin_regla", model_saw="herramienta no disponible")
            return {"denied": "sin_regla", "detail": "herramienta no disponible"}
        errors = sorted(_VALIDATORS[name].iter_errors(args), key=lambda e: list(e.path))
        if errors:
            # Field paths only: the rejected values are not echoed back.
            where = ", ".join(sorted({"/".join(map(str, e.path)) or "(raíz)" for e in errors}))
            self._audit(session, "blocked", reason="sin_regla", model_saw=f"{name} entrada inválida",
                        detail=f"entrada inválida en: {where}")
            return {"denied": "sin_regla", "detail": f"entrada inválida en: {where}"}

        # The model only ever writes tokens or green text. Raw sensitive text in
        # an input is refused before it reaches the core.
        verdict_in = self.core.leak.check(json.dumps(args, ensure_ascii=False, sort_keys=True))
        if not verdict_in.ok:
            self._audit(session, "blocked", reason="fuga", model_saw=f"{name} entrada con dato real",
                        detail="patrón: " + ", ".join(verdict_in.matched))
            return dict(LEAK_BLOCKED)

        t0 = time.perf_counter()
        if name == "observe":
            result = self.core.screen.observe(args["session"])
        elif name == "act":
            result = self.core.actor.act(args["session"], args["op"], args.get("target"), args.get("text"),
                                         args.get("direction"))
        else:
            result = self.core.oracle.oracle(args["session"], args["op"], list(args["args"]))
        core_ms = round((time.perf_counter() - t0) * 1000)

        payload = json.dumps(result, ensure_ascii=False)
        verdict = self.core.leak.check(payload)
        if not verdict.ok:
            self._audit(session, "blocked", reason="fuga", model_saw=f"{name} respuesta retenida",
                        detail="patrón: " + ", ".join(verdict.matched), ms={"core": core_ms})
            return dict(LEAK_BLOCKED)

        denied = result.get("denied")
        if name == "observe" and not denied:
            counts = {c: sum(1 for e in result["elements"] if e["cls"] == c) for c in ("verde", "ambar", "rojo")}
            self._audit(session, "observe_sent", app=result["app"], screen=result["screen"],
                        model_saw=f"observe {result['screen']}", tokens=_unique_tokens(payload),
                        counts=counts, ms={"core": core_ms})
        else:
            said = " ".join(str(x) for x in (name, args.get("op"), args.get("target"), args.get("text"),
                                              args.get("direction"), *(args.get("args") or [])) if x)
            self._audit(session, "blocked" if denied else name, reason=denied, model_saw=said,
                        tokens=_unique_tokens(said + " " + payload),
                        detail=result.get("detail") if denied else _summary(result), ms={"core": core_ms})
        return result

    def _audit(self, session: str, kind: str, **fields: Any) -> None:
        self.core.audit.record({"session": session, "kind": kind, **fields})


def _unique_tokens(text: str) -> list[str]:
    return list(dict.fromkeys(tokens_in(text)))


def _summary(result: JSON) -> str:
    """One line for audit.detail: tokens and green words only."""
    if "held" in result:
        return f"held {result['held']['confirm']}"
    if "result" in result:
        return " ".join(str(result[k]) for k in ("result", "tramo") if k in result)
    return "ok"


def build_server(core: Core, *, name: str = "priv8-cua") -> Server[Any]:
    """Low-level MCP server with explicit schemas from tools.json, and nothing else."""
    gateway = ToolGateway(core)
    tools = [types.Tool(name=t["name"], description=t["description"], input_schema=t["input_schema"])
             for t in TOOL_DEFS]

    async def on_list_tools(ctx: Any, params: types.PaginatedRequestParams | None) -> types.ListToolsResult:
        return types.ListToolsResult(tools=tools)

    async def on_call_tool(ctx: Any, params: types.CallToolRequestParams) -> types.CallToolResult:
        result = gateway.call(params.name, params.arguments)
        text = json.dumps(result, ensure_ascii=False)
        return types.CallToolResult(content=[types.TextContent(text=text)], structured_content=result,
                                    is_error=params.name not in TOOL_NAMES)

    return Server(
        name,
        version="0.1.0",
        on_list_tools=on_list_tools,
        on_call_tool=on_call_tool,
        get_tool_input_schema=lambda tool: _SCHEMAS.get(tool),
    )


def default_core() -> Core:
    """The core the server runs over. Swap for the real `core/` adapter when it lands."""
    from fakes import build_fake_core

    core, _ = build_fake_core()
    return core


async def serve_http(server: Server[Any], host: str = DEFAULT_HOST, port: int = DEFAULT_PORT,
                     *, ready: anyio.Event | None = None, stop: anyio.Event | None = None) -> None:
    """Serve streamable HTTP at http://host:port/mcp. `ready` is set once listening;
    setting `stop` shuts the server down gracefully."""
    import uvicorn

    app = server.streamable_http_app(host=host)
    uv = uvicorn.Server(uvicorn.Config(app, host=host, port=port, log_level="warning"))
    async with anyio.create_task_group() as tg:
        tg.start_soon(uv.serve)
        while not uv.started:
            await anyio.sleep(0.05)
        if ready is not None:
            ready.set()
        if stop is not None:
            await stop.wait()
            uv.should_exit = True


async def serve_stdio(server: Server[Any]) -> None:
    from mcp.server.stdio import stdio_server

    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Priv8 CUA MCP server (observe, act, oracle)")
    p.add_argument("--transport", choices=["http", "stdio"], default="http")
    p.add_argument("--host", default=DEFAULT_HOST)
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    a = p.parse_args(argv)
    # stdout is the protocol channel on stdio: logs go to stderr.
    logging.basicConfig(stream=sys.stderr, level=logging.INFO)
    server = build_server(default_core())
    if a.transport == "stdio":
        anyio.run(serve_stdio, server)
    else:
        log.info("Priv8 CUA MCP on http://%s:%d/mcp", a.host, a.port)
        anyio.run(serve_http, server, a.host, a.port)


if __name__ == "__main__":
    main()
