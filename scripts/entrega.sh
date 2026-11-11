#!/usr/bin/env bash
# Carpeta de entrega para Drive (#192): la presentación, la hoja de una cara, el código de main en ZIP
# (lo mismo que «Download ZIP» de GitHub) y el PDF índice con todos los enlaces.
#
# Uso: scripts/entrega.sh [carpeta]     (o make entrega; por defecto ./entrega, que git ignora)
# Después: sube la carpeta a Drive y compártela con «Cualquier persona con el enlace».
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="${1:-entrega}"
mkdir -p "$OUT"

git fetch -q origin main
git archive --format=zip --prefix=Priv8-main/ -o "$OUT/Laaabs - Código.zip" origin/main
echo "entrega: $OUT/Laaabs - Código.zip ($(git rev-parse --short origin/main))"

pres=docs/entregables/priv8-presentacion.pdf
[ -f "$pres" ] || pres=docs/entregables/priv8-diapositivas.pdf
cp "$pres" "$OUT/Laaabs - Presentación.pdf"
cp docs/entregables/priv8-una-cara.pdf "$OUT/Laaabs - Una cara.pdf"

uv run python - "$OUT/Laaabs - Léeme.pdf" <<'PY'
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

html = Path("docs/entregables/leeme.html").resolve()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto(html.as_uri())
    pg.evaluate("document.fonts.ready")
    pg.pdf(path=sys.argv[1], format="A4", print_background=True, prefer_css_page_size=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
    b.close()
PY
echo "entrega: lista en $OUT"
ls -la "$OUT"
