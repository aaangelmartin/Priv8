from metrics import b2b


def test_b2b_protocol_hides_seed_values():
    r = b2b.run()
    assert r["without_protocol"]["data_to_model"] > 0
    assert r["with_protocol"]["data_to_model"] == 0
    assert r["with_protocol"]["tasks_completed"] == 1
