import json

import pytest

from core.leak import LeakCheck
from core.vault import VaultStore

IBAN = "ES4391000001574012345678"


@pytest.fixture
def lc():
    store = VaultStore()
    v = store.get("s1")
    v.tokenize("IBAN", "ES43 9100 0001 5740 1234 5678", "propio")
    v.tokenize("PERSONA", "Lucía Ferrer", "titular")
    v.tokenize("IMPORTE", "3.412,58 €", rasgo_signo=True)
    return LeakCheck(store, known=[("PERSONA", "Marta Ruiz Gil")])


def claude_request(text):
    return json.dumps({"model": "claude-opus-5-5", "messages": [{"role": "user", "content": text}]})


def test_solo_tokens_sale(lc):
    r = lc.check(claude_request("Entre tus cuentas tienes ‹SUMA_1›. ‹IBAN_1-propio› es de ‹PERSONA_1-titular›."))
    assert r == {"allowed": True, "findings": []}


@pytest.mark.parametrize("leak, finding", [
    ("Tu cuenta ES43 9100 0001 5740 1234 5678", "IBAN"),
    (f"iban {IBAN.lower()}", "boveda:IBAN"),
    ("Hola Lucía Ferrer", "boveda:PERSONA"),
    ("hola lucía ferrer", "boveda:PERSONA"),
    ("paga a Marta Ruiz Gil", "boveda:PERSONA"),
    ("tienes 3.412,58 €", "IMPORTE"),
    ("código 482913", "rojo"),
    ("4111 1111 1111 1111", "rojo"),
    ("DNI 12345678Z", "DNI"),
])
def test_valor_de_seed_inyectado_no_sale(lc, leak, finding):
    r = lc.check(claude_request(f"Resumen: {leak}."))
    assert r["allowed"] is False
    assert finding in r["findings"]
    assert all(leak not in f for f in r["findings"])  # nunca el valor


def test_escapes_json_no_esconden_el_dato(lc):
    payload = json.dumps({"content": "Hola Lucía Ferrer"}, ensure_ascii=True)
    assert "\\u00ed" in payload
    assert lc.check(payload)["allowed"] is False


def test_token_falso_no_tapa_un_dato(lc):
    # Un token mal formado no se quita, y el IBAN de dentro se ve
    assert lc.check(f"‹IBAN_1 {IBAN}›")["allowed"] is False


def test_payload_no_texto_y_errores_fallan_cerrado(lc):
    assert lc.check({"content": "Lucía Ferrer"})["allowed"] is False

    class Rara:
        def __str__(self):
            raise RuntimeError

    r = lc.check(Rara())
    assert r["allowed"] is False and r["findings"][0].startswith("error:")


def test_frase_de_voz_cloud(lc):
    assert lc.check("Entre tus tres cuentas tienes")["allowed"] is True
    assert lc.check("Entre tus tres cuentas tienes 15.462,58 €")["allowed"] is False
