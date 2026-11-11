#!/usr/bin/env bash
# Instalador de Priv8 para Claude Code (#157).
#
#   curl -fsSL https://mcp.priv8.es/instalar.sh | bash
#
# Qué hace, y nada más:
#   1. Descarga https://mcp.priv8.es/priv8-mcp.tar.gz y su suma SHA-256, y la comprueba.
#   2. Lo descomprime en ~/.priv8/mcp (PRIV8_MCP_DIR para otra carpeta).
#   3. Ejecuta `priv8-mcp instalar`: las dependencias de Python con uv en ~/.priv8/mcp/.venv y
#      Chromium para Playwright en ~/.priv8/mcp/navegadores. Si uv no tiene Python 3.12, lo
#      descarga a su propia caché.
# No usa sudo, no toca tu configuración de Claude Code ni tu PATH y no pide ninguna clave.
# Para quitarlo: claude mcp remove priv8 && rm -rf ~/.priv8/mcp
#
# PRIV8_MCP_URL cambia el origen (por ejemplo http://127.0.0.1:5301 para probar en local).
set -euo pipefail

BASE="${PRIV8_MCP_URL:-https://mcp.priv8.es}"
BASE="${BASE%/}"
DEST="${PRIV8_MCP_DIR:-$HOME/.priv8/mcp}"
say() { printf 'priv8: %s\n' "$*" >&2; }
fail() { say "$*"; exit 1; }

case "$(uname -s)" in
  Darwin|Linux) ;;
  *) fail "Priv8 para Claude Code funciona en macOS y Linux." ;;
esac
command -v curl >/dev/null 2>&1 || fail "hace falta curl"
command -v tar >/dev/null 2>&1 || fail "hace falta tar"
if ! command -v uv >/dev/null 2>&1; then
  say "hace falta uv (el gestor de Python de Astral). Instálalo y vuelve a lanzar este instalador:"
  say "  curl -LsSf https://astral.sh/uv/install.sh | sh     (o: brew install uv)"
  exit 1
fi

sha256() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1
  else sha256sum "$1" | cut -d' ' -f1; fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say "descargando $BASE/priv8-mcp.tar.gz"
curl -fsSL "$BASE/priv8-mcp.tar.gz" -o "$TMP/priv8-mcp.tar.gz" || fail "no se pudo descargar el paquete"
curl -fsSL "$BASE/priv8-mcp.tar.gz.sha256" -o "$TMP/sum" || fail "no se pudo descargar la suma SHA-256"
want="$(cut -d' ' -f1 < "$TMP/sum" | tr -d '[:space:]')"
got="$(sha256 "$TMP/priv8-mcp.tar.gz")"
[ -n "$want" ] && [ "$want" = "$got" ] || fail "la suma SHA-256 no coincide (esperada $want, recibida $got): no se instala nada"
say "SHA-256 $got (comprobada)"

mkdir -p "$TMP/x"
tar -xzf "$TMP/priv8-mcp.tar.gz" -C "$TMP/x"
[ -x "$TMP/x/priv8-mcp/priv8-mcp" ] || fail "el paquete no tiene la forma esperada"

# Una versión anterior: se cambia el código y se conservan .venv, navegadores, .priv8 y audit.
mkdir -p "$DEST"
for old in agent core adapters voice policies data apps priv8-mcp README.md VERSION pyproject.toml uv.lock; do
  rm -rf "${DEST:?}/$old"
done
cp -R "$TMP/x/priv8-mcp/." "$DEST/"
say "Priv8 $(cat "$DEST/VERSION") en $DEST"

"$DEST/priv8-mcp" instalar
