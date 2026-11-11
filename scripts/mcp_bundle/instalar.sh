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
#   4. Si `claude` está en el PATH y priv8 no está ya registrado, lo registra en Claude Code para
#      tu usuario: claude mcp add --scope user priv8 -- ~/.priv8/mcp/priv8-mcp mcp
#      (PRIV8_NO_REGISTRAR=1 se lo salta). Sin `claude`, imprime esa línea para que la ejecutes tú.
# No usa sudo, no toca tu PATH y no pide ninguna clave. Se puede lanzar otra vez: actualiza.
# Para quitarlo: claude mcp remove priv8 --scope user && rm -rf ~/.priv8/mcp
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
for old in agent core adapters voice policies data apps priv8-mcp README.md LICENSE VERSION pyproject.toml uv.lock; do
  rm -rf "${DEST:?}/$old"
done
cp -R "$TMP/x/priv8-mcp/." "$DEST/"
say "Priv8 $(cat "$DEST/VERSION") en $DEST"

PRIV8_SIN_COMANDO=1 "$DEST/priv8-mcp" instalar

# Registro en Claude Code, para tu usuario (vale en cualquier carpeta).
LAUNCHER="$DEST/priv8-mcp"
ADD=(claude mcp add --scope user priv8 -- "$LAUNCHER" mcp)
line() { printf '%q ' "$@"; }
# `claude mcp get` comprueba el servidor arrancándolo (y con él Chromium): se lee la configuración.
registered() {
  "$DEST/.venv/bin/python" -I - "$LAUNCHER" <<'PY'
import json, os, sys
d = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~")
try:
    cfg = json.load(open(os.path.join(d, ".claude.json"), encoding="utf-8"))
except Exception:
    print("no"); sys.exit()
s = (cfg.get("mcpServers") or {}).get("priv8")
print("no" if not s else "ours" if s.get("command") == sys.argv[1] else "other")
PY
}
if [ "${PRIV8_NO_REGISTRAR:-0}" = 1 ]; then
  reg=omitido
elif ! command -v claude >/dev/null 2>&1; then
  reg=sin_claude
else
  case "$(registered)" in
    ours) reg=ya ;;
    other) reg=otro ;;
    *) if "${ADD[@]}" >/dev/null 2>&1; then reg=hecho; else reg=fallo; fi ;;
  esac
fi

echo >&2
case "$reg" in
  hecho) say "registrado en Claude Code para tu usuario: $(line "${ADD[@]}")"
         say "para deshacerlo: claude mcp remove priv8 --scope user" ;;
  ya) say "Priv8 ya estaba registrado en Claude Code: no se ha tocado" ;;
  otro) say "ya tienes otro servidor MCP llamado priv8 y no se ha cambiado. Para usar este:"
        say "  claude mcp remove priv8 --scope user && $(line "${ADD[@]}")" ;;
  fallo) say "no se pudo registrar en Claude Code. Ejecuta tú: $(line "${ADD[@]}")" ;;
  sin_claude) say "no encuentro Claude Code (claude). Cuando lo tengas, ejecuta: $(line "${ADD[@]}")" ;;
  omitido) say "sin registrar (PRIV8_NO_REGISTRAR=1). Para hacerlo: $(line "${ADD[@]}")" ;;
esac
cat >&2 <<EOF

Listo. Abre Claude Code en cualquier carpeta (claude) y pídele:

  Registra en Alba Core la factura que ha llegado por correo de Suministros Lumen

Se abren Chromium con el cursor de 8 y la consola de Priv8 en tu navegador: lo que haya
que aprobar te espera ahí. Para quitarlo todo: claude mcp remove priv8 --scope user && rm -rf $DEST
EOF
