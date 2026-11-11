"""The core side of the Android bridge, against a fake phone (no emulator).

    uv run pytest adapters/android/tests

The fake phone (adapters/android/fake_phone.py) answers with the real Banca
Alcor screens of the AVD and validates every message it gets against
bridge.schema.json; the bridge validates every message it gets and sends.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

import pytest

# The tests never write the repo's audit log or key.
os.environ.setdefault("PRIV8_AUDIT", "off")
os.environ.setdefault("PRIV8_AUDIT_KEY", os.path.join(tempfile.mkdtemp(prefix="priv8-"), "priv8.key"))

import core  # noqa: E402
from adapters.android.bridge import AndroidBridge  # noqa: E402
from adapters.android.bridge_dev_server import load_validator  # noqa: E402
from adapters.android.fake_phone import ALCOR, LAUNCHER, OCHO, FakePhone  # noqa: E402
from agent import core_adapter as ca  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs" / "contracts"
REPLAY = ROOT / "agent" / "replays" / "b2c_android.json"
SEED_VALUES = ["3.412,58", "12.050,00", "15.462,58", "ES43 9100", "ES08 9300", "Lucía Ferrer", "200 €", "200,00"]

_n = iter(range(10_000))


def wait_until(cond, timeout: float = 5.0) -> bool:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.05)
    return cond()


@pytest.fixture
def session() -> str:
    return f"and{next(_n)}"  # a fresh vault per test


@pytest.fixture
def rig(session):
    """(bridge, phone) on a free port, mounted for `session`. The phone answers «confirmo»."""
    made: list = []

    def make(**phone_kw):
        bridge = AndroidBridge(session, port=0, core=core, log=lambda _m: None).start()
        bridge.present_wait = 0
        phone = FakePhone(f"ws://127.0.0.1:{bridge.port}", **phone_kw).start()
        made.append((bridge, phone))
        ca.mount_android(session, bridge=bridge, events=False)
        return bridge, phone

    yield make
    for bridge, phone in made:
        phone.stop()
        bridge.stop()


def kinds(phone: FakePhone) -> list[str]:
    return [m["type"] for m in phone.received]


def test_snapshot_and_perform_follow_the_contract(rig, session):
    bridge, phone = rig(app=LAUNCHER)  # on the home screen: the harness opens the bank
    obs = core.observe(session)
    assert obs["screen"] == "inicio" and obs["paused"] is None
    texts = json.dumps(obs, ensure_ascii=False)
    assert "‹IMPORTE_" in texts and not any(v in texts for v in SEED_VALUES)
    assert core.act(session, "tap", "n17") == {"ok": True}
    assert core.observe(session)["screen"] == "transferencia"
    assert phone.invalid == [] and bridge.failures == 0
    # mount_android opened the bank first (the harness, not the agent)
    assert phone.performed[0] == {"id": phone.performed[0]["id"], "op": "open_app", "text": ALCOR}


def test_invalid_message_is_never_sent(rig):
    bridge, phone = rig()
    with pytest.raises(ValueError):
        bridge._call(bridge._send({"type": "perform", "id": "x1", "op": "volar"}), 5)
    assert "perform" not in [m.get("op") for m in phone.received]
    assert bridge.failures == 1


def _to_revision(session: str) -> None:
    core.tokenize_text(session, "pasa 200 € a mi cuenta de Nimbo Bróker")
    core.observe(session)
    core.act(session, "tap", "n17")
    core.observe(session)
    assert core.act(session, "tap", "n12") == {"ok": True}  # Nimbo, before scrolling
    assert core.act(session, "type", "n26", "‹IMPORTE_1·positivo›") == {"ok": True}
    assert core.act(session, "scroll", "n4", direction="down") == {"ok": True}
    assert core.observe(session)["elements"][24]["text"] == "Continuar"
    assert core.act(session, "tap", "n25") == {"ok": True}
    assert core.observe(session)["screen"] == "revision"


@pytest.mark.parametrize("after_confirm", [None, OCHO], ids=["bank-in-front", "8-in-front"])
@pytest.mark.parametrize("look", [True, False], ids=["agent-looks", "agent-done"])
def test_held_transfer_is_spoken_on_the_phone_and_runs_on_approval(rig, session, after_confirm, look):
    bridge, phone = rig(answer="ok", answer_delay=0.5, after_confirm=after_confirm)
    _to_revision(session)
    held = core.act(session, "tap", "n17")
    assert "held" in held
    if look:  # the agent looks while 8 asks: the phone shows the confirmation and forgets the ids
        assert core.observe(session)["paused"] == "confirmacion"
    assert wait_until(lambda: not core.pending(session))
    assert wait_until(lambda: phone.page == "autenticacion")  # the held tap ran, remapped to the fresh ids

    order = kinds(phone)
    i = order.index("confirm_request")
    assert order[i - 1] == "render_values"
    req, values = phone.received[i], phone.received[i - 1]["values"]
    toks = [s["token"] for s in req["summary"] if s.get("token")]
    assert toks and set(toks) <= set(values)
    assert values["‹IMPORTE_1·positivo›"] == "200 €"  # the value the person said
    assert phone.answered[req["id"]]["ok"] is True
    approvals = [e for e in core.AUDIT.events if e["session"] == session and e["kind"] == "approval"]
    assert approvals and approvals[-1]["approved_by"] == "persona"
    assert phone.invalid == [] and bridge.failures == 0


def test_cancel_on_the_phone_does_not_run(rig, session):
    _, phone = rig(answer="no")
    _to_revision(session)
    core.act(session, "tap", "n17")
    assert wait_until(lambda: not core.pending(session))
    time.sleep(0.3)
    assert phone.page == "revision"
    last = [e for e in core.AUDIT.events if e["session"] == session and e["kind"] == "approval"][-1]
    assert last["detail"] == "cancelado"


def test_pending_confirmation_is_sent_again_after_hello(rig, session):
    _, phone = rig(answer=None)  # nobody answers
    _to_revision(session)
    cid = core.act(session, "tap", "n17")["held"]["confirm"]
    assert wait_until(lambda: kinds(phone).count("confirm_request") == 1)
    phone.reconnect()
    assert wait_until(lambda: kinds(phone).count("confirm_request") == 2)
    again = [m for m in phone.received if m["type"] == "confirm_request"]
    assert again[0]["id"] == again[1]["id"] == cid
    assert kinds(phone)[-2] == "render_values"  # values first, also on the resend


def test_say_sends_render_values_then_the_utterance(rig, session):
    bridge, phone = rig()
    core.observe(session)
    res = core.oracle(session, "sum", ["‹IMPORTE_2·positivo›", "‹IMPORTE_3·positivo›"])
    published: list = []
    unsubscribe = core.events.subscribe(lambda m: published.append(m) if m.get("type") == "voice" else None)
    try:
        utt = bridge.say(f"Entre tus cuentas tienes {res['result']}.")
    finally:
        unsubscribe()
    assert utt["segments"] == [{"voice": "cloud", "text": "Entre tus cuentas tienes"},
                               {"voice": "local", "token": "‹SUMA_1›", "say_as": "currency"}]
    assert published == [{"type": "voice", "utterance": utt}]  # events channel: tokens only
    assert wait_until(lambda: "voice" in kinds(phone))
    order = kinds(phone)
    assert order[order.index("voice") - 1] == "render_values"
    assert phone.values["‹SUMA_1›"] == "15.462,58 €"
    assert phone.app == OCHO  # 8 came to the front to say it
    assert wait_until(lambda: utt["utterance"] in bridge.voice_done)
    outs = [e for e in core.AUDIT.events if e["session"] == session and e["kind"] == "voice_out"]
    assert len(outs) == 1 and "sonó en el móvil" in outs[0]["detail"]
    assert not any(v in json.dumps(outs, ensure_ascii=False) for v in SEED_VALUES)
    validator = load_validator(CONTRACTS)
    assert all(validator.is_valid(m) for m in phone.received)


def test_say_with_a_raw_value_is_not_published(rig, session):
    bridge, phone = rig()
    assert core.say(session, "Tienes ES43 9100 0001 5740 1234 5678") is None
    time.sleep(0.2)
    assert "voice" not in kinds(phone)


# ------------------------------------------------------------------ the agent, end to end

def _mount_fake(monkeypatch, session_holder: dict, **phone_kw):
    """agent --android with the bridge on a free port and the fake phone instead of the AVD."""
    real_mount = ca.mount_android

    def mount(session, *, simulated_persona=False, **_):
        bridge = AndroidBridge(session, port=0, core=core, log=lambda _m: None,
                               push_confirms=not simulated_persona).start()
        bridge.present_wait = 0
        phone = FakePhone(f"ws://127.0.0.1:{bridge.port}", **phone_kw).start()
        session_holder.update(bridge=bridge, phone=phone, session=session)
        return real_mount(session, bridge=bridge, events=False, simulated_persona=simulated_persona)

    monkeypatch.setattr(ca, "mount_android", mount)


def test_agent_android_replay_end_to_end(monkeypatch, capsys):
    from agent import agent

    got: dict = {}
    _mount_fake(monkeypatch, got, answer="ok")
    models: list = []

    class Kept(agent.ReplayModel):
        def __init__(self, path):
            super().__init__(path)
            models.append(self)

    monkeypatch.setattr(agent, "ReplayModel", Kept)
    try:  # the replay was recorded for session b2c, the default of --android
        code = agent.main(["--android", "--replay", str(REPLAY)])
        phone, bridge = got["phone"], got["bridge"]
        assert code == 0
        # approved on the phone, then sent: the bank asks the person for the code
        assert phone.page in ("autenticacion", "resultado")
        assert phone.form["importe"] == "200 €" and phone.form["iban"].startswith("ES08 9300")
        order = kinds(phone)
        assert "confirm_request" in order and "voice" in order
        assert order[order.index("confirm_request") - 1] == "render_values"
        assert order[order.index("voice") - 1] == "render_values"
        voice = next(m for m in phone.received if m["type"] == "voice")["utterance"]
        assert {"voice": "local", "token": "‹SUMA_1›", "say_as": "currency"} in voice["segments"]
        assert phone.values["‹SUMA_1›"] == "15.462,58 €"
        assert phone.invalid == [] and bridge.failures == 0
        # nothing that went to the model carried a real value
        assert len(models[0].requests) == 12
        for req in models[0].requests:
            sent = json.dumps(req, ensure_ascii=False)
            assert core.check(sent)["allowed"], sent[:200]
            assert not any(v in sent for v in SEED_VALUES)
        out = capsys.readouterr().out
        assert "‹SUMA_1›" in out and "15.462" not in out  # stdout keeps the tokens
    finally:
        if got:
            got["phone"].stop()
            got["bridge"].stop()


def test_agent_android_waits_for_dictated_tasks(monkeypatch, tmp_path):
    """Without --task, each dictated task (core.next_task, #47) is tokenized and run."""
    from agent import agent

    said = iter(["pasa 200 € a Marta", "¿cuánto tengo?", None])  # None: dictation closed
    asked: list = []

    def next_task(session, timeout=None):
        asked.append(session)
        return next(said)

    monkeypatch.setattr(core, "next_task", next_task, raising=False)
    replay = tmp_path / "dictado.json"
    replay.write_text(json.dumps({"format": "priv8-replay/1", "task": "", "responses": [
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Hecho."}]},
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Hecho otra vez."}]}]}), encoding="utf-8")
    models: list = []

    class Recorded(agent.ReplayModel):
        def __init__(self, record_to=None):
            super().__init__(replay)
            models.append(self)

        def save_recording(self, task):
            pass

    monkeypatch.setattr(agent, "AnthropicModel", Recorded)
    got: dict = {}
    _mount_fake(monkeypatch, got)
    session = f"and{next(_n)}"
    try:
        assert agent.main(["--android", "--session", session]) == 0
        assert asked == [session] * 3
        sent = [json.dumps(r["messages"][0], ensure_ascii=False) for r in models[0].requests]
        assert len(sent) == 2
        assert "‹IMPORTE_1" in sent[0] and "200" not in sent[0]  # the dictated value never reaches Claude
        assert "cuánto tengo" in sent[1]
        voices = [m["utterance"]["segments"][0]["text"] for m in got["phone"].received if m["type"] == "voice"]
        assert voices == ["Hecho.", "Hecho otra vez."]
    finally:
        if got:
            got["phone"].stop()
            got["bridge"].stop()


def test_agent_android_without_task_or_dictation_asks_for_a_task(monkeypatch, capsys):
    from agent import agent

    monkeypatch.delattr(core, "next_task", raising=False)
    assert agent.main(["--android"]) == 2
    assert "--task" in capsys.readouterr().err
