"""Oráculo: calcula sin revelar y no deja reconstruir una cifra."""

import importlib
import json
from decimal import Decimal
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from core.oraculo import PER_TOKEN, fmt_eur, tramo

CONTRACTS = Path(__file__).resolve().parents[2] / "docs" / "contracts"


def validator():
    base = "https://priv8.dev/contracts/"
    reg = Registry().with_resources(
        (base + p.name, Resource.from_contents(json.loads(p.read_text(encoding="utf-8"))))
        for p in CONTRACTS.glob("*.schema.json")
    )
    return Draft202012Validator({"$ref": base + "tools.schema.json#/$defs/oracle_result"}, registry=reg)


@pytest.fixture
def env():
    import core as c
    c = importlib.reload(c)
    v = c.SESSIONS.get("s2").vault
    toks = [v.tokenize("IMPORTE", x, rasgo_signo=True) for x in ("3.412,58 €", "12.050,00 €", "1.700,00 €")]
    i1 = v.tokenize("IBAN", "ES91 2100 0418 4502 0005 1332", "maestro")
    i2 = v.tokenize("IBAN", "ES4291000005316611223344", "correo")
    return c, toks, (i1, i2)


def test_sum_entre_cuentas(env):
    c, toks, _ = env
    r = c.oracle("s2", "sum", toks)
    assert not list(validator().iter_errors(r))
    assert r["result"] == "‹SUMA_1›" and r["tramo"] == "10.000–100.000" and r["budget_left"] == 29
    assert c.render_values("s2", [r["result"]]) == {"‹SUMA_1›": "17.162,58 €"}
    dump = json.dumps(r, ensure_ascii=False)
    assert "17.162" not in dump and "17162" not in dump and c.check(dump)["allowed"]
    assert c.AUDIT.events[-1]["kind"] == "oracle"


def test_compare_y_matches(env):
    c, toks, (i1, i2) = env
    assert c.oracle("s2", "compare", [toks[0], toks[2]])["result"] == "mayor"
    assert c.oracle("s2", "compare", [toks[2], toks[1]])["result"] == "menor"
    assert c.oracle("s2", "matches", [i1, i2])["result"] == "no coincide"
    assert c.oracle("s2", "matches", [i1, i1])["result"] == "coincide"


@pytest.mark.parametrize("op, args, reason", [
    ("sum", ["‹IMPORTE_9›", "‹IMPORTE_1·positivo›"], "token_desconocido"),
    ("compare", ["‹IMPORTE_1·positivo›"], "sin_regla"),
    ("matches", ["‹IMPORTE_1·positivo›", "‹IBAN_1·maestro›"], "sin_regla"),
    ("sum", ["‹IBAN_1·maestro›", "‹IMPORTE_1·positivo›"], "sin_regla"),
    ("divide", ["‹IMPORTE_1·positivo›", "‹IMPORTE_2·positivo›"], "sin_regla"),
])
def test_rechazos(env, op, args, reason):
    c, _, _ = env
    r = c.oracle("s2", op, args)
    assert r["denied"] == reason
    assert c.AUDIT.events[-1]["kind"] == "blocked"


def test_presupuesto_de_sesion(env):
    c, toks, _ = env
    for _ in range(30):
        assert "result" in c.oracle("s2", "sum", toks[:2])
    assert c.oracle("s2", "sum", toks[:2])["denied"] == "presupuesto"


def test_no_se_reconstruye_una_cifra_por_busqueda_binaria(env):
    """El atacante consigue tantos importes de referencia como quiera (como si los
    escribiera en pantalla) y hace búsqueda binaria contra el saldo secreto."""
    c, toks, _ = env
    secret = toks[0]  # 3.412,58 €
    vault = c.SESSIONS.get("s2").vault
    lo, hi, asked = Decimal(0), Decimal(100000), 0
    while True:
        mid = (lo + hi) / 2
        ref = vault.tokenize("IMPORTE", fmt_eur(mid))
        r = c.oracle("s2", "compare", [secret, ref])
        if "denied" in r:
            assert r["denied"] == "presupuesto"
            break
        asked += 1
        if r["result"] == "mayor":
            lo = mid
        else:
            hi = mid
    assert asked == PER_TOKEN
    assert hi - lo >= Decimal(10000)  # sigue sin saberse ni el orden de los miles


def test_tramos():
    assert [tramo(Decimal(x)) for x in ("-5", "50", "500", "5000", "50000", "500000")] == [
        "negativo", "0–100", "100–1.000", "1.000–10.000", "10.000–100.000", "más de 100.000"]
    assert fmt_eur(Decimal("17162.58")) == "17.162,58 €"
