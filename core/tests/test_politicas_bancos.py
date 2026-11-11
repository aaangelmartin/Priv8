"""Políticas de las tres apps de banca (#31) contra sus layouts y sus seeds.

Las tres apps (apps/banks-sim) comparten código y layouts; cambian el paquete y el seed.
Aquí se monta cada pantalla con los datos reales del seed, con los mismos formatos que la
app (Money.format, Iban.format), y se pasa por el núcleo de punta a punta.
"""

import importlib
import json
import re
from pathlib import Path

import pytest

from core.policies import load_policies

ROOT = Path(__file__).resolve().parents[2]
BANKS = ROOT / "apps" / "banks-sim"
LAYOUTS = BANKS / "src" / "main" / "res" / "layout"
POLICIES = ROOT / "policies"

APPS = {
    "alcor": ("es.priv8.banks.alcor", "banca-alcor.yaml"),
    "brezo": ("es.priv8.banks.brezo", "brezo-banco.yaml"),
    "nimbo": ("es.priv8.banks.nimbo", "nimbo-broker.yaml"),
}

# Layout → pantalla de la política (las filas item_* se pintan dentro de su pantalla).
LAYOUT_SCREEN = {
    "activity_login": "login",
    "activity_home": "inicio",
    "item_cuenta": "inicio",
    "activity_movements": "movimientos",
    "item_movimiento": "movimientos",
    "activity_transfer": "transferencia",
    "item_contacto": "transferencia",
    "activity_review": "revision",
    "activity_auth": "autenticacion",
    "activity_success": "resultado",
}


def seed(bank):
    return json.loads((BANKS / "src" / bank / "assets" / f"seed-{bank}.json").read_text(encoding="utf-8"))


def eur(cents, signed=False):
    """Money.format / Money.formatSigned de la app."""
    sign = "-" if cents < 0 else ("+" if signed and cents > 0 else "")
    euros, c = divmod(abs(cents), 100)
    return f"{sign}{euros:,}".replace(",", ".") + f",{c:02d} €"


def iban(raw):
    """Iban.format de la app: grupos de cuatro."""
    s = raw.replace(" ", "")
    return " ".join(s[i:i + 4] for i in range(0, len(s), 4))


# ---- paquete y forma ----

def test_paquetes_de_gradle():
    gradle = (BANKS / "build.gradle.kts").read_text(encoding="utf-8")
    ids = dict(re.findall(r'create\("(\w+)"\)\s*\{[^}]*?applicationId = "([\w.]+)"', gradle))
    assert ids == {b: pkg for b, (pkg, _) in APPS.items()}
    ps = load_policies()
    for pkg, _ in APPS.values():
        assert pkg in ps


def _sin_comentarios(path):
    lines = [ln for ln in path.read_text(encoding="utf-8").splitlines() if not ln.lstrip().startswith("#")]
    return "\n".join(lines)


def test_las_tres_politicas_dicen_lo_mismo():
    """Mismo código, mismas reglas: solo cambia el paquete."""
    bodies = {b: _sin_comentarios(POLICIES / f).replace(pkg, "PKG") for b, (pkg, f) in APPS.items()}
    assert bodies["brezo"] == bodies["alcor"]
    assert bodies["nimbo"] == bodies["alcor"]


@pytest.mark.parametrize("bank", APPS)
def test_cada_id_de_los_layouts_tiene_regla(bank):
    policy = load_policies()[APPS[bank][0]]
    screens = {s.id: s for s in policy.screens}
    missing = []
    for xml in sorted(LAYOUTS.glob("*.xml")):
        screen = screens[LAYOUT_SCREEN[xml.stem]]
        for rid in re.findall(r'@\+id/(\w+)', xml.read_text(encoding="utf-8")):
            if rid.startswith("screen_"):
                assert screen.matches({"elements": [{"sel": f"id/{rid}"}]}), rid
                continue
            if screen.rule_for({"sel": f"id/{rid}"}) is None:
                missing.append(f"{xml.stem}:{rid}")
    assert missing == []


@pytest.mark.parametrize("bank", APPS)
def test_criticas_pausas_y_solo_persona(bank):
    by_id = {s.id: s for s in load_policies()[APPS[bank][0]].screens}
    enviar = by_id["revision"].rule_for({"sel": "id/btn_enviar"})
    assert enviar.critica == "transferir"
    assert enviar.resumen == ("id/rev_importe", "id/rev_beneficiario", "id/rev_iban_destino")
    assert by_id["autenticacion"].paused == "autenticacion"
    assert set(by_id["login"].pause_on_focus) == {"id/usuario", "id/clave"}
    for scr, sel in [("login", "id/btn_entrar"), ("autenticacion", "id/btn_huella"),
                     ("autenticacion", "id/btn_confirmar_otp")]:
        assert by_id[scr].rule_for({"sel": sel}).solo_persona, sel
    for scr, sel in [("login", "id/usuario"), ("login", "id/clave"), ("autenticacion", "id/otp")]:
        assert by_id[scr].rule_for({"sel": sel}).cls == "rojo", sel
    # Los campos de pago solo aceptan datos propios o de la ficha, nunca de un tercero.
    campos = by_id["transferencia"].campos()
    assert campos["transferencia.iban"] == ("propio", "maestro")
    assert all("tercero" not in (a or ()) and "correo" not in (a or ()) for a in campos.values())


# ---- pantallas con el seed ----

def _el(n, sel, text=None, role="text", **kw):
    return {"id": f"n{n}", "role": role, "label": kw.pop("label", None), "text": text, "sel": sel, **kw}


def pantallas(bank):
    """Cada pantalla de la app, tal como la pinta Screens.kt, con los datos del seed."""
    s = seed(bank)
    u, accounts, contacts = s["user"], s["accounts"], s["contacts"]
    name = s["bank"]["name"]
    total = sum(a["balance_cents"] for a in accounts)
    a0, dest = accounts[0], contacts[0]
    n = iter(range(1000))

    def el(sel, text=None, role="text", **kw):
        return _el(next(n), sel, text, role, **kw)

    def root(sid):
        return el(f"id/screen_{sid}", role="other")

    screens = {}
    screens["login"] = [
        root("login"), el("id/banco_nombre", name), el("id/login_titulo", "Entra en tu banca"),
        el("id/usuario_label", "Usuario"), el("id/usuario", u["login"], "textbox", actions=["type"]),
        el("id/clave_label", "Clave"), el("id/clave", u["password"], "textbox", password=True, actions=["type"]),
        el("id/btn_entrar", None, "button", label="Entrar", actions=["tap"]),
    ]
    inicio = [root("inicio"), el("id/banco_nombre", name), el("id/saludo", f"Hola, {u['name']}"),
              el("id/saldo_total_label", "Saldo total"), el("id/saldo_total", eur(total)),
              el("id/cuentas_titulo", "Tus cuentas")]
    for a in accounts:
        inicio += [el("id/cuenta", None, "button", label=f"Ver movimientos de {a['alias']}", actions=["tap"]),
                   el("id/cuenta_alias", a["alias"]), el("id/cuenta_iban", iban(a["iban"])),
                   el("id/cuenta_saldo", eur(a["balance_cents"]))]
    inicio += [el("id/btn_transferir", None, "button", label="Transferir", actions=["tap"])]
    screens["inicio"] = inicio
    for a in accounts:
        movs = [root("movimientos"), el("id/titulo", "Movimientos"), el("id/mov_cuenta_alias", a["alias"]),
                el("id/mov_cuenta_iban", iban(a["iban"])), el("id/mov_cuenta_saldo_label", "Saldo"),
                el("id/mov_cuenta_saldo", eur(a["balance_cents"]))]
        for m in (m for m in s["movements"] if m["account"] == a["id"]):
            movs += [el("id/mov_fecha", m["date"]), el("id/mov_concepto", m["concept"]),
                     el("id/mov_contraparte", m["counterparty"]),
                     el("id/mov_importe", eur(m["amount_cents"], signed=True))]
        screens[f"movimientos:{a['id']}"] = movs
    transfer = [root("transferencia"), el("id/titulo", "Nueva transferencia"),
                el("id/origen_alias", a0["alias"]), el("id/origen_iban", iban(a0["iban"])),
                el("id/origen_saldo", f"Disponible: {eur(a0['balance_cents'])}"),
                el("id/contactos_titulo", "Contactos")]
    for c in contacts:
        transfer += [el("id/contacto", None, "button", actions=["tap"]),
                     el("id/contacto_nombre", c["name"]), el("id/contacto_iban", iban(c["iban"]))]
    transfer += [el("id/iban_destino_label", "IBAN de destino"),
                 el("id/iban_destino", iban(dest["iban"]), "textbox", actions=["type"]),
                 el("id/beneficiario", dest["name"], "textbox", actions=["type"]),
                 el("id/importe", "200,00", "textbox", actions=["type"]),
                 el("id/btn_continuar", None, "button", label="Continuar", actions=["tap"])]
    screens["transferencia"] = transfer
    screens["revision"] = [
        root("revision"), el("id/rev_importe_label", "Importe"), el("id/rev_importe", eur(20000)),
        el("id/rev_beneficiario", dest["name"]), el("id/rev_iban_destino", iban(dest["iban"])),
        el("id/rev_origen_alias", a0["alias"]), el("id/rev_origen_iban", iban(a0["iban"])),
        el("id/rev_concepto", "Sin concepto"), el("id/rev_comision", "Sin comisión"),
        el("id/btn_enviar", None, "button", label="Enviar", actions=["tap"]),
        el("id/btn_cancelar", None, "button", label="Cancelar", actions=["tap"]),
    ]
    screens["autenticacion"] = [
        root("autenticacion"), el("id/auth_importe", eur(20000)),
        el("id/otp", u["otp"], "textbox", password=True, actions=["type"]),
        el("id/btn_huella", None, "button", label="Usar huella", actions=["tap"]),
    ]
    screens["resultado"] = [
        root("resultado"), el("id/res_importe", eur(20000)), el("id/res_beneficiario", dest["name"]),
        el("id/res_iban_destino", iban(dest["iban"])), el("id/res_referencia", "TRF-2026-110401"),
        el("id/btn_inicio", None, "button", label="Volver al inicio", actions=["tap"]),
    ]
    return {k: {"source": "android", "app": APPS[bank][0], "screen": None, "seq": i, "focus": None,
                "system_dialog": None, "elements": v} for i, (k, v) in enumerate(screens.items())}


def sensibles(bank):
    """(tipo, valor) de todo lo ámbar del seed, tal como sale en pantalla."""
    s = seed(bank)
    out = {("PERSONA", s["user"]["name"])}
    for a in s["accounts"]:
        out |= {("IBAN", iban(a["iban"])), ("IMPORTE", eur(a["balance_cents"]))}
    out.add(("IMPORTE", eur(sum(a["balance_cents"] for a in s["accounts"]))))
    for c in s["contacts"]:
        out |= {("IBAN", iban(c["iban"])), ("PERSONA", c["name"].split(" - ")[0])}
    for m in s["movements"]:
        out |= {("IMPORTE", eur(m["amount_cents"], signed=True)), ("PERSONA", m["counterparty"]),
                ("MOVIMIENTO", m["concept"])}
    return out


def rojos(bank):
    u = seed(bank)["user"]
    return [u["login"], u["password"], u["otp"]]


class Phone:
    def __init__(self, raw):
        self.raw, self.performed = raw, []

    def snapshot(self):
        return json.loads(json.dumps(self.raw))

    def perform(self, a):
        self.performed.append(a)
        return {"ok": True}


@pytest.fixture
def core():
    import core as c
    return importlib.reload(c)


def _fuera(value, dump):
    """Ni con espacios ni sin ellos, ni la parte numérica de un importe."""
    variants = {value, value.replace(" ", "")}
    if value.endswith(" €"):
        variants.add(value[:-2].lstrip("+-"))
    return [v for v in variants if v in dump]


@pytest.mark.parametrize("bank", APPS)
def test_cada_dato_del_seed_se_tokeniza_y_nada_sale(core, bank):
    phone = Phone(None)
    core.connect("b", phone)
    dumps = []
    for key, raw in pantallas(bank).items():
        phone.raw = raw
        obs = core.observe("b")
        assert "denied" not in obs, (key, obs)
        assert obs["screen"] == key.split(":")[0]
        dumps.append(json.dumps(obs, ensure_ascii=False))
    dump = "\n".join(dumps)
    vault = core.SESSIONS.get("b").vault
    en_boveda = {(e.tipo, e.value) for e in vault.entries()}
    leaks, missing = [], []
    marca = seed(bank)["bank"]["name"]  # el nombre del banco es interfaz (banco_nombre)
    for tipo, value in sorted(sensibles(bank)):
        if value != marca:
            leaks += _fuera(value, dump)
        if (tipo, value) not in en_boveda:
            missing.append((tipo, value))
    assert leaks == []
    assert missing == []
    # Lo rojo ni sale ni entra en la bóveda.
    for value in rojos(bank):
        assert value not in dump
        assert all(value not in e.value for e in vault.entries())


@pytest.mark.parametrize("bank", APPS)
def test_la_suma_del_banco_sale_como_token(core, bank):
    core.connect("b", Phone(pantallas(bank)["inicio"]))
    obs = core.observe("b")
    saldos = [e["text"] for e in obs["elements"] if e["text"] and e["text"].startswith("‹IMPORTE_")]
    total = sum(a["balance_cents"] for a in seed(bank)["accounts"])
    assert core.SESSIONS.get("b").vault.value(saldos[0]) == eur(total)


@pytest.mark.parametrize("bank", APPS)
def test_enviar_queda_retenido(core, bank):
    from core import events
    events.clear()
    seen = []
    events.subscribe(seen.append)
    phone = Phone(pantallas(bank)["revision"])
    core.connect("b", phone)
    obs = core.observe("b")
    enviar = next(e["id"] for e in phone.raw["elements"] if e["sel"] == "id/btn_enviar")
    r = core.act("b", "tap", enviar)
    assert "held" in r, r
    assert phone.performed == []
    req = [m for m in seen if m.get("type") == "confirm_request"][-1]
    assert req["kind"] == "transferir"
    assert "Ángel" not in json.dumps(obs, ensure_ascii=False)
    # Cancelar no es crítico: pasa.
    cancelar = next(e["id"] for e in phone.raw["elements"] if e["sel"] == "id/btn_cancelar")
    assert core.act("b", "tap", cancelar) == {"ok": True}


@pytest.mark.parametrize("bank", APPS)
def test_entrar_y_la_clave_son_de_la_persona(core, bank):
    phone = Phone(pantallas(bank)["login"])
    core.connect("b", phone)
    core.observe("b")
    by_sel = {e["sel"]: e["id"] for e in phone.raw["elements"]}
    assert core.act("b", "tap", by_sel["id/btn_entrar"])["denied"] == "rojo"
    assert core.act("b", "type", by_sel["id/usuario"], "x")["denied"] == "rojo"
    assert phone.performed == []
    # Con el foco en la clave, 8 mira a otro lado.
    phone.raw["focus"] = by_sel["id/clave"]
    assert core.observe("b")["paused"] == "autenticacion"


@pytest.mark.parametrize("bank", APPS)
def test_autenticacion_en_pausa(core, bank):
    core.connect("b", Phone(pantallas(bank)["autenticacion"]))
    obs = core.observe("b")
    assert obs["paused"] == "autenticacion"
    assert seed(bank)["user"]["otp"] not in json.dumps(obs, ensure_ascii=False)


def test_total_entre_los_tres_bancos():
    """La cifra de la demo B2C: 3.412,58 + 12.050,00 + 1.875,40 + 640,00."""
    total = sum(a["balance_cents"] for b in APPS for a in seed(b)["accounts"])
    assert eur(total) == "17.977,98 €"
