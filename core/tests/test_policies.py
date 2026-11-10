import json
from pathlib import Path

import pytest

from core.policies import DEFAULT_DIR, Policy, load_policies, load_policy

EXAMPLES = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "examples"


def ex(name):
    data = json.loads((EXAMPLES / f"{name}.json").read_text(encoding="utf-8"))
    # Paquete real de Banca Alcor (nota de Ángel en #58); el ejemplo v1 aún usa el antiguo.
    if data.get("app") == "es.alcor.banca":
        data["app"] = "es.priv8.banks.alcor"
    return data


def test_las_tres_politicas_cargan_y_validan():
    ps = load_policies()
    assert {"alba-core", "inbox", "es.priv8.banks.alcor"} <= set(ps.apps)


def test_pantalla_web_por_url():
    ps = load_policies()
    screen = ps.screen_for(ex("snapshot.web-factura"))
    assert screen is not None and screen.id == "factura.alta"
    iban = next(e for e in ex("snapshot.web-factura")["elements"] if e["id"] == "e7")
    rule = screen.rule_for(iban)
    assert rule.tipo == "IBAN" and rule.campo == "pago.iban" and rule.acepta == ("maestro",)


def test_pantalla_android_por_screen_o_por_elementos():
    ps = load_policies()
    snap = ex("snapshot.android-inicio")
    assert ps.screen_for(snap).id == "inicio"
    snap["screen"] = None
    assert ps.screen_for(snap) is None  # sin la raíz id/screen_inicio no se reconoce
    snap["elements"].append({"id": "n0", "role": "other", "sel": "id/screen_inicio"})
    assert ps.screen_for(snap).id == "inicio"


def test_alcor_pausas_solo_persona_y_resumen():
    alcor = load_policies()["es.priv8.banks.alcor"]
    by_id = {s.id: s for s in alcor.screens}
    assert by_id["autenticacion"].paused == "autenticacion"
    assert "id/clave" in by_id["login"].pause_on_focus
    assert by_id["login"].rule_for({"sel": "id/btn_entrar"}).solo_persona
    enviar = by_id["revision"].rule_for({"sel": "id/btn_enviar"})
    assert enviar.critica == "transferir" and len(enviar.resumen) == 3
    assert by_id["inicio"].sin_regla == "ambar"
    assert by_id["inicio"].rule_for({"sel": "id/btn_movimientos"}).cls == "verde"
    assert by_id["inicio"].rule_for({"sel": "id/otra"}) is None


def test_pantalla_sin_politica_no_sale():
    ps = load_policies()
    snap = ex("snapshot.web-factura")
    snap["url"] = "http://127.0.0.1:5173/otra/cosa"
    assert ps.screen_for(snap) is None
    snap["app"] = "desconocida"
    assert ps.screen_for(snap) is None


def test_extract_saludo():
    import re

    screen = load_policies()["es.priv8.banks.alcor"].screen_for(ex("snapshot.android-inicio"))
    saludo = next(e for e in ex("snapshot.android-inicio")["elements"] if e["id"] == "n2")
    rule = screen.rule_for(saludo)
    assert re.match(rule.extract, saludo["text"]).group(1) == "Lucía Ferrer"


def test_inbox_marca_origen_correo():
    for screen in load_policies()["inbox"].screens:
        assert screen.origen == "correo"


def test_acciones_criticas():
    criticas = {
        r.critica
        for p in (load_policy(f) for f in DEFAULT_DIR.glob("*.yaml"))
        for s in p.screens
        for r in s.rules
        if r.critica
    }
    assert {"firmar", "enviar", "transferir"} <= criticas


BASE = {"version": 1, "app": "x", "source": "web"}


@pytest.mark.parametrize(
    "screens, msg",
    [
        ([{"id": "a", "url_re": "/a", "rules": [{"match": {"sel": "#x"}, "cls": "ambar"}]}], "necesita tipo"),
        ([{"id": "a", "url_re": "/a", "rules": [{"match": {}, "cls": "verde"}]}], "match vacío"),
        ([{"id": "a", "rules": []}], "url_re o when"),
        ([{"id": "a", "url_re": "/a"}, {"id": "a", "url_re": "/b"}], "repetidas"),
        ([{"id": "a", "url_re": "/a", "rules": [{"match": {"sel": "#x"}, "cls": "verde", "tipo": "IBAN"}]}], "solo tienen sentido"),
        ([{"id": "a", "url_re": "/a", "rules": [{"match": {"sel": "#x"}, "cls": "verde", "acepta": ["correo"]}]}], "acepta necesita campo"),
        ([{"id": "a", "url_re": "/a", "rules": [{"match": {"sel": "#x"}, "cls": "ambar", "tipo": "IBAN", "extract": "x"}]}], "grupo"),
        ([{"id": "a", "url_re": "/a", "otra": 1}], "Extra inputs"),
        ([{"id": "a", "url_re": "/a", "rules": [{"match": {"sel": "#x"}, "cls": "verde", "resumen": ["#y"]}]}], "resumen necesita critica"),
    ],
)
def test_politicas_invalidas(screens, msg):
    with pytest.raises(ValueError, match=msg):
        Policy.model_validate({**BASE, "screens": screens})


def test_sin_pantallas_no_valida():
    with pytest.raises(ValueError):
        Policy.model_validate({**BASE, "screens": []})
