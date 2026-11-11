"""Auditoría firmada: cadena, firma, verify y el WebSocket de eventos."""

import importlib
import json
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from core.audit import Audit, load_or_create_key, main, verify

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"


def validator(ref):
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + ref}, registry=reg)


def fill(audit, n=5):
    for i in range(n):
        audit.record({"session": "s1", "kind": "observe_sent", "model_saw": f"observe {i}",
                      "tokens": ["‹IBAN_1-maestro›"], "counts": {"verde": 1, "ambar": 1, "rojo": 0}})
    audit.record({"session": "s1", "kind": "blocked", "reason": "destino",
                  "model_saw": "act type e7 ‹IBAN_2-correo›", "tokens": ["‹IBAN_2-correo›"]})


def test_jsonl_firmado_valida_y_verifica(tmp_path):
    key = load_or_create_key(tmp_path / "priv8.key")
    assert (tmp_path / "priv8.pub").exists()
    a = Audit(tmp_path / "priv8.jsonl", key)
    fill(a)
    lines = (tmp_path / "priv8.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lines) == 6
    for line in lines:
        assert not list(validator("audit.schema.json").iter_errors(json.loads(line)))
    assert verify(lines, key.public_key()) == []
    assert main(["verify", str(tmp_path / "priv8.jsonl")]) == 0


@pytest.mark.parametrize("tamper", ["editar", "borrar", "reordenar", "firma ajena"])
def test_verify_detecta_una_linea_alterada(tmp_path, tamper):
    key = Ed25519PrivateKey.generate()
    a = Audit(tmp_path / "a.jsonl", key)
    fill(a)
    lines = (tmp_path / "a.jsonl").read_text(encoding="utf-8").splitlines()
    if tamper == "editar":
        lines[3] = lines[3].replace("observe 3", "observe 9")
    elif tamper == "borrar":
        del lines[2]
    elif tamper == "reordenar":
        lines[1], lines[2] = lines[2], lines[1]
    else:  # contenido y cadena intactos, pero la firma es de otra clave
        import base64
        ev = json.loads(lines[0])
        ev["sig"] = "ed25519:" + base64.b64encode(Ed25519PrivateKey.generate().sign(ev["hash"].encode())).decode()
        lines[0] = json.dumps(ev, ensure_ascii=False, separators=(",", ":"))
    assert verify(lines, key.public_key()) != []


def test_continua_la_cadena_al_reiniciar(tmp_path):
    key = Ed25519PrivateKey.generate()
    fill(Audit(tmp_path / "a.jsonl", key), 2)
    fill(Audit(tmp_path / "a.jsonl", key), 2)
    lines = (tmp_path / "a.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(lines) == 6 and verify(lines, key.public_key()) == []


def test_campos_no_admitidos():
    with pytest.raises(ValueError):
        Audit().record({"session": "s", "kind": "task", "valor_real": "ES91..."})


def test_websocket_de_eventos_y_aprobacion():
    from starlette.testclient import TestClient

    from core import events
    events.clear()
    import core as c
    c = importlib.reload(c)
    from core import server
    server = importlib.reload(server)

    class Phone:
        performed = []

        def snapshot(self):
            return {"source": "android", "app": "es.priv8.banks.alcor", "screen": None, "seq": 1,
                    "focus": None, "system_dialog": None, "elements": [
                        {"id": "r0", "role": "other", "sel": "id/screen_revision"},
                        {"id": "r1", "role": "text", "text": "200,00 €", "sel": "id/rev_importe"},
                        {"id": "r4", "role": "button", "label": "Enviar", "sel": "id/btn_enviar"}]}

        def perform(self, a):
            self.performed.append(a)
            return {"ok": True}

    phone = Phone()
    c.connect("s9", phone)
    with TestClient(server.app).websocket_connect("/events") as ws:
        c.observe("s9")
        got = [json.loads(ws.receive_text()) for _ in range(2)]
        assert {m["type"] for m in got} == {"screen", "audit"}
        for m in got:
            assert not list(validator("events.schema.json").iter_errors(m))
        held = c.act("s9", "tap", "r4")
        msgs = [json.loads(ws.receive_text()) for _ in range(2)]
        req = next(m for m in msgs if m["type"] == "confirm_request")
        assert req["id"] == held["held"]["confirm"]
        ws.send_text(json.dumps({"type": "approval_result", "id": req["id"], "ok": True,
                                 "via": "pantalla", "by": "persona"}))
        types = []
        while "act" not in [m.get("event", {}).get("kind") for m in types if m["type"] == "audit"]:
            types.append(json.loads(ws.receive_text()))
    assert phone.performed == [{"op": "tap", "target": "r4"}]
