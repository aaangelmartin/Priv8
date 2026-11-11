"""--web takes its tasks from the audit console and answers there (#128). No browser, no Claude."""

from __future__ import annotations

import dataclasses

import pytest

from agent import agent as agent_mod
from agent import core_adapter as ca
from agent import server as server_mod
from agent.fakes import build_fake_core

ANSWER = "Registrada la factura de ‹PROVEEDOR_1·correo›."


class StopConsole(Exception):
    """Ends the console loop in a test, where Ctrl-C would end it live."""


class FakeModel:
    """Stands in for AnthropicModel: one text answer per task, and the tasks it got."""

    tasks: list[str] = []

    def __init__(self, **_: object) -> None:
        pass

    async def create(self, *, system, messages, tools):
        FakeModel.tasks.append(messages[0]["content"])
        return {"stop_reason": "end_turn", "content": [{"type": "text", "text": ANSWER}]}

    def save_recording(self, task: str) -> None:
        pass


@pytest.fixture
def console(monkeypatch):
    """The --web wiring with the fake core: what 8 says, approvals waited, tasks queued."""
    said: list[tuple[str, str]] = []
    waited: list[str] = []
    queue: list[str | None] = []
    core, _ = build_fake_core()

    class Voice:
        def say(self, session, text):
            said.append((session, text))
            return {"utterance": "u1"}

    def next_task(session, timeout=None):
        if not queue:
            raise StopConsole
        return queue.pop(0)

    FakeModel.tasks = []
    monkeypatch.setenv("PRIV8_CORE", "real")
    monkeypatch.setattr(server_mod, "default_core", lambda: dataclasses.replace(core, voice=Voice()))
    monkeypatch.setattr(agent_mod, "AnthropicModel", FakeModel)
    monkeypatch.setattr(agent_mod, "_wait_for_approvals", lambda session, err, *_: waited.append(session))
    monkeypatch.setattr(ca, "mount_web", lambda session, **_: None)
    monkeypatch.setattr(ca, "has_dictation", lambda *_: True)
    monkeypatch.setattr(ca, "next_dictated_task", next_task)
    monkeypatch.setattr(ca, "tokenize_task", lambda session, text, **_: text)
    return said, waited, queue


def test_without_task_waits_for_the_console_and_answers_there(console, capsys):
    said, waited, queue = console
    queue += [None, "registrar factura", "contesta el correo del proveedor"]  # None: nothing yet
    with pytest.raises(StopConsole):
        agent_mod.main(["--web"])
    assert "pide el encargo a 8 en la consola (http://127.0.0.1:5175)" in capsys.readouterr().err
    assert len(FakeModel.tasks) == 2
    assert agent_mod.TASKS["registrar factura"] in FakeModel.tasks[0]  # a task name expands
    assert FakeModel.tasks[1].endswith("contesta el correo del proveedor")
    assert said == [("b2b", ANSWER), ("b2b", ANSWER)]
    assert waited == ["b2b", "b2b"]


def test_task_runs_first_then_the_console_takes_over(console):
    said, waited, queue = console
    queue += ["contesta el correo del proveedor"]
    with pytest.raises(StopConsole):
        agent_mod.main(["--web", "--task", "registrar factura"])
    assert agent_mod.TASKS["registrar factura"] in FakeModel.tasks[0]
    assert FakeModel.tasks[1].endswith("contesta el correo del proveedor")
    assert len(said) == 2 and waited == ["b2b", "b2b"]


def test_empty_answer_is_not_said(console, monkeypatch):
    said, waited, _ = console

    async def silent(self, **_):
        FakeModel.tasks.append("")
        return {"stop_reason": "end_turn", "content": []}

    monkeypatch.setattr(FakeModel, "create", silent)
    with pytest.raises(StopConsole):
        agent_mod.main(["--web", "--task", "registrar factura"])
    assert said == [] and waited == ["b2b"]
