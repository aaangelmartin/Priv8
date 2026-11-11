"""#24 · Llamar al banco por ti: menú, aviso primero, cesión ante datos rojos y nada del seed al modelo."""

import json
import threading
from pathlib import Path

import pytest

import core
from voice import bank_call as B
from voice import ivr_alcor

SEED = Path(__file__).resolve().parents[2] / "data" / "seed.json"


def seed_values() -> set[str]:
    out: set[str] = set()

    def walk(n):
        if isinstance(n, dict):
            for k, v in n.items():
                if not k.startswith("_"):
                    walk(v)
        elif isinstance(n, list):
            for v in n:
                walk(v)
        elif isinstance(n, str) and len(n) >= 5 and any(c.isdigit() for c in n):
            out.add(n)

    walk(json.loads(SEED.read_text(encoding="utf-8")))
    return out


INVENTED = {"Javier Sanz"}  # el gestor de la línea simulada


@pytest.fixture(autouse=True, scope="module")
def mounted():
    """Como el proceso de la llamada (bank_call.main): los valores de confianza del seed."""
    from data.check_seed import known

    trusted, leak = list(core.TRUSTED), core.LEAK
    core.trust(known())
    yield
    core.TRUSTED[:] = trusted
    core.LEAK = leak


class Spy:
    def __init__(self):
        self.events = []

    def __enter__(self):
        self.orig = core.record
        core.record = lambda e: self.events.append(e) or self.orig(e)
        return self

    def __exit__(self, *a):
        core.record = self.orig


def run(objetivo, session, **kw):
    linea = B.LineaLocal()
    call = B.BankCall(objetivo, session, linea=linea, **kw)
    with Spy() as spy:
        res = call.run()
    return call, linea, res, spy.events


def teclas(linea):
    return [x["tecla"] for x in linea.llamada.log if "tecla" in x]


@pytest.mark.parametrize("objetivo,ruta,motivo", [
    ("Quiero hablar con un gestor", ["3"], "contesta una persona"),
    ("Bloquea mi tarjeta, creo que me la han robado", ["1", "1"], "dato rojo"),
    ("No reconozco un cargo de la tarjeta", ["1", "2"], "dato rojo"),
    ("Haz una transferencia a mi hermana", ["2", "1"], "dato rojo"),
    ("Mi transferencia no ha llegado, quiero saber el estado de la transferencia", ["2", "2"], "identificación"),
])
def test_menu_navigation(objetivo, ruta, motivo):
    call, linea, res, _ = run(objetivo, f"bk-nav-{ruta}-{motivo}")
    assert teclas(linea) == ruta
    assert res["ok"] and res["cedida"] and res["motivo"] == motivo
    assert linea.llamada.cedida_a == "titular"


def test_gestor_waits_on_hold_then_hands_over():
    call, linea, res, events = run("Quiero hablar con un gestor", "bk-hold")
    acciones = [p.accion for p in call.pasos if p.quien == "8"]
    assert acciones.count("espera") >= 2
    assert call.dicho[-1] == B.CEDER_HUMANO
    assert "inteligencia artificial" in B.CEDER_HUMANO and "le paso con su cliente" in B.CEDER_HUMANO.lower()
    details = [e["detail"] for e in events]
    assert any(d.startswith("cedida a la persona") for d in details)
    assert details.count("en espera") >= 2


def test_disclosure_comes_first():
    call, linea, _, events = run("Bloquea mi tarjeta", "bk-aviso")
    lo_que_hace_8 = [x for x in linea.llamada.log if x["de"] == "llamante"]
    assert lo_que_hace_8[0] == {"de": "llamante", "texto": B.AVISO}
    assert call.dicho[0] == B.AVISO
    assert "asistente de inteligencia artificial" in B.AVISO and "en nombre de" in B.AVISO
    kinds = [e["detail"] for e in events]
    assert kinds[0].startswith("inicio") and kinds[1].startswith("aviso")


@pytest.mark.parametrize("estado", ["bloqueo", "cargo_pin", "transferencia_otp", "transferencia_dni"])
def test_red_data_request_hands_over_and_never_answers(estado):
    oido = B.entender(core.tokenize_text("bk-red", ivr_alcor.MENUS[estado]["texto"], origen="tercero"))
    assert oido.tipo in ("pide_rojo", "pide_identidad")


def test_red_request_handover_without_giving_data():
    call, linea, res, events = run("No reconozco un cargo", "bk-pin")
    assert res["motivo"] == "dato rojo"
    # Tras la petición del PIN, 8 no pulsa nada más: solo dice su frase y cede.
    after = linea.llamada.log[[i for i, x in enumerate(linea.llamada.log)
                               if x.get("texto", "").startswith("Para consultar sus cargos")][0] + 1:]
    assert [x for x in after if "tecla" in x] == []
    assert {"de": "llamante", "texto": B.CEDER_DATO} in after
    assert any(e["kind"] == "blocked" and e.get("reason") == "rojo" for e in events)


def test_only_menu_keys_are_pressed():
    call = B.BankCall("x", "bk-keys", linea=B.LineaLocal())
    with pytest.raises(ValueError):
        call._pulsa("1234", [("1", "tarjetas")])
    with pytest.raises(ValueError):
        call._pulsa("7", [("1", "tarjetas")])


def test_no_seed_value_in_anything_model_bound():
    seeds = seed_values() | INVENTED
    alcor = json.loads(SEED.read_text(encoding="utf-8"))["bancos"]["alcor"]
    objetivo = (f"Soy {alcor['titular']}, bloquea mi tarjeta {alcor['tarjetas'][0]['numero']}, "
                f"mi DNI es 12345678Z y mi cuenta {alcor['cuentas'][0]['iban']}")
    for obj, sid in ((objetivo, "bk-seed-1"),
                     (f"Soy {alcor['titular']} y quiero bloquear la tarjeta débito", "bk-seed-5"), ("Quiero hablar con un gestor", "bk-seed-2"),
                     ("Haz una transferencia de 200 € a Marta Ruiz Gil", "bk-seed-3")):
        call, linea, res, events = run(obj, sid)
        bound = "\n".join(call.modelo_vio)
        audit = json.dumps(events, ensure_ascii=False)
        dicho = "\n".join(call.dicho)
        for v in seeds | {"12345678Z", "Marta Ruiz Gil", "200 €", alcor["titular"]}:
            assert v not in bound, v
            assert v not in audit, v
            assert v not in dicho, v
        assert res["cedida"]
    # El objetivo con la tarjeta completa no llega al modelo: se queda en "gestor".
    assert B.intencion(core.tokenize_text("bk-seed-4", objetivo)) == "gestor"


def test_8_sentences_are_cloud_safe():
    from voice.leak_check import PatternLeakCheck

    lc = PatternLeakCheck()
    for f in B.FRASES:
        assert lc.check(f) == [], f
        assert core.check(f)["allowed"], f


def test_audit_events_validate_against_contract():
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource

    contracts = Path(__file__).resolve().parents[2] / "docs" / "contracts"
    schemas = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in contracts.glob("*.schema.json")}
    reg = Registry().with_resources((n, Resource.from_contents(s)) for n, s in schemas.items())
    v = Draft202012Validator(schemas["audit.schema.json"], registry=reg)
    _, _, _, events = run("No reconozco un cargo", "bk-schema")
    stored = [e for e in core.AUDIT.events if e["session"] == "bk-schema"]
    assert len(stored) == len(events) > 3
    for e in stored:
        v.validate(e)


def test_http_line_same_flow():
    srv = ivr_alcor.serve(port=0)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        linea = B.LineaHttp(f"http://127.0.0.1:{srv.server_address[1]}")
        res = B.BankCall("Quiero hablar con un gestor", "bk-http", linea=linea).run()
        assert res["cedida"] and res["motivo"] == "contesta una persona"
    finally:
        srv.shutdown()


def test_claude_navigator_gets_tokens_only():
    seen = []

    class Fake:
        class messages:
            @staticmethod
            def create(**kw):
                seen.append(kw)
                return type("R", (), {"content": [type("B", (), {"text": "3"})()]})()

    nav = B.NavegadorClaude(client=Fake(), model="test-model")
    call, linea, res, _ = run("Soy Lucía Ferrer y quiero hablar con un gestor", "bk-claude", navegador=nav)
    assert teclas(linea) == ["3"] and res["cedida"]
    sent = json.dumps(seen, ensure_ascii=False)
    assert "Lucía Ferrer" not in sent and "‹PERSONA_" in sent


def test_live_mode_off_without_flag_and_keys():
    assert not B.LiveBankCall.enabled({})
    full = {k: "x" for k in B.LIVE_VARS}
    assert not B.LiveBankCall.enabled(full)
    assert B.LiveBankCall.enabled({**full, "PRIV8_LLAMADA_REAL": "1"})
    assert core.check(B.LiveBankCall("x", "bk-live", env={}).prompt("bloquear_tarjeta"))["allowed"]


def test_default_voice_without_keys_is_local():
    assert B.voz_por_defecto("auto", env={}).nombre == "local"
    assert B.voz_por_defecto("texto", env={}).nombre == "texto"
