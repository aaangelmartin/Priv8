"""PRIV8_CORE selection and the in-process adapter to the real core (stubbed here)."""

from __future__ import annotations

import hashlib
import json
import sys
import types

import pytest
from mcp import Client

from agent import agent as agent_mod
from agent import server as server_mod
from agent.core_adapter import REQUIRED, RealCoreUnavailable, build_real_core, core_choice, select_core
from agent.core_port import Core, LeakVerdict
from agent.fakes import FakeCore
from agent.server import ToolGateway, build_server

REAL_IBAN = "ES9121000418450200051332"


def make_stub_core(*, without: tuple[str, ...] = ()) -> types.ModuleType:
    """A minimal `core` with the five functions of 'Lo que el núcleo expone'.

    Like the real core, it records its own event for each observe, act and oracle.
    """
    mod = types.ModuleType("core")
    mod.calls = []
    mod.log = []

    def observe(session):
        mod.calls.append(("observe", session))
        record({"session": session, "kind": "observe_sent", "screen": "factura"})
        return {"session": session, "app": "erp", "screen": "factura", "seq": 1, "paused": False,
                "budget_left": 5,
                "elements": [{"id": "e1", "role": "input", "label": "IBAN", "text": "‹IBAN_1·maestro›",
                              "cls": "ambar", "tokens": ["‹IBAN_1·maestro›"], "actions": ["type"]},
                             {"id": "e2", "role": "input", "label": "Clave", "text": None,
                              "cls": "rojo", "tokens": [], "actions": []}]}

    def act(session, op, target=None, text=None, direction=None):
        mod.calls.append(("act", session, op, target, text, direction))
        if op == "send":
            record({"session": session, "kind": "held", "confirm": "c1"})
            return {"held": {"confirm": "c1"}}
        record({"session": session, "kind": "act"})
        if op == "tap" and target == "leak":
            return {"ok": True, "echo": REAL_IBAN}  # a buggy core: the final block must stop it
        return {"ok": True}

    def oracle(session, op, args):
        mod.calls.append(("oracle", session, op, tuple(args)))
        record({"session": session, "kind": "oracle"})
        return {"result": "igual", "budget_left": 4}

    def check(payload):
        hit = REAL_IBAN in payload
        return {"allowed": not hit, "findings": ["IBAN"] if hit else []}

    def record(event):
        prev = mod.log[-1]["hash"] if mod.log else "0" * 64
        stored = {**event, "seq": len(mod.log) + 1, "prev": prev}
        stored["hash"] = hashlib.sha256(json.dumps(stored, sort_keys=True).encode()).hexdigest()
        mod.log.append(stored)
        return stored

    for name, fn in {"observe": observe, "act": act, "oracle": oracle, "check": check, "record": record}.items():
        if name not in without:
            setattr(mod, name, fn)
    return mod


@pytest.fixture
def stub_core(monkeypatch):
    mod = make_stub_core()
    monkeypatch.setitem(sys.modules, "core", mod)
    return mod


# ------------------------------------------------------------ selector

def test_choice_defaults_to_fake():
    assert core_choice({}) == "fake"
    assert core_choice({"PRIV8_CORE": ""}) == "fake"
    assert core_choice({"PRIV8_CORE": " Real "}) == "real"


def test_choice_rejects_unknown_values():
    with pytest.raises(ValueError, match="PRIV8_CORE"):
        core_choice({"PRIV8_CORE": "http"})


def test_select_fake_core():
    core = select_core({"PRIV8_CORE": "fake"})
    assert isinstance(core, Core)
    assert isinstance(core.screen, FakeCore)


def test_select_real_core_uses_core_module(stub_core):
    core = select_core({"PRIV8_CORE": "real"})
    core.screen.observe("s1")
    assert stub_core.calls == [("observe", "s1")]


def test_default_core_reads_env(monkeypatch, stub_core):
    monkeypatch.delenv("PRIV8_CORE", raising=False)
    assert isinstance(server_mod.default_core().screen, FakeCore)
    monkeypatch.setenv("PRIV8_CORE", "real")
    server_mod.default_core().screen.observe("s9")
    assert stub_core.calls == [("observe", "s9")]


# ------------------------------------------------------------ clear errors

def test_missing_core_module_names_every_function(monkeypatch):
    monkeypatch.setitem(sys.modules, "core", None)  # import core -> ImportError
    with pytest.raises(RealCoreUnavailable) as e:
        build_real_core()
    assert e.value.missing == REQUIRED
    for name in REQUIRED:
        assert f"core.{name}" in str(e.value)
    assert "PRIV8_CORE=fake" in str(e.value)


def test_partial_core_names_only_the_missing_functions(monkeypatch):
    monkeypatch.setitem(sys.modules, "core", make_stub_core(without=("check", "record")))
    with pytest.raises(RealCoreUnavailable) as e:
        build_real_core()
    assert e.value.missing == ("check", "record")
    assert "core.check, core.record" in str(e.value)
    assert "core.observe" not in str(e.value)


def test_agent_cli_exits_cleanly_without_core(monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, "core", None)
    monkeypatch.setenv("PRIV8_CORE", "real")
    assert agent_mod.main(["--replay", "agent/replays/registrar_factura.json"]) == 2
    err = capsys.readouterr().err
    assert "core.observe" in err and "core.record" in err


# ------------------------------------------------------------ wiring

def test_ports_wire_through(stub_core):
    core = build_real_core()
    assert core.screen.observe("s1")["screen"] == "factura"
    assert core.actor.act("s1", "type", "e1", "‹IBAN_1·maestro›") == {"ok": True}
    core.actor.act("s1", "scroll", direction="down")
    assert core.oracle.oracle("s1", "compare", ["‹IMPORTE_1›", "‹IMPORTE_2›"])["result"] == "igual"
    assert stub_core.calls[1:] == [
        ("act", "s1", "type", "e1", "‹IBAN_1·maestro›", None),
        ("act", "s1", "scroll", None, None, "down"),
        ("oracle", "s1", "compare", ("‹IMPORTE_1›", "‹IMPORTE_2›")),
    ]
    assert core.leak.check("nada") == LeakVerdict(ok=True)
    assert core.leak.check(REAL_IBAN) == LeakVerdict(ok=False, reason="fuga", matched=("IBAN",))
    stored = core.audit.record({"session": "s1", "kind": "task"})
    assert stored["prev"] == stub_core.log[-2]["hash"] and "hash" in stored
    assert core.audit.events == [stored]  # the mirror holds only what the agent recorded


def test_unreadable_verdict_fails_closed(monkeypatch):
    mod = make_stub_core()
    mod.check = lambda payload: {"findings": []}  # no `allowed`
    monkeypatch.setitem(sys.modules, "core", mod)
    assert build_real_core().leak.check("x").ok is False


def test_gateway_over_real_core(stub_core):
    gw = ToolGateway(build_real_core())
    assert gw.call("observe", {"session": "s1"})["screen"] == "factura"
    assert gw.call("act", {"session": "s1", "op": "send", "target": "e9"}) == {"held": {"confirm": "c1"}}
    # Raw value in the input never reaches the core.
    assert gw.call("act", {"session": "s1", "op": "type", "target": "e1", "text": REAL_IBAN})["denied"] == "fuga"
    # A leaking core result is stopped by the final block.
    assert gw.call("act", {"session": "s1", "op": "tap", "target": "leak"})["denied"] == "fuga"
    assert not any(c[0] == "act" and c[4] == REAL_IBAN for c in stub_core.calls)
    # Each call leaves exactly one event: the core's, or the server's when the core never saw it
    # (input leak) or its result was held back (output leak, after the core recorded the act).
    kinds = [e["kind"] for e in stub_core.log]
    assert kinds == ["observe_sent", "held", "blocked", "act", "blocked"]
    assert all(e["prev"] == p["hash"] for p, e in zip(stub_core.log, stub_core.log[1:]))


async def test_mcp_server_over_real_core(stub_core):
    async with Client(build_server(build_real_core())) as client:
        r = await client.call_tool("oracle", {"session": "s1", "op": "compare",
                                              "args": ["‹IMPORTE_1›", "‹IMPORTE_2›"]})
    assert r.structured_content == {"result": "igual", "budget_left": 4}
    assert stub_core.calls[-1] == ("oracle", "s1", "compare", ("‹IMPORTE_1›", "‹IMPORTE_2›"))
