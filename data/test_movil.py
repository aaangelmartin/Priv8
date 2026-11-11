"""Las grabaciones de Priv8 en el móvil para demo.priv8.es (#204): cada caso trae su vídeo, su póster y lo que vio
el modelo, y en lo que vio el modelo no hay ningún valor real (solo tokens) ni nada del .env."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "apps" / "demo-site"
MOVIL = SITE / "public" / "movil"
CASOS = re.findall(r"id: '(b2c-[a-z-]+)'", (SITE / "src" / "contenido.js").read_text(encoding="utf-8"))
EMPRESAS = re.findall(r"id: '(b2b-[a-z-]+)'", (SITE / "src" / "contenido.js").read_text(encoding="utf-8"))

# Lo que nunca puede aparecer en lo que vio el modelo: IBAN, importes con céntimos, claves y códigos SMS de los bancos.
PROHIBIDO = [re.compile(r"\bES\d{2}[\s\d]{10,}"), re.compile(r"\d{1,3}(\.\d{3})*,\d{2}\s?€"),
             re.compile(r"(Alcor|Brezo|Nimbo)-2026"), re.compile(r"\b(482913|730518|215664)\b"),
             re.compile(r"sk-ant-")]


def test_hay_casos():
    assert len(CASOS) == 4 and len(EMPRESAS) == 3


def test_cada_caso_del_movil_tiene_su_grabacion():
    for c in CASOS:
        d = json.loads((MOVIL / f"{c}.json").read_text(encoding="utf-8"))
        assert d["formato"] == "priv8-movil/1" and d["caso"] == c
        for f in (d["video"], d["poster"]):
            assert (SITE / "public" / f).exists(), f"{c}: falta {f}"
        assert d["duracion"] > 0 and d["w"] > 0 and d["h"] > 0
        ts = [p["t"] for p in d["pantallas"]]
        assert ts == sorted(ts), f"{c}: pantallas desordenadas"
        for p in d["pantallas"]:
            for e in p.get("elementos", []):
                assert e.get("cls") in ("verde", "ambar", "rojo")
                if e["cls"] == "rojo":
                    assert not e.get("text"), f"{c}: un dato rojo con texto"
                b = e.get("bounds")
                assert b is None or (len(b) == 4 and b[2] >= b[0] and b[3] >= b[1])


def test_lo_que_vio_el_modelo_no_lleva_valores_reales():
    for c in CASOS:
        texto = (MOVIL / f"{c}.json").read_text(encoding="utf-8")
        d = json.loads(texto)
        sin_pedido = texto.replace(json.dumps(d.get("pedido") or "", ensure_ascii=False), "")
        for p in PROHIBIDO:
            assert not p.search(sin_pedido), f"{c}: {p.pattern} en lo publicado"
        assert "·" not in texto


def test_cada_caso_de_empresa_tiene_su_captura():
    for c in EMPRESAS:
        assert (SITE / "public" / "casos" / f"{c}.jpg").exists(), c
