"""Pares de fotogramas (#187): las grabaciones nunca juntan dos pantallas de pasos distintos.

    uv run pytest scripts/tests

- casos_comun: emparejar, migrar y el comprobador pares_incoherentes.
- grabar_sesion: lo que llega por el canal (un frame de la vista de 8 con su `real`) se guarda
  como un par; quitar repetidos y limitar el ritmo nunca separa los dos; montar escribe `pares`
  y el comprobador lo acepta. Android (grabar_movil.py) sigue con sus capturas en `real`.
- Las grabaciones publicadas en apps/console/public/sesion-*.json pasan el comprobador.
"""

from __future__ import annotations

import base64
import json
import shutil
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent
sys.path.insert(0, str(SCRIPTS))

import casos_comun as cc  # noqa: E402
import grabar_sesion as gs  # noqa: E402

PUBLIC = SCRIPTS.parent / "apps" / "console" / "public"


def _jpeg(color: int) -> str:
    """Unos bytes distintos por color: para el grabador basta con que cambien."""
    return base64.b64encode(b"\xff\xd8" + bytes([color]) * 16).decode()


def _par(n: int, color_v: int, color_r: int, w: int = 1100) -> dict:
    return {"type": "frame", "session": "b2b", "vista": "8", "par": n, "app": "inbox", "w": w, "h": 760,
            "fresh": True, "paused": None, "screen": None, "rects": [], "mime": "image/jpeg", "img": _jpeg(color_v),
            "real": {"app": "inbox", "w": w, "h": 760, "mime": "image/jpeg", "img": _jpeg(color_r)}}


# ------------------------------------------------------------------ casos_comun

def test_emparejar_el_mas_cercano_sin_volver_atras():
    vistas = [{"at": at, "msg": {"type": "frame", "vista": "8", "src": f"v{n}"}}
              for n, at in enumerate([0, 0.2, 2.25, 2.45, 2.66], 1)]
    reales = [{"at": at, "src": f"r{n}", "w": 1100, "h": 760} for n, at in enumerate([0, 2.24, 2.53, 2.84], 1)]
    ps = cc.emparejar(vistas, reales)
    assert [(p["real"]["src"], p["ocho"]["src"]) for p in ps] == [("r1", "v1"), ("r2", "v3"), ("r3", "v4"), ("r4", "v5")]
    assert [p["at"] for p in ps] == [0, 2.25, 2.53, 2.84]  # cuando ya existen los dos
    assert all(p["par"] == p["real"]["par"] == p["ocho"]["par"] == n for n, p in enumerate(ps, 1))
    assert [p["real"] for p in cc.emparejar(vistas[:2], [])] == [None, None]


def test_migrar_y_comprobar():
    vieja = {"formato": "priv8-sesion/1", "duracion": 9,
             "eventos": [{"at": 0, "msg": {"type": "screen"}},
                         {"at": 1, "msg": {"type": "frame", "vista": "8", "src": "v1", "w": 1100, "h": 760}},
                         {"at": 4.5, "msg": {"type": "frame", "vista": "8", "src": "v2", "w": 1100, "h": 760}}],
             "real": [{"at": 0.9, "src": "r1", "w": 1100, "h": 760}, {"at": 4.6, "src": "r2", "w": 1100, "h": 760}]}
    assert cc.pares_incoherentes(vieja) == "fotogramas de la vista de 8 sueltos en eventos (sin pares)"
    m = cc.migrar(vieja)
    assert m["migrado"] and m["real"] == [] and [e["msg"]["type"] for e in m["eventos"]] == ["screen"]
    assert cc.pares_incoherentes(m) is None
    assert cc.migrar(m) is m
    lejos = cc.migrar({**vieja, "real": [{"at": 3.0, "src": "r1", "w": 1100, "h": 760}]})
    assert "a 1.50 s" in cc.pares_incoherentes(lejos)
    android = {"formato": "priv8-sesion/1", "eventos": [], "real": [{"at": 0, "src": "m"}]}
    assert cc.migrar(android) is android and cc.pares_incoherentes(android) is None


@pytest.mark.parametrize("estropear, motivo", [
    (lambda d: d["pares"][1]["real"].update(par=1), "pasos distintos"),
    (lambda d: d["pares"][1].update(at=-1), "antes que el anterior"),
    (lambda d: d["pares"][1]["real"].update(w=900), "distinto tamaño"),
    (lambda d: d["pares"][0]["ocho"].pop("src"), "no tiene la vista de 8"),
    (lambda d: d["eventos"].append({"at": 1, "msg": {"type": "frame", "vista": "8", "src": "x"}}), "sueltos"),
    (lambda d: d.update(real=[{"at": 1, "src": "r"}]), "suelta"),
])
def test_el_comprobador_rechaza_pares_que_no_casan(estropear, motivo):
    d = {"eventos": [], "real": [], "pares": [
        {"at": n * 0.5, "par": n, "real": {"src": f"r{n}", "w": 1100, "h": 760, "par": n},
         "ocho": {"src": f"v{n}", "w": 1100, "h": 760, "par": n}} for n in (1, 2)]}
    assert cc.pares_incoherentes(d) is None
    estropear(d)
    assert motivo in cc.pares_incoherentes(d)


# ------------------------------------------------------------------ grabar_sesion

@pytest.fixture
def grabacion(tmp_path, monkeypatch):
    (tmp_path / "vista").mkdir()
    out = tmp_path / "public"
    out.mkdir()
    monkeypatch.setattr(gs, "PUBLIC", out)
    monkeypatch.setattr(gs, "NOMBRE", "sesion-prueba")
    monkeypatch.setattr(gs, "jpeg", lambda src, dst: shutil.copyfile(src, dst))  # sin ffmpeg
    return tmp_path


def test_el_grabador_guarda_pares_y_no_los_separa(grabacion, monkeypatch):
    rec = gs.Grabacion(grabacion)
    reloj = iter([100.0 + k * 0.05 for k in range(100)])
    monkeypatch.setattr(gs.time, "time", lambda: next(reloj))
    rec.guardar({"type": "task_request", "session": "b2b", "text": "x"})  # 100.0
    rec.guardar(_par(1, 1, 1))     # 100.05
    rec.guardar(_par(2, 1, 1))     # repetido entero: fuera
    rec.guardar(_par(3, 1, 2))     # solo cambia la real: es otro par
    rec.guardar(_par(4, 3, 3))     # dentro del mismo hueco de fps: sustituye entero al anterior
    rec.guardar({"type": "frame", "vista": "real", "img": _jpeg(9), "w": 1100, "h": 760})  # suelta: no entra
    assert len(rec.pares) == 4 and rec.reales == []
    elegidos = gs.elegir(rec.pares, fps=5)
    assert len(elegidos) == 1  # 1 (repetido 2) y 3 y 4 en el mismo quinto de segundo: gana 4
    t, fv, fr, meta_v, _ = elegidos[0]
    assert t == 100.05 and meta_v["par"] == 4 and fv.read_bytes() == base64.b64decode(_jpeg(3))
    assert fr.read_bytes() == base64.b64decode(_jpeg(3))  # y su real es la del mismo par
    sesion = gs.montar(rec, 5, {})
    assert cc.pares_incoherentes(sesion) is None
    assert not any(e["msg"].get("type") == "frame" for e in sesion["eventos"]) and sesion["real"] == []
    p = sesion["pares"][0]
    assert p["real"]["src"] == "sesion-prueba/r0001.jpg" and p["ocho"]["src"] == "sesion-prueba/v0001.jpg"
    assert (gs.PUBLIC / p["real"]["src"]).exists() and (gs.PUBLIC / p["ocho"]["src"]).exists()
    assert "img" not in json.dumps(sesion)


def test_android_sigue_con_sus_capturas(grabacion):
    rec = gs.Grabacion(grabacion, movil=True)
    rec.guardar({"type": "task_request", "session": "b2c", "text": "x"})
    rec.guardar({"type": "frame", "session": "b2c", "app": "alcor", "w": 1080, "h": 2400, "img": _jpeg(1)})
    sesion = gs.montar(rec, 4, {})
    assert "pares" not in sesion and len(sesion["real"]) == 1
    assert cc.pares_incoherentes(sesion) is None


# ------------------------------------------------------------------ grabaciones publicadas

@pytest.mark.parametrize("ruta", sorted(PUBLIC.glob("sesion-*.json")), ids=lambda p: p.name)
def test_grabaciones_publicadas_en_pares(ruta):
    d = json.loads(ruta.read_text(encoding="utf-8"))
    assert cc.pares_incoherentes(d) is None
    for p in d.get("pares", []):
        assert (PUBLIC / p["ocho"]["src"]).exists()
        assert p["real"] is None or (PUBLIC / p["real"]["src"]).exists()
