#!/bin/zsh -l
# Doble clic: abre el panel de la demo en directo (#169) en http://127.0.0.1:5170.
# La primera vez instala lo que falte (dependencias de las apps web, del panel y Chromium).
# Cierra esta ventana o pulsa Ctrl-C para pararlo todo.
cd "${0:A:h}" || exit 1
set -e
for t in uv pnpm; do
  command -v $t >/dev/null || { echo "priv8: falta $t (README, Requisitos)"; read -k1 "?Pulsa una tecla para cerrar"; exit 1; }
done
[ -f .env ] || echo "priv8: no hay .env. Copia .env.example a .env y pon ANTHROPIC_API_KEY (README, Configuración)."
[ -d apps/erp-sim/node_modules ] || make web-install
[ -d apps/panel/node_modules ] || (cd apps/panel && pnpm install)
(cd apps/panel && pnpm -s build >/dev/null)
exec uv run python scripts/panel.py
