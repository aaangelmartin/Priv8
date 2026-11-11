"""El catálogo de casos de la demo (#187) y sus grabaciones: cada caso tiene la suya y la web no sale vacía."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "apps" / "console" / "public"
sys.path.insert(0, str(ROOT / "scripts"))

from casos_comun import casos, falta  # noqa: E402


def test_cada_caso_tiene_su_grabacion():
    for c in casos():
        f = PUBLIC / f"{c['feed']}.json"
        assert f.exists(), f"{c['id']}: falta {f.name} (make casos-provisionales)"
        if not c["feed"].startswith("sesion-"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        assert d["formato"] == "priv8-sesion/1"
        assert d.get("caso") == c["id"] and d.get("vertical") == c["vertical"]
        assert isinstance(d.get("provisional"), bool), f"{c['id']}: sin marca provisional"
        assert "·" not in f.read_text(encoding="utf-8")


def test_las_grabaciones_cumplen_su_caso():
    for c in casos():
        if not c.get("comprueba") or not c["feed"].startswith("sesion-"):
            continue
        d = json.loads((PUBLIC / f"{c['feed']}.json").read_text(encoding="utf-8"))
        assert falta([e["msg"] for e in d["eventos"]], c["comprueba"], estricto=False) is None, c["id"]


def test_ids_y_replays():
    ids = [c["id"] for c in casos()]
    assert len(ids) == len(set(ids))
    for c in casos():
        p = (c.get("provisional") or {}).get("replay")
        if p:
            assert (ROOT / p).exists(), f"{c['id']}: falta {p}"
