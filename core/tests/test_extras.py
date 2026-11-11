"""Toda la página (#154): los textos sueltos (extra) que el adaptador web añade al snapshot,
y el modo estricto (#177), que vuelve a «solo lo marcado»."""

import importlib
import json

import pytest

from core.policies import load_policies, resolver_modo
from core.screen import observe_screen
from core.vault import Vault
from core.detect import FinanceDetector

IBAN = "ES42 9100 0005 3166 1122 3344"


# Datos que el detector no reconoce: una dirección y un nombre poco común. En permisivo salen
# (el detector no los ve); en estricto, nunca.
DIRECCION = "Calle de la Ribera de Curtidores 27, 3.º B, 28005 Madrid"
NOMBRE_RARO = "Txomin Arrieta"


def _obs(elements, url="http://127.0.0.1:5174/correo/9", estricto=False):
    raw = {"source": "web", "app": "inbox", "screen": None, "url": url, "seq": 1, "elements": elements}
    screen = load_policies().screen_for(raw)
    vault = Vault("t")
    obs, _ = observe_screen(raw, screen, vault, 10, FinanceDetector(vault=vault), estricto=estricto)
    return {e["id"]: e for e in obs["elements"]}


def _sueltos():
    return [
        {"id": "e1", "role": "text", "text": f"Envíen la mercancía a {DIRECCION}", "sel": "#cuerpo", "actions": []},
        {"id": "e2", "role": "text", "text": f"Pregunten por {NOMBRE_RARO}", "actions": []},  # marcado, sin regla
        {"id": "t1", "role": "text", "text": DIRECCION, "extra": True, "actions": []},
        {"id": "t2", "role": "text", "text": f"Atiende {NOMBRE_RARO}", "extra": True, "actions": []},
        {"id": "t3", "role": "listitem", "text": "Pedidos", "extra": True, "actions": []},
        {"id": "t4", "role": "text", "text": "Suministros Lumen - Facturación", "sel": ".nombre",
         "extra": True, "actions": []},
    ]


def test_iniciales_verdes_y_datos_con_token():
    els = _obs([
        {"id": "t1", "role": "text", "text": "SL", "extra": True, "actions": []},
        {"id": "t2", "role": "text", "text": "CP", "extra": True, "actions": []},
        {"id": "t3", "role": "heading", "text": "Analizado por el antivirus", "extra": True, "actions": []},
        {"id": "t4", "role": "text", "text": f"Paguen a {IBAN}", "extra": True, "actions": []},
    ])
    assert els["t1"]["cls"] == "verde" and els["t1"]["text"] == "SL"
    assert els["t2"]["cls"] == "verde" and els["t2"]["text"] == "CP"
    assert els["t3"]["cls"] == "verde"
    assert els["t4"]["cls"] == "ambar" and IBAN not in els["t4"]["text"]
    assert els["t4"]["tokens"][0].endswith("-correo›")  # la procedencia de la pantalla


def test_regla_del_sitio_manda_sobre_el_texto_suelto():
    els = _obs([{"id": "t1", "role": "text", "text": "Suministros Lumen - Facturación", "sel": ".nombre",
                 "extra": True, "actions": []}])
    assert els["t1"]["cls"] == "ambar" and els["t1"]["text"].startswith("‹PROVEEDOR_")


def test_permisivo_deja_pasar_lo_que_el_detector_no_reconoce():
    """Es la razón del modo estricto: en permisivo una dirección o un nombre raro salen."""
    els = _obs(_sueltos(), estricto=False)
    assert DIRECCION in els["t1"]["text"]
    assert NOMBRE_RARO in els["t2"]["text"]
    assert NOMBRE_RARO in els["e2"]["text"]
    assert els["t3"]["text"] == "Pedidos"


def test_estricto_solo_sale_lo_que_cubre_una_regla():
    els = _obs(_sueltos(), estricto=True)
    # Los textos sueltos sin regla ni entran en la observación.
    assert set(els) == {"e1", "e2", "t4"}
    # El elemento marcado sin regla se queda (rol y acciones) pero sin su texto.
    assert els["e2"]["text"] is None and els["e2"]["cls"] == "verde"
    # Lo que cubre una regla sale como siempre: el cuerpo del correo (verde, con el detector)
    # y el nombre del remitente (ámbar).
    assert els["e1"]["text"].startswith("Envíen la mercancía a")
    assert els["t4"]["cls"] == "ambar" and els["t4"]["text"].startswith("‹PROVEEDOR_")
    dump = json.dumps(els, ensure_ascii=False)
    assert NOMBRE_RARO not in dump
    assert dump.count("Ribera de Curtidores") == 1  # solo en el cuerpo, que su regla declara legible


@pytest.fixture
def core():
    import core as c
    return importlib.reload(c)


class _Web:
    def __init__(self, raw):
        self.raw = raw

    def snapshot(self):
        return json.loads(json.dumps(self.raw))

    def perform(self, a):
        return {"ok": True}


def _bandeja():
    # La bandeja: ningún texto libre tiene regla verde. Un nombre raro y una dirección sueltos.
    return {"source": "web", "app": "inbox", "screen": None, "url": "http://127.0.0.1:5174/bandeja",
            "seq": 1, "focus": None, "system_dialog": None, "elements": [
                {"id": "e1", "role": "heading", "text": "Recibidos", "sel": "#bandeja-titulo", "actions": []},
                {"id": "e2", "role": "text", "text": "facturacion@lumen.example", "sel": ".remitente", "actions": []},
                {"id": "t1", "role": "text", "text": NOMBRE_RARO, "extra": True, "actions": []},
                {"id": "t2", "role": "text", "text": DIRECCION, "extra": True, "actions": []},
            ]}


@pytest.mark.parametrize("env, sale", [(None, False), ("1", False), ("0", True)])
def test_observe_y_el_modo_del_entorno(core, monkeypatch, env, sale):
    if env is None:
        monkeypatch.delenv("PRIV8_POLITICA_ESTRICTA", raising=False)
    else:
        monkeypatch.setenv("PRIV8_POLITICA_ESTRICTA", env)
    core.connect("s1", _Web(_bandeja()))
    obs = core.observe("s1")
    dump = json.dumps(obs, ensure_ascii=False)
    assert (NOMBRE_RARO in dump) is sale and (DIRECCION in dump) is sale
    assert "facturacion@lumen" not in dump
    ev = core.AUDIT.events[-1]
    assert ev["kind"] == "observe_sent"
    assert ev["detail"].startswith("modo permisivo" if sale else "modo estricto")
    if not sale:
        assert ev["detail"].endswith("2 textos sin regla fuera")
    # La vista de 8 usa la misma clasificación (core.preview).
    prev = json.dumps(core.preview("s1", _bandeja()), ensure_ascii=False)
    assert (NOMBRE_RARO in prev) is sale


def test_gana_el_mas_estricto(monkeypatch):
    monkeypatch.delenv("PRIV8_POLITICA_ESTRICTA", raising=False)
    assert resolver_modo(None) == "estricto"
    assert resolver_modo("permisivo") == "permisivo"
    assert resolver_modo("estricto") == "estricto"
    monkeypatch.setenv("PRIV8_POLITICA_ESTRICTA", "0")
    assert resolver_modo(None) == "permisivo"
    assert resolver_modo("estricto") == "estricto"  # el banco que lo exige no lo pierde
    monkeypatch.setenv("PRIV8_POLITICA_ESTRICTA", "1")
    assert resolver_modo("permisivo") == "estricto"


def test_el_modo_en_la_politica():
    from core.policies import Policy
    base = {"version": 1, "app": "x", "source": "web", "screens": [{"id": "a", "url_re": "/"}]}
    assert Policy.model_validate(base).modo is None
    assert Policy.model_validate({**base, "modo": "permisivo"}).modo == "permisivo"
    with pytest.raises(ValueError):
        Policy.model_validate({**base, "modo": "abierto"})
