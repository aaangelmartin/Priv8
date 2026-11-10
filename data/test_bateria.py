"""Batería de correos (#44): 10 cambios de cuenta en variantes y 20 legítimos.

    uv run pytest data/test_bateria.py

Comprueba que el detector del núcleo encuentra el IBAN nuevo de cada trampa, se
escriba como se escriba (pie de firma, otro idioma, partido en líneas, en
minúsculas), y que en los correos legítimos solo aparecen IBAN de la ficha.
Qué hacer con ese IBAN (no dejarlo llegar a un campo de pago) lo decide la
procedencia (#10), no el texto del correo.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.detect import FinanceDetector  # noqa: E402
from core.detect.validators import _clean  # noqa: E402
from data.check_seed import known, load  # noqa: E402

SEED = load()
BATERIA = SEED["correo"]["bateria"]
TRAMPAS = [m for m in BATERIA if m["trampa"]]
LEGITIMOS = [m for m in BATERIA if not m["trampa"]]
FICHA = {_clean(p["iban"]) for p in SEED["erp"]["proveedores"]} | {_clean(SEED["empresa"]["iban"])}
DETECT = FinanceDetector(known=known(SEED))


def ibans(text: str) -> set[str]:
    return {_clean(text[s.start:s.end]) for s in DETECT(text) if s.tipo == "IBAN"}


def test_tamano_y_reparto():
    assert len(BATERIA) == 30
    assert len(TRAMPAS) == 10 and len(LEGITIMOS) == 20


def test_ids_unicos_y_fuera_de_la_bandeja():
    ids = [m["id"] for m in BATERIA]
    assert len(set(ids)) == len(ids)
    assert not set(ids) & {m["id"] for m in SEED["correo"]["mensajes"]}


def test_variantes_pedidas_en_el_issue():
    variantes = [m["variante"] for m in TRAMPAS]
    assert len(set(variantes)) == len(variantes)
    assert {"pie", "rectificada"} <= set(variantes)
    assert {"ingles", "frances", "portugues"} & set(variantes)


def test_proveedor_existe():
    provs = {p["id"] for p in SEED["erp"]["proveedores"]}
    assert all(m["proveedor"] is None or m["proveedor"] in provs for m in BATERIA)


@pytest.mark.parametrize("m", TRAMPAS, ids=lambda m: m["variante"])
def test_trampa_el_detector_ve_el_iban_nuevo(m):
    nuevo = _clean(m["trampa_iban"])
    assert nuevo not in FICHA
    assert nuevo in ibans(m["cuerpo"])


@pytest.mark.parametrize("m", LEGITIMOS, ids=lambda m: str(m["id"]))
def test_legitimo_sin_iban_ajeno(m):
    assert ibans(m["cuerpo"]) <= FICHA
