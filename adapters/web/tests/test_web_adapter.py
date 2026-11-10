"""Adaptador web contra el ERP y la bandeja reales, y de punta a punta con el núcleo.

Necesita las dos apps en marcha (5173 y 5174). Si no lo están, las arranca con
pnpm (hace falta `pnpm install` en apps/erp-sim y apps/inbox-sim) y, si no se
puede, salta los tests.

    uv run pytest adapters/web/tests
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

import pytest

os.environ.setdefault("PRIV8_AUDIT", "off")
os.environ.setdefault("PRIV8_AUDIT_KEY", os.path.join(tempfile.mkdtemp(prefix="priv8-"), "priv8.key"))

from jsonschema import Draft202012Validator  # noqa: E402
from referencing import Registry, Resource  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "docs" / "contracts"
SEED = json.loads((ROOT / "data" / "seed.json").read_text(encoding="utf-8"))
APPS = {"alba-core": ("apps/erp-sim", 5173), "inbox": ("apps/inbox-sim", 5174)}
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
        procs.append(subprocess.Popen(["pnpm", "dev"], cwd=ROOT / path,
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
    assert trampa.endswith("·correo›")
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
    assert leaks == []
