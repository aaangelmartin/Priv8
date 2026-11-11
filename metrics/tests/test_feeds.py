import json
import os
import subprocess
import sys

import pytest

from metrics import b2b, feeds

# Los feeds se generan en un proceso aparte: el núcleo guarda estado por sesión (presupuesto
# del oráculo, auditoría en memoria) y otras pruebas ya han ejecutado la escena b2b aquí.
_SCRIPT = ("import json; from metrics import b2b, feeds; "
           "out = feeds.build(); out['metrics'] = b2b.run(); print(json.dumps(out, ensure_ascii=False))")


@pytest.fixture(scope="module")
def fresh():
    env = {**os.environ, "PRIV8_AUDIT": "off"}
    r = subprocess.run([sys.executable, "-c", _SCRIPT], cwd=feeds.ROOT, env=env,
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def test_feeds_match_metrics(fresh):
    sin, con, metrics = fresh["sin-protocolo"], fresh["con-protocolo"], fresh["metrics"]

    for feed in (sin, con):
        ats = [m["at"] for m in feed]
        assert ats == sorted(ats) and 20 <= ats[-1] <= 45  # ritmo de vídeo
        assert feed[-1]["msg"]["type"] == "fin"

    # Sin protocolo: la cuenta final es la de make metrics y no hay piezas del protocolo.
    fin = sin[-1]["msg"]
    assert fin["valores_al_modelo"] == metrics["without_protocol"]["data_to_model"] > 0
    assert set(fin["valores"]) == set(metrics["without_protocol"]["values"])
    kinds = {m["msg"]["event"]["kind"] for m in sin if m["msg"]["type"] == "audit"}
    assert not kinds & {"blocked", "held", "approval", "oracle"}
    assert all(m["msg"]["type"] in ("screen", "audit", "fin") for m in sin)
    screens = [m["msg"] for m in sin if m["msg"]["type"] == "screen"]
    assert screens[-1]["total"] == fin["valores_al_modelo"]
    assert all(e["text"] == r.get("text") for s in screens
               for e, r in zip(s["observed"]["elements"], s["raw"]["elements"], strict=True))

    # Con protocolo: lo observado no lleva valores del seed y se bloquean los dos datos del correo.
    values = b2b.seed_values()
    for m in con:
        if m["msg"]["type"] == "screen":
            assert m["msg"]["total"] == 0 and not b2b.exposed(m["msg"]["observed"], values)
    blocked = [m for m in con if m["msg"]["type"] == "audit" and m["msg"]["event"]["kind"] == "blocked"]
    assert con[-1]["msg"]["bloqueos"] == len(blocked) == 1  # el IBAN del correo
    assert con[-1]["msg"]["valores_al_modelo"] == metrics["with_protocol"]["data_to_model"] == 0


def test_committed_feeds_are_current(fresh):
    """Los feeds de apps/console/public salen de make sin-protocolo: mismos pasos y mismo resumen."""
    for name in ("sin-protocolo", "con-protocolo"):
        saved = json.loads((feeds.PUBLIC / f"{name}.json").read_text(encoding="utf-8"))
        assert [m["at"] for m in saved] == [m["at"] for m in fresh[name]]
        assert saved[-1]["msg"] == fresh[name][-1]["msg"]
