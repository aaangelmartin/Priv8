"""El mismo trámite sin protocolo (#45): todo en claro, nada retenido ni bloqueado."""

import json
import os

import pytest

os.environ.setdefault("PRIV8_AUDIT", "off")

from metrics.sin_protocolo import TOKEN, generar


@pytest.fixture(scope="module")
def b2b():
    return generar("b2b")


def test_no_queda_ningun_token(b2b):
    assert b2b["tokens_que_quedan"] == 0
    assert not TOKEN.search(json.dumps(b2b["mensajes"], ensure_ascii=False))


def test_el_modelo_ve_los_valores_reales(b2b):
    vistos = b2b["valores_reales_en_lo_que_ve_el_modelo"]
    assert "ES42 9100 0005 3166 1122 3344" in vistos  # el IBAN del correo (la trampa)
    assert "1.254,30 €" in vistos


def test_nada_lo_para(b2b):
    tipos = {m["msg"]["type"] for m in b2b["mensajes"]}
    clases = {m["msg"]["event"]["kind"] for m in b2b["mensajes"] if m["msg"]["type"] == "audit"}
    assert not tipos & {"confirm_request", "approval_result"}
    assert not clases & {"held", "approval", "blocked", "paused"}
    assert all("sig" not in m["msg"].get("event", {}) for m in b2b["mensajes"])


def test_la_trampa_se_escribe(b2b):
    escrito = [m["msg"]["event"] for m in b2b["mensajes"]
               if m["msg"]["type"] == "audit" and m["msg"]["event"].get("detail") == "sin protocolo nada lo para"]
    assert any("ES42 9100 0005 3166 1122 3344" in e["model_saw"] for e in escrito)


def test_pantallas_en_claro(b2b):
    for m in b2b["mensajes"]:
        if m["msg"]["type"] == "screen":
            for e in m["msg"]["observed"]["elements"]:
                assert e["cls"] == "verde" and "tokens" not in e


def test_b2c_tambien():
    r = generar("b2c")
    assert r["tokens_que_quedan"] == 0
    assert "12.050,00 €" in r["valores_reales_en_lo_que_ve_el_modelo"]
