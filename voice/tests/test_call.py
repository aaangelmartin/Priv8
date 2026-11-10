import pytest

import core
from voice.call import VerificationCall, WrongNumber, make_on_call

PREG = "¿Me confirma el número de la última factura que les pagamos?"
FICHA = "912 345 678"


def mk(numero=FICHA, esperada="F-2026-0371", session="call-t1", **kw):
    return VerificationCall(numero, PREG, esperada, session, env={}, **kw)


def test_dry_run_correct_answer():
    c = mk()
    assert not c.live
    r = c.run()
    assert r["ok"] and r["verificado"]
    assert "F-2026-0371" not in r["transcript_tokens"]
    assert "‹FACTURA_" in r["transcript_tokens"]


def test_dry_run_wrong_answer():
    r = mk(session="call-t2", dry_answer="F-2026-9999").run()
    assert r["ok"] and not r["verificado"]
    assert "F-2026-9999" not in r["transcript_tokens"]


def test_wrong_number_refused():
    with pytest.raises(WrongNumber):
        mk(numero="611 222 333")
    assert make_on_call("call-t3")("611 222 333") is False


def test_opening_discloses_ai_and_recording():
    o = mk().opening()
    assert "asistente de IA" in o and "se graba" in o and PREG in o


def test_on_call_dry_run_and_audit_call_event():
    seen = []
    orig = core.record
    core.record = lambda e: seen.append(e) or orig(e)
    try:
        assert make_on_call("call-t4")(FICHA) is True
    finally:
        core.record = orig
    assert any(e["kind"] == "call" for e in seen)
