"""Comprueba data/seed.json (#15): cada IBAN, DNI, NIE, CIF y tarjeta pasa su validación.

    uv run python data/check_seed.py

Sale con código 1 si algún identificador no es válido. También ofrece known()
para core.trust: los valores de confianza del seed como (tipo, valor).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core.detect import validators as V  # noqa: E402

SEED = Path(__file__).resolve().parent / "seed.json"
CHECKS = {"iban": ("IBAN", V.iban), "dni": ("DNI", V.dni), "nie": ("NIE", V.nie),
          "cif": ("CIF", V.cif), "numero": ("TARJETA", V.luhn), "trampa_iban": ("IBAN", V.iban),
          "iban_vigente": ("IBAN", V.iban)}


def load(path: Path = SEED) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def walk(node: Any, path: str = "") -> Iterator[tuple[str, str, Any]]:
    if isinstance(node, dict):
        for k, v in node.items():
            p = f"{path}.{k}" if path else k
            if isinstance(v, (dict, list)):
                yield from walk(v, p)
            else:
                yield p, k, v
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, f"{path}[{i}]")


def identifiers(seed: dict[str, Any]) -> Iterator[tuple[str, str, str]]:
    """(ruta, tipo, valor) de cada identificador del seed. Las tarjetas solo dentro de 'tarjetas'."""
    for p, k, v in walk(seed):
        if k not in CHECKS or not isinstance(v, str):
            continue
        if k == "numero" and ".tarjetas[" not in p:
            continue
        yield p, CHECKS[k][0], v


def known(seed: dict[str, Any] | None = None) -> list[tuple[str, str]]:
    """Valores de confianza para core.trust(): identificadores, proveedores, teléfonos y correos."""
    seed = seed or load()
    out = [(t, v) for _, t, v in identifiers(seed) if t != "TARJETA"]
    for prov in seed["erp"]["proveedores"]:
        out += [("PROVEEDOR", prov["nombre"]), ("TEL", prov["telefono"]), ("EMAIL", prov["email"])]
    for per in seed["personas"]:
        out.append(("PERSONA", per["nombre"]))
    return sorted(set(out))


def main() -> int:
    seed = load()
    bad = [(p, t, v) for p, t, v in identifiers(seed) if not CHECKS[p.rsplit(".", 1)[-1]][1](v)]
    total = sum(1 for _ in identifiers(seed))
    for p, t, v in bad:
        print(f"MAL  {t:8} {p} = {v}")
    ids = [m["id"] for m in seed["correo"]["mensajes"]]
    provs = {p["id"] for p in seed["erp"]["proveedores"]}
    refs = [x["proveedor"] for x in seed["erp"]["pedidos"] + seed["erp"]["facturas"]]
    if len(set(ids)) != len(ids) or not set(refs) <= provs:
        print("MAL  referencias: ids de correo repetidos o proveedor inexistente")
        bad.append(("refs", "", ""))
    print(f"{total - len(bad)} de {total} identificadores válidos" if not bad else f"{len(bad)} errores")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
