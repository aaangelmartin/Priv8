"""Adaptador web contra el ERP y la bandeja reales, y de punta a punta con el núcleo.

Necesita las dos apps en marcha (5173 y 5174, o PRIV8_ALBA_URL y PRIV8_INBOX_URL
para usar otra copia sin tocar la demo). Si no lo están, las arranca con vite
(hace falta `pnpm install` en apps/erp-sim y apps/inbox-sim) y, si no se puede,
salta los tests.

    uv run pytest adapters/web/tests
    PRIV8_ALBA_URL=http://127.0.0.1:5190 PRIV8_INBOX_URL=http://127.0.0.1:5191 uv run pytest adapters/web/tests
"""

from __future__ import annotations

import importlib
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import pytest

os.environ.setdefault("PRIV8_AUDIT", "off")
os.environ.setdefault("PRIV8_AUDIT_KEY", os.path.join(tempfile.mkdtemp(prefix="priv8-"), "priv8.key"))

from jsonschema import Draft202012Validator  # noqa: E402
from referencing import Registry, Resource  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs" / "contracts"
SEED = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
from adapters.web.adapter import APPS as _URLS  # noqa: E402

APPS = {"alba-core": ("apps/erp-sim", urlparse(_URLS["alba-core"]).port),
        "inbox": ("apps/inbox-sim", urlparse(_URLS["inbox"]).port)}
IBAN_MAESTRO = SEED["erp"]["proveedores"][0]["iban"]
IBAN_TRAMPA = SEED["bancos"]["alcor"]["trampa_iban"]


def _up(port: int) -> bool:
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1)
        return True
    except OSError:
        return False


@pytest.fixture(scope="module")
def servers():
    procs = []
    for path, port in APPS.values():
        if _up(port):
            continue
        if not shutil.which("pnpm") or not (ROOT / path / "node_modules").exists():
            pytest.skip(f"{path} no está en marcha y no se puede arrancar (pnpm install)")
        procs.append(subprocess.Popen(["pnpm", "exec", "vite", "--port", str(port), "--strictPort",
                                       "--host", "127.0.0.1"], cwd=ROOT / path,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(60):
        if all(_up(p) for _, p in APPS.values()):
            break
        time.sleep(0.25)
    else:
        pytest.skip("las apps no arrancaron")
    yield
    for p in procs:
        p.terminate()


@pytest.fixture(scope="module")
def web(servers):
    from adapters.web import WebAdapter

    w = WebAdapter(start="inbox", headless=True)
    w.goto("inbox", "/reset")
    w.goto("alba-core", "/reset")
    yield w
    w.close()


def _login(web):
    web.goto("alba-core", "/login")
    snap = web.snapshot()
    ids = {e["sel"]: e["id"] for e in snap["elements"] if "sel" in e}
    usuario = SEED["erp"]["usuarios"][0]
    assert web.perform({"op": "type", "target": ids["#usuario"], "text": usuario["usuario"]})["ok"]
    assert web.perform({"op": "type", "target": ids["#clave"], "text": usuario["clave"]})["ok"]
    assert web.perform({"op": "tap", "target": ids["#entrar"]})["ok"]


@pytest.fixture(scope="module")
def snapshot_schema():
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + "snapshot.schema.json"}, registry=reg)


def by_sel(snap):
    return {e["sel"]: e for e in snap["elements"] if "sel" in e}


# ---------------------------------------------------------------- snapshots

@pytest.mark.parametrize("app,path,expected", [
    ("inbox", "/bandeja", [".remitente", "#abrir-9"]),
    ("inbox", "/correo/9", ["#de", "#asunto", "#cuerpo", "#adjunto", "#pdf-proveedor", "#pdf-cif",
                            "#pdf-numero", "#pdf-importe", "#responder"]),
    ("inbox", "/responder/9", ["#para", "#texto", "#enviar"]),
    ("alba-core", "/login", ["#usuario", "#clave", "#entrar"]),
])
def test_snapshot_valida_y_trae_los_selectores(web, snapshot_schema, app, path, expected):
    web.goto(app, path)
    snap = web.snapshot()
    snapshot_schema.validate(snap)
    assert snap["app"] == app and snap["source"] == "web" and snap["url"].endswith(path)
    assert set(expected) <= set(by_sel(snap))


def test_campos_del_pdf_salen_del_pdf_real(web):
    a = next(m for m in SEED["correo"]["mensajes"] if m["id"] == 9)["adjunto"]
    web.goto("inbox", "/correo/9")
    snap = web.snapshot()
    s = by_sel(snap)
    for sel, clave in (("#pdf-proveedor", "proveedor"), ("#pdf-cif", "cif"),
                       ("#pdf-numero", "numero"), ("#pdf-importe", "importe")):
        assert s[sel]["text"] == a[clave] and s[sel]["label"].endswith("(PDF)")
    assert len({e["id"] for e in snap["elements"]}) == len(snap["elements"])


def test_erp_logueado_valida(web, snapshot_schema):
    _login(web)
    snap = web.snapshot()
    snapshot_schema.validate(snap)
    s = by_sel(snap)
    for sel in ("#proveedor", "#cif", "#num-factura", "#importe", "#pago-iban", "#importe-pedido",
                "#ver-proveedor", "#registrar"):
        assert sel in s, sel
    assert s["#pago-iban"]["text"] == IBAN_MAESTRO
    assert s["#proveedor"]["actions"] == []  # solo lectura
    assert s["#num-factura"]["actions"] == ["type"]
    web.goto("alba-core", "/proveedores/7")
    ficha = by_sel(web.snapshot())
    assert ficha["#telefono"]["actions"] == ["call"]
    assert ficha["#iban"]["text"] == IBAN_MAESTRO


def test_clave_marcada_como_password(web):
    web.goto("alba-core", "/login")
    clave = by_sel(web.snapshot())["#clave"]
    assert clave["password"] is True


def test_perform_errores(web):
    web.goto("inbox", "/responder/9")
    s = by_sel(web.snapshot())
    assert web.perform({"op": "type", "target": s["#para"]["id"], "text": "x@y.example"}) == {
        "ok": False, "error": "no_permitido"}
    assert web.perform({"op": "tap", "target": "e999"}) == {"ok": False, "error": "target_no_encontrado"}
    assert web.perform({"op": "open_app", "text": "otra"})["ok"] is False


def test_tap_type_y_enviar(web):
    web.goto("inbox", "/responder/9")
    s = by_sel(web.snapshot())
    assert web.perform({"op": "type", "target": s["#texto"]["id"], "text": "Recibida, gracias."})["ok"]
    assert web.perform({"op": "tap", "target": s["#enviar"]["id"]})["ok"]
    snap = web.snapshot()
    assert snap["url"].endswith("/bandeja")
    assert by_sel(snap)["#aviso"]["text"] == "Respuesta enviada"


# ---------------------------------------------------------------- con el núcleo

@pytest.fixture
def core(web):
    import core as c

    c = importlib.reload(c)
    c.connect("b2b", web)
    return c


def _id(obs, label):
    return next(e["id"] for e in obs["elements"] if e.get("label") == label)


def test_punta_a_punta_factura_y_trampa(web, core):
    """Correo → ERP: la factura se registra con tokens y el IBAN del correo no entra."""
    web.goto("alba-core", "/reset")
    _login(web)
    web.goto("inbox", "/correo/9")

    obs = core.observe("b2b")
    assert obs["screen"] == "correo.lectura"
    sent = json.dumps(obs, ensure_ascii=False)
    for real in (IBAN_TRAMPA, "B12345674", "F-2026-0412", "1.254,30"):
        assert real not in sent, real
    ibans = {t for e in obs["elements"] for t in e.get("tokens", []) if t.startswith("‹IBAN_")}
    assert len(ibans) == 1
    trampa = ibans.pop()
    assert trampa.endswith("-correo›")
    pdf = {e["label"]: e for e in obs["elements"] if (e.get("label") or "").endswith("(PDF)")}
    num_tok, imp_tok = pdf["Número (PDF)"]["text"], pdf["Importe (PDF)"]["text"]

    assert core.act("b2b", "open_app", text="alba-core") == {"ok": True}
    alta = core.observe("b2b")
    assert alta["screen"] == "factura.alta"
    assert IBAN_MAESTRO not in json.dumps(alta, ensure_ascii=False)

    # El IBAN que trae el correo no puede ir al campo de pago (procedencia).
    r = core.act("b2b", "type", target=_id(alta, "IBAN de pago"), text=trampa)
    assert r.get("denied") == "destino"

    assert core.act("b2b", "type", target=_id(alta, "Número de factura"), text=num_tok) == {"ok": True}
    assert core.act("b2b", "type", target=_id(alta, "Importe"), text=imp_tok) == {"ok": True}
    snap = by_sel(web.snapshot())
    assert snap["#num-factura"]["text"] == "F-2026-0412"  # rehidratado en local
    assert snap["#pago-iban"]["text"] == IBAN_MAESTRO

    alta = core.observe("b2b")
    registrar = next(e["id"] for e in alta["elements"] if e.get("text") == "Registrar")
    held = core.act("b2b", "tap", target=registrar)
    assert "held" in held, held
    done = core.approve({"type": "approval_result", "id": held["held"]["confirm"], "ok": True,
                         "via": "pantalla", "by": "persona"})
    assert done == {"ok": True}
    assert by_sel(web.snapshot())["#aviso"]["text"] == "Factura registrada"


@pytest.mark.parametrize("app,path,screen", [
    ("inbox", "/bandeja", "bandeja"),
    ("inbox", "/correo/9", "correo.lectura"),
    ("inbox", "/responder/9", "correo.respuesta"),
    ("alba-core", "/facturas/alta", "factura.alta"),
    ("alba-core", "/proveedores/7", "proveedor.ficha"),
    ("alba-core", "/facturas", "facturas.lista"),
    ("alba-core", "/proveedores", "proveedores.lista"),
])
def test_ninguna_pantalla_suelta_datos_del_seed(web, core, app, path, screen):
    if app == "alba-core":
        _login(web)
    web.goto(app, path)
    obs = core.observe("b2b")
    assert obs.get("screen") == screen, obs
    sent = json.dumps(obs, ensure_ascii=False)
    import sys
    sys.path.insert(0, str(ROOT / "data"))
    from check_seed import known
    leaks = [v for t, v in known() if t in ("IBAN", "CIF", "DNI", "NIE", "TEL", "EMAIL") and v in sent]
    seed = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
    numeros = [f["numero"] for f in seed["erp"]["facturas"]] + [p["numero"] for p in seed["erp"]["pedidos"]]
    numeros.append(seed["correo"]["mensajes"][0]["adjunto"]["numero"])
    leaks += [n for n in numeros if n in sent]
    assert leaks == []


def test_open_app_acepta_nombres_naturales():
    from adapters.web.adapter import APPS, app_key
    for n in ("Alba Core", "alba", "ERP", "albacore", "alba-core"):
        assert app_key(n, APPS) == "alba-core"
    for n in ("correo", "Bandeja", "inbox"):
        assert app_key(n, APPS) == "inbox"
    assert app_key("banco", APPS) is None


# ---------------------------------------------------------------- cursor de 8 (#135)

@pytest.fixture(scope="module")
def web_cursor(servers):
    from adapters.web import WebAdapter

    w = WebAdapter(start="inbox", headless=True, cursor=True)
    w.goto("inbox", "/reset")
    yield w
    w.close()


def test_cursor_no_entra_en_el_snapshot(web, web_cursor):
    """La capa del cursor está en la página, pero el snapshot es el mismo que sin ella."""
    import time as _t

    snaps = []
    for w in (web, web_cursor):
        w.goto("inbox", "/reset")  # mismo estado de partida en los dos navegadores
        w.goto("inbox", "/responder/9")
        s = by_sel(w.snapshot())
        t0 = _t.monotonic()
        assert w.perform({"op": "type", "target": s["#texto"]["id"], "text": "Recibida, gracias."})["ok"]
        if w is web_cursor:
            assert _t.monotonic() - t0 < 1.5  # deslizamiento y tecleo visible acotados
        snaps.append(w.snapshot())
    sin, con = snaps
    page = web_cursor._pages["inbox"]
    hay = web_cursor._call(lambda: page.evaluate(
        "() => { const h = document.getElementById('p8-cursor-8');"
        " return !!h && h.hasAttribute('data-p8-ignore') && h.getAttribute('aria-hidden') === 'true'"
        " && getComputedStyle(h).pointerEvents === 'none' && !!h.shadowRoot.querySelector('.cur.on'); }"))
    assert hay  # la capa está y se ve
    assert by_sel(con)["#texto"]["text"] == "Recibida, gracias."
    assert con["elements"] == sin["elements"] and con["focus"] == sin["focus"]
    assert "Escribo en" not in json.dumps(con, ensure_ascii=False)
    # Lo que cuelga de data-p8-ignore no entra aunque lleve data-p8 y se vea.
    web_cursor._call(lambda: page.evaluate(
        "() => { const w = document.createElement('div'); w.setAttribute('data-p8-ignore', '');"
        " const d = document.createElement('span'); d.setAttribute('data-p8', 'text');"
        " d.textContent = 'capa'; w.appendChild(d); document.body.appendChild(w); }"))
    assert "capa" not in json.dumps(web_cursor.snapshot(), ensure_ascii=False)
    assert web.perform({"op": "tap", "target": "e999"})["ok"] is False  # web sigue en marcha


def test_cursor_apagado_con_priv8_cursor(monkeypatch):
    from adapters.web.adapter import cursor_enabled
    monkeypatch.setenv("PRIV8_CURSOR", "0")
    assert cursor_enabled(True) is False
    monkeypatch.setenv("PRIV8_CURSOR", "1")
    assert cursor_enabled(False) is True
    monkeypatch.delenv("PRIV8_CURSOR")
    assert cursor_enabled(True) is True and cursor_enabled(False) is False


# ---------------------------------------------------------------- vista de 8 (#147, #154)

def _wait(cond, timeout=5.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.05)
    return False


def test_vista_de_8_solo_mientras_alguien_mira(web, core, monkeypatch):
    """Con una consola mirando llegan fotogramas JPEG de la vista de 8: la página espejo,
    censurada en el DOM. En su HTML no hay ningún valor de la semilla, solo tokens; sin nadie
    mirando no se copia ni se captura nada. Nunca pasan por el registro (#147, #154)."""
    import base64
    import sys

    sys.path.insert(0, str(ROOT / "data"))
    from check_seed import known

    monkeypatch.setattr(web, "frames", True)  # otras suites ponen PRIV8_FRAMES=0 en el proceso
    web.goto("inbox", "/reset")
    web.goto("inbox", "/correo/9")
    recorded = []
    real_record = core.AUDIT.record
    monkeypatch.setattr(core.AUDIT, "record", lambda ev: recorded.append(ev) or real_record(ev))
    seen = []
    obs = core.observe("b2b")
    assert not web._vista_activa()  # nadie mira todavía
    unsub = core.events.subscribe_frames(seen.append)
    try:
        assert _wait(lambda: any(m["fresh"] and m.get("vista") == "8" for m in seen), timeout=10)
        fresh = next(m for m in seen if m["fresh"])
        assert fresh["app"] == "inbox" and fresh["w"] == 1100 and fresh["mime"] == "image/jpeg"
        assert fresh["rects"] == []  # la censura ya va en la imagen
        assert base64.b64decode(fresh["img"])[:2] == b"\xff\xd8"  # un JPEG de verdad
        tokens = {t for e in obs["elements"] for t in e.get("tokens", [])}
        assert _wait(lambda: any(t in web._call(web._vista.html) for t in tokens))
        html = web._call(web._vista.html)
        leaks = [v for t, v in known() if len(v) >= 6 and v in html]
        assert leaks == [] and IBAN_TRAMPA not in html and IBAN_TRAMPA.replace(" ", "") not in html
        assert web._vista.writes > 0 and web._vista.blocked == 0
        # Mirando, leer la pantalla sigue siendo rápido.
        t0 = time.monotonic()
        web.snapshot()
        assert time.monotonic() - t0 < 0.5
        # Otra pantalla que 8 aún no ha leído: marcadores, y el fotograma no casa.
        web.goto("inbox", "/bandeja")
        assert _wait(lambda: not seen[-1]["fresh"])
        html = web._call(web._vista.html)
        assert "8 aún no ha leído" not in html  # el aviso va en la capa de 8, no en la copia
        assert not [v for t, v in known() if len(v) >= 6 and v in html]
    finally:
        unsub()
    assert _wait(lambda: not web._vista_activa())
    n = len(seen)
    time.sleep(0.6)
    assert len(seen) == n  # sin nadie mirando no hay fotogramas
    assert recorded and all("img" not in json.dumps(ev) for ev in recorded)


def test_vista_de_8_escribe_tokens(web, core, monkeypatch):
    """Mientras 8 escribe un valor rehidratado en el ERP, la vista de 8 enseña el token."""
    monkeypatch.setattr(web, "frames", True)
    web.goto("alba-core", "/reset")
    _login(web)
    web.goto("alba-core", "/facturas/alta")
    unsub = core.events.subscribe_frames(lambda m: None)
    try:
        alta = core.observe("b2b")
        assert _wait(web._vista_activa, timeout=10)
        tok = next(t for e in alta["elements"] for t in e.get("tokens", []) if t.startswith("‹IMPORTE_"))
        assert core.act("b2b", "type", target=_id(alta, "Importe"), text=tok) == {"ok": True}
        assert by_sel(web.snapshot())["#importe"]["text"] != tok  # en la pestaña real, el valor
        core.observe("b2b")
        assert _wait(lambda: web._call(lambda: web._vista.page.evaluate(
            "() => document.querySelector('#importe')?.value")) == tok)
        html = web._call(web._vista.html)
        assert IBAN_MAESTRO not in html and IBAN_MAESTRO.replace(" ", "") not in html
    finally:
        unsub()


# ---------------------------------------------------------------- pantallas conocidas (#148)

@pytest.fixture(scope="module")
def web_known(servers):
    """Como en mount_web: el adaptador sabe qué pantallas tienen política."""
    import core as c
    from adapters.web import WebAdapter

    w = WebAdapter(start="inbox", headless=True,
                   known=lambda raw: c.policies().screen_for(raw) is not None)
    w.goto("inbox", "/reset")
    w.goto("alba-core", "/reset")
    _login(w)
    yield w
    w.close()


def _dead(w, app):
    """La pestaña de `app` en una página sin nada de la app, como tras un back de más."""
    w.app = app
    w._call(lambda: w._page(app).goto("about:blank"))


def _path(w, app):
    return urlparse(w._call(lambda: w._page(app).url)).path


def test_back_nunca_sale_de_la_app(web_known):
    _dead(web_known, "inbox")
    web_known.goto("inbox", "/bandeja")  # el historial empieza en about:blank, como en la demo
    for _ in range(3):  # back de más: dos en el mismo turno, o más
        assert web_known.perform({"op": "back"}) == {"ok": True}
        snap = web_known.snapshot()
        assert urlparse(snap["url"]).netloc == urlparse(_URLS["inbox"]).netloc, snap["url"]
        assert ".remitente" in by_sel(snap)


def test_back_sin_politica_va_al_inicio(web_known):
    web_known.goto("inbox", "/enviados")  # pantalla de la app sin política
    web_known.goto("inbox", "/correo/9")
    assert web_known.perform({"op": "back"}) == {"ok": True}
    assert _path(web_known, "inbox") == "/bandeja"
    web_known.goto("inbox", "/bandeja")
    web_known.goto("inbox", "/correo/9")
    assert web_known.perform({"op": "back"}) == {"ok": True}  # atrás normal: se queda donde toca
    assert _path(web_known, "inbox") == "/bandeja"


def test_back_sin_known_tampoco_sale(web):
    _dead(web, "inbox")
    web.goto("inbox", "/bandeja")
    assert web.perform({"op": "back"}) == {"ok": True}
    assert urlparse(web.snapshot()["url"]).netloc == urlparse(_URLS["inbox"]).netloc


def test_open_app_desde_una_pagina_muerta(web_known):
    _dead(web_known, "alba-core")
    _dead(web_known, "inbox")
    assert web_known.perform({"op": "open_app", "text": "alba-core"}) == {"ok": True}
    assert _path(web_known, "alba-core") == "/facturas/alta"  # con la sesión: no pide la clave
    # Cambiar de app no pierde el estado de una pantalla viva.
    web_known.goto("inbox", "/correo/9")
    assert web_known.perform({"op": "open_app", "text": "alba-core"}) == {"ok": True}
    assert web_known.perform({"op": "open_app", "text": "correo"}) == {"ok": True}
    assert _path(web_known, "inbox") == "/correo/9"


def test_recover_y_reset_view(web_known):
    web_known.goto("inbox", "/enviados")
    assert web_known.recover() is True
    assert _path(web_known, "inbox") == "/bandeja"
    assert web_known.recover() is False  # ya en una pantalla conocida: no se mueve

    web_known.goto("alba-core", "/proveedores/7")
    _dead(web_known, "inbox")
    web_known.reset_view()
    assert web_known.app == "inbox"
    assert _path(web_known, "inbox") == "/bandeja"
    assert _path(web_known, "alba-core") == "/facturas/alta"
    assert web_known.logged_in("alba-core")  # la sesión de Alba Core sigue abierta


def test_observe_con_el_nucleo_se_recupera(web_known):
    import core as c

    c = importlib.reload(c)
    c.connect("b2b", web_known)
    _dead(web_known, "inbox")
    obs = c.observe("b2b")
    assert obs.get("screen") == "bandeja", obs
    # Tras un sin_regla sin salida, open_app sigue funcionando.
    assert c.act("b2b", "open_app", text="alba-core") == {"ok": True}
    assert c.observe("b2b")["screen"] == "factura.alta"
