"""Vista de 8 (#154): la copia censurada en el DOM nunca lleva un valor real.

Sin las apps: una página con datos de data/seed.json en todos los sitios donde pueden
esconderse (texto marcado y sin marcar, campos, atributos, imágenes, scripts, texto
oculto), se serializa, el núcleo tapa lo sensible de su texto (core.mask_text), se censura
con vista8.js, se pasa el bloqueo final y se escribe en la página espejo. Ningún dato
sensible de la semilla aparece ni en el HTML ni en el espejo, y el texto de interfaz
(menús, títulos, etiquetas, botones) sale tal cual.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from adapters.web.vista import CENSOR_JS, Vista8, guard, obs_map, secrets_of, tapar

ROOT = Path(__file__).resolve().parents[3]
SEED = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
PROV = SEED["erp"]["proveedores"][0]
IBAN = PROV["iban"]
NOMBRE = PROV["nombre"]
CIF = PROV["cif"]
TRAMPA = SEED["bancos"]["alcor"]["trampa_iban"]
CLAVE = "Clave-Secreta-2026"


def _seed_values() -> list[str]:
    """Los datos sensibles de la semilla: identificadores, nombres, teléfonos, correos (check_seed)."""
    import sys
    sys.path.insert(0, str(ROOT / "data"))
    from check_seed import known
    return [v for _, v in known() if len(v) >= 6]


PAGE = f"""<!doctype html><html lang="es"><head><title>Factura de {NOMBRE}</title>
<meta name="description" content="{IBAN}">
<style>.campo {{ display: flex; gap: 8px }} .oculto {{ display: none }}</style>
<script>window.secreto = "{IBAN}"</script></head>
<body class="app" data-cuenta="{IBAN}">
  <h1 id="titulo" data-p8="heading">Alta de factura</h1>
  <p class="dato"><span>Proveedor</span> <b id="prov" data-p8="text" data-p8-label="Proveedor" title="{NOMBRE}">{NOMBRE}</b></p>
  <div class="campo"><label for="iban">IBAN de pago</label>
    <input id="iban" data-p8="textbox" data-p8-label="IBAN de pago" value="{IBAN}" placeholder="{IBAN}"></div>
  <div class="campo"><label for="clave">Clave</label><input id="clave" type="password" data-p8="textbox" value="{CLAVE}"></div>
  <p id="pie">Nueva cuenta: {TRAMPA}. Saludos, {NOMBRE} ({CIF})</p>
  <span class="oculto">{IBAN}</span>
  <a href="mailto:{PROV.get('email', 'pagos@lumen.es')}" aria-label="{NOMBRE}">Escribir</a>
  <img src="/firma.png" alt="{NOMBRE}" width="80" height="30">
  <input id="sin-marcar" value="{CIF}">
  <textarea>{IBAN}</textarea>
  <div id="nuevo" data-p8="text">{TRAMPA}</div>
  <svg width="10" height="10"><text x="0" y="9">{CIF}</text><title>{NOMBRE}</title></svg>
  <button id="registrar" data-p8="button">Registrar</button>
  <nav class="menu"><b>Compras:</b> <a href="/alta">Alta de factura</a> <a href="/facturas">Facturas recibidas</a>
    <span class="off">Contabilidad</span></nav>
  <h2>Facturas pendientes de pago</h2>
  <label>Buscar <input id="buscar" placeholder="Buscar en el correo"></label>
  <button>Cerrar sesión</button>
  <footer>Empresa 01 - Ejercicio 2026</footer>
  <p id="saldo">Total 1.254,30 €</p>
</body></html>"""

# Lo que leyó el modelo de esa pantalla (e5, #nuevo, aún no lo ha leído).
OBSERVED = {"elements": [
    {"id": "e1", "role": "heading", "text": "Alta de factura", "cls": "verde"},
    {"id": "e2", "role": "text", "label": "Proveedor", "text": "‹NOMBRE_1-maestro›", "cls": "ambar", "tokens": ["‹NOMBRE_1-maestro›"]},
    {"id": "e3", "role": "textbox", "label": "IBAN de pago", "text": "‹IBAN_1-maestro›", "cls": "ambar", "tokens": ["‹IBAN_1-maestro›"]},
    {"id": "e4", "role": "textbox", "label": "Clave", "text": None, "cls": "rojo"},
    {"id": "e6", "role": "button", "label": None, "text": "Registrar", "cls": "verde"},
]}
REFS = {"#titulo": "e1", "#prov": "e2", "#iban": "e3", "#clave": "e4", "#registrar": "e6"}  # #nuevo sin ref


@pytest.fixture(scope="module")
def pw():
    try:
        from playwright.sync_api import sync_playwright
        p = sync_playwright().start()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"sin playwright: {e}")
    yield p
    p.stop()


@pytest.fixture(scope="module")
def core_():
    import importlib
    import os
    import sys
    os.environ.setdefault("PRIV8_AUDIT", "off")
    import core
    core = importlib.reload(core)
    sys.path.insert(0, str(ROOT / "data"))
    from check_seed import known
    core.trust(known())
    return core


@pytest.fixture(scope="module")
def doc(pw, core_):
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_content(PAGE)
    page.evaluate("(refs) => { for (const [s, r] of Object.entries(refs)) document.querySelector(s).setAttribute('data-p8-ref', r) }", REFS)
    page.fill("#iban", IBAN)  # el valor vivo del campo, además del atributo
    args = {"force": True, "key": "1", "obs": obs_map(OBSERVED), "sel": {}, "over": {}}
    textos = page.evaluate(CENSOR_JS, {**args, "fase": "textos"})["textos"]
    secretos = [IBAN, NOMBRE, CIF, TRAMPA, CLAVE]
    mascaras = {}
    for t in textos:
        m = tapar(core_.mask_text("t8", t) or [["t", t]], secretos)
        mascaras[t] = None if m == [["t", t]] else m
    d = page.evaluate(CENSOR_JS, {**args, "fase": "copia", "mascaras": mascaras})
    browser.close()
    return d


def test_ningun_valor_de_la_semilla_en_la_copia(doc):
    todo = doc["head"] + doc["body"] + json.dumps(doc["htmlAttrs"]) + json.dumps(doc["bodyAttrs"]) + doc["text"]
    for v in _seed_values() + [IBAN, NOMBRE, CIF, TRAMPA, CLAVE]:
        assert v not in todo, f"valor real en la vista de 8: {v[:4]}…"
        assert v.replace(" ", "") not in todo.replace(" ", "")


def test_lleva_lo_que_vio_el_modelo(doc):
    assert "‹IBAN_1-maestro›" in doc["body"]           # el valor del campo, ya con su token
    assert "‹NOMBRE_1-maestro›" in doc["body"]
    assert "nunca sale" in doc["body"]                 # la clave
    assert "Alta de factura" in doc["body"] and "Registrar" in doc["body"]  # lo verde se ve
    assert "IBAN de pago" in doc["body"]               # texto sin marcar que el modelo recibió como etiqueta
    assert "<script" not in doc["head"] + doc["body"]
    assert 'class="p8-x"' in doc["body"]               # lo sensible sin token, marcador
    assert doc["head"].count("<style") == 1


def test_la_interfaz_sale_tal_cual(doc):
    """Menús, títulos, etiquetas, botones y placeholders: verde, libre."""
    for ui in ("Compras:", "Alta de factura", "Facturas recibidas", "Contabilidad", "Facturas pendientes de pago",
               "Buscar", "Buscar en el correo", "Cerrar sesión", "Empresa 01 - Ejercicio 2026", "Escribir",
               "Nueva cuenta:", "Saludos,", "Total"):
        assert ui in doc["body"], ui
    assert "1.254,30" not in doc["body"]  # el importe del texto suelto, tapado


def test_bloqueo_final():
    sec = secrets_of({"elements": [{"id": "e3", "text": IBAN, "label": "IBAN de pago"}]},
                     {"elements": [{"id": "e3", "cls": "ambar", "text": "‹IBAN_1-maestro›", "label": "IBAN de pago",
                                    "tokens": ["‹IBAN_1-maestro›"]}]},
                     render=lambda t: IBAN if t == "‹IBAN_1-maestro›" else None)
    assert IBAN in sec and "IBAN de pago" not in sec
    assert guard("IBAN de pago ‹IBAN_1-maestro›", sec) is None
    assert guard(f"pago {IBAN}", sec) == "valor real"
    assert guard(f"pago {IBAN.replace(' ', '')}", sec) == "valor real"  # sin espacios también
    assert guard("x", [], check=lambda s: {"allowed": False, "findings": ["IBAN"]}) == "patrón: IBAN"


def test_el_espejo_solo_recibe_la_copia(pw, doc):
    v = Vista8(pw, {"width": 900, "height": 700}, scale=1)
    try:
        assert v.write(doc, [IBAN, NOMBRE, CIF, TRAMPA, CLAVE])
        html = v.html()
        for x in (IBAN, NOMBRE, CIF, TRAMPA, CLAVE):
            assert x not in html
        assert "‹IBAN_1-maestro›" in html
        assert v.page.evaluate("document.querySelector('#iban').value") == "‹IBAN_1-maestro›"
        # una copia con un valor real no entra: el espejo se queda como estaba
        malo = dict(doc, body=doc["body"] + f"<p>{IBAN}</p>", text=doc["text"] + IBAN)
        assert not v.write(malo, [IBAN])
        assert IBAN not in v.html() and v.blocked == 1
        assert v.call("di", {"texto": "Pulso «Registrar»"}) is True
    finally:
        v.close()
