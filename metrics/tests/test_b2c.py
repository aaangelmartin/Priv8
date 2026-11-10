from metrics.b2c import run


def test_b2c_metrics():
    r = run()
    w, wo = r["with_protocol"], r["without_protocol"]
    assert w["data_to_model"] == 0 and wo["data_to_model"] > 0
    assert w["utterances_with_data_to_elevenlabs"] == 0
    assert wo["utterances_with_data_to_elevenlabs"] > 0
    assert w["local_voice_segments"] > 0
    assert w["tasks_completed"] == 1
