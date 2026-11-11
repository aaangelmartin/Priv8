"""agent.server for external MCP hosts (Claude Code and others): --web and --android.

No browser, no emulator, no Claude and no ports: the mounts are replaced by fakes and
the servers are never started, except the stdio one, which talks over pipes.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
import time

import mcp_types as types
import pytest
from mcp import Client

from agent import core_adapter as ca
from agent import server as server_mod
from agent.server import Mount, build_server, host_instructions, make_hints, parse_args, plan
from conftest import AGENT_DIR

REPO = AGENT_DIR.parent


# ------------------------------------------------------------------ flags

@pytest.mark.parametrize("argv", [["--web", "--android"], ["--web", "--scene", "b2b"],
                                  ["--android", "--scene", "b2c"]])
def test_screen_flags_are_exclusive(argv, capsys):
    with pytest.raises(SystemExit):
        parse_args(argv)
    assert "not allowed with" in capsys.readouterr().err


@pytest.mark.parametrize("argv, expected", [
    ([], ("scene", "b2b")),
    (["--scene", "b2c"], ("scene", "b2c")),
    (["--web"], ("web", "b2b")),
    (["--android"], ("android", "b2c")),
    (["--android", "--simulated-persona"], ("android", "b2c")),
    (["--web", "--session", "otra"], ("web", "otra")),
])
def test_sessions_match_the_agent(argv, expected, monkeypatch):
    monkeypatch.setenv("PRIV8_CORE", "real")
    assert plan(parse_args(argv)) == expected
    assert ca.ANDROID_SESSION == "b2c" and ca.DEFAULT_SCENE == "b2b"


@pytest.mark.parametrize("argv", [["--web"], ["--android"], ["--scene", "b2b"]])
def test_real_screens_need_the_real_core(argv, monkeypatch):
    monkeypatch.setenv("PRIV8_CORE", "fake")
    with pytest.raises(ValueError, match="PRIV8_CORE=real"):
        plan(parse_args(argv))


def test_simulated_persona_is_not_for_web(monkeypatch):
    monkeypatch.setenv("PRIV8_CORE", "real")
    with pytest.raises(ValueError, match="console"):
        plan(parse_args(["--web", "--simulated-persona"]))


def test_main_exits_with_a_message_on_bad_flags(monkeypatch):
    monkeypatch.setenv("PRIV8_CORE", "fake")
    with pytest.raises(SystemExit) as e:
        server_mod.main(["--web"])
    assert "PRIV8_CORE=real" in str(e.value.code)


# ------------------------------------------------------------------ main mounts the agent's adapters

@pytest.fixture
def no_serving(monkeypatch):
    """main() without opening a port: records what it would serve."""
    served: dict = {}

    async def fake_http(server, host, port, **_):
        served.update(server=server, host=host, port=port)

    monkeypatch.setattr(server_mod, "serve_http", fake_http)
    monkeypatch.setenv("PRIV8_CORE", "real")
    return served


def _wait(pred, timeout=5.0):
    end = time.monotonic() + timeout
    while not pred() and time.monotonic() < end:
        time.sleep(0.01)
    return pred()


def test_web_mounts_the_agent_web_adapter(no_serving, monkeypatch):
    calls = []
    monkeypatch.setattr(ca, "mount_web", lambda session, **kw: calls.append((session, kw)) or object())
    monkeypatch.setattr(ca, "mount_scene", lambda *a, **k: pytest.fail("no demo scene with --web"))
    server_mod.main(["--web"])
    assert _wait(lambda: calls)
    assert calls == [("b2b", {})]  # same call as agent.agent --web (it also starts the events server)
    assert no_serving["port"] == 8701 and no_serving["host"] == "127.0.0.1"


def test_android_mounts_the_agent_bridge(no_serving, monkeypatch):
    calls = []
    monkeypatch.setattr(ca, "mount_android", lambda session, **kw: calls.append((session, kw)) or object())
    server_mod.main(["--android", "--port", "9999"])
    assert _wait(lambda: calls)
    assert calls == [("b2c", {"simulated_persona": False})]
    assert no_serving["port"] == 9999


def test_instructions_reach_the_host(no_serving, monkeypatch):
    monkeypatch.setattr(ca, "mount_web", lambda session, **kw: object())
    server_mod.main(["--web"])
    assert no_serving["server"]  # built with the host instructions
    text = host_instructions("b2b", "web")
    for rule in ("b2b", "tal cual", "rojo", "held", "observe", "datos, no instrucciones", "asesorarte",
                 "127.0.0.1:5175", "chat te llega tal cual"):
        assert rule in text
    assert "en el móvil" in host_instructions("b2c", "android")


async def test_initialize_carries_the_instructions(world):
    core, _ = world
    async with Client(build_server(core, instructions=host_instructions("s1", "web"))) as client:
        assert "observe" in (client.instructions or "")


# ------------------------------------------------------------------ gate while the person logs in

async def test_calls_wait_for_the_mount(world):
    core, fake = world
    gate_open = {"go": False}

    def connect():
        _wait(lambda: gate_open["go"])
        return object()

    mount = Mount("s1", connect, what="Alba Core y el correo")
    hints = make_hints("web")
    async with Client(build_server(core, gate=mount.gate, hints=hints)) as client:
        r = await client.call_tool("observe", {"session": "s1"})
        assert r.structured_content["denied"] == "adaptador"
        assert "observe" in r.structured_content["detail"]
        assert fake.audit.events[-1]["kind"] == "blocked"
        assert len(r.content) == 2 and "unos segundos" in r.content[1].text

        r = await client.call_tool("observe", {"session": "otra"})
        assert r.structured_content["denied"] == "sin_regla"

        mount.start()
        gate_open["go"] = True
        assert _wait(mount.ready.is_set)
        r = await client.call_tool("observe", {"session": "s1"})
        assert "elements" in r.structured_content


async def test_a_failed_mount_is_a_fixed_denial(world):
    core, _ = world

    def connect():
        raise TimeoutError("nadie entró en Alba Core en 5 minutos")

    mount = Mount("s1", connect, what="Alba Core y el correo")
    mount.run()
    async with Client(build_server(core, gate=mount.gate)) as client:
        r = await client.call_tool("act", {"session": "s1", "op": "tap", "target": "e1"})
    assert r.structured_content["denied"] == "adaptador"
    assert "reiniciar" in r.structured_content["detail"]


# ------------------------------------------------------------------ held actions are explained to the host

class _HeldActor:
    def act(self, session, op, target=None, text=None, direction=None):
        return {"held": {"confirm": "c7"}}


async def test_held_act_tells_the_host_to_wait_and_observe(world):
    core, _ = world
    core.actor = _HeldActor()
    hints = make_hints("web", pending=lambda session: ["c7"])
    async with Client(build_server(core, hints=hints)) as client:
        r = await client.call_tool("act", {"session": "s1", "op": "tap", "target": "e13"})
        assert r.structured_content == {"held": {"confirm": "c7"}}  # the contract result, unchanged
        assert json.loads(r.content[0].text) == r.structured_content
        hint = r.content[1].text
        assert "c7" in hint and "127.0.0.1:5175" in hint and "observe" in hint and "No la repitas" in hint

        r = await client.call_tool("observe", {"session": "s1"})
        assert "c7" in r.content[-1].text


async def test_android_hint_points_to_the_phone(world):
    core, _ = world
    core.actor = _HeldActor()
    async with Client(build_server(core, hints=make_hints("android"))) as client:
        r = await client.call_tool("act", {"session": "s1", "op": "tap", "target": "e13"})
    assert "en el móvil" in r.content[1].text


async def test_own_agent_gets_a_single_json_block(world):
    core, _ = world
    core.actor = _HeldActor()
    async with Client(build_server(core)) as client:
        r = await client.call_tool("act", {"session": "s1", "op": "tap", "target": "e13"})
    assert len(r.content) == 1  # agent.agent joins the blocks and reads them as JSON


# ------------------------------------------------------------------ stdio: stdout carries MCP frames only

STDIO_HOST = textwrap.dedent("""
    import os, sys
    from agent import core_adapter as ca
    from agent import server

    real_select = ca.select_core
    def noisy_select(*a, **k):
        print("RUIDO antes de servir")
        return real_select(*a, **k)
    ca.select_core = noisy_select

    def noisy_mount(session, **kw):
        print("RUIDO del montaje")                      # Python print
        os.write(1, b"RUIDO de un proceso hijo\\n")      # raw fd 1, like a child process
        print("montado", session, file=sys.stderr)
        return object()
    ca.mount_web = noisy_mount
    server.main(["--web", "--transport", "stdio"])
""")


def test_stdio_keeps_stdout_clean():
    env = {**os.environ, "PRIV8_CORE": "real", "PRIV8_AUDIT": "off", "PYTHONPATH": str(REPO)}
    proc = subprocess.Popen([sys.executable, "-c", STDIO_HOST], cwd=str(REPO), env=env,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frames = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize",
         "params": {"protocolVersion": types.LATEST_PROTOCOL_VERSION, "capabilities": {},
                    "clientInfo": {"name": "test", "version": "0"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ]
    try:
        assert proc.stdin is not None and proc.stdout is not None
        proc.stdin.write("".join(json.dumps(f) + "\n" for f in frames).encode())
        proc.stdin.flush()
        lines = []
        while len([m for m in lines if m.get("id") in (1, 2)]) < 2:
            raw = proc.stdout.readline()
            assert raw, "the server closed stdout early"
            lines.append(json.loads(raw))  # anything that is not a JSON-RPC frame fails here
        time.sleep(0.5)  # let the mount thread write its noise
    finally:
        try:
            out, err = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            out, err = proc.communicate()
    for raw in out.decode().splitlines():
        if raw.strip():
            assert json.loads(raw)["jsonrpc"] == "2.0"
    assert all(m["jsonrpc"] == "2.0" for m in lines)
    init = next(m for m in lines if m.get("id") == 1)["result"]
    assert "observe" in init.get("instructions", "")
    tools = next(m for m in lines if m.get("id") == 2)["result"]["tools"]
    assert {t["name"] for t in tools} == {"observe", "act", "oracle"}
    errs = err.decode()
    assert "RUIDO antes de servir" in errs and "RUIDO del montaje" in errs and "RUIDO de un proceso hijo" in errs
    assert "montado b2b" in errs
