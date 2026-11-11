"""Toda la página (#154): los textos sueltos (extra) que el adaptador web añade al snapshot."""

from core.policies import load_policies
from core.screen import observe_screen
from core.vault import Vault
from core.detect import FinanceDetector

IBAN = "ES42 9100 0005 3166 1122 3344"


def _obs(elements, url="http://127.0.0.1:5174/correo/9"):
    raw = {"source": "web", "app": "inbox", "screen": None, "url": url, "seq": 1, "elements": elements}
    screen = load_policies().screen_for(raw)
    vault = Vault("t")
    obs, _ = observe_screen(raw, screen, vault, 10, FinanceDetector(vault=vault))
    return {e["id"]: e for e in obs["elements"]}


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
