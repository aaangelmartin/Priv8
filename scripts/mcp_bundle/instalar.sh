#!/usr/bin/env bash
# Instalador de Priv8 para tu asistente con MCP (#157, #195).
#
#   curl -fsSL https://mcp.priv8.es/instalar.sh | bash
#
# Qué hace, y nada más:
#   1. Descarga https://mcp.priv8.es/priv8-mcp.tar.gz y su suma SHA-256, y la comprueba.
#   2. Lo descomprime en ~/.priv8/mcp (PRIV8_MCP_DIR para otra carpeta).
#   3. Ejecuta `priv8-mcp instalar`: las dependencias de Python con uv en ~/.priv8/mcp/.venv y
#      Chromium para Playwright en ~/.priv8/mcp/navegadores. Si uv no tiene Python 3.12, lo
#      descarga a su propia caché.
#   4. Lo registra como servidor MCP local (stdio) para tu usuario en cada asistente con línea de
#      comandos que encuentre en el PATH, solo si no tiene ya un servidor llamado priv8 (nunca
#      cambia uno que exista; `codex mcp add` y `gemini mcp add` lo sobrescribirían):
#        Claude Code  claude mcp add --scope user priv8 -- ~/.priv8/mcp/priv8-mcp mcp
#        Codex        codex mcp add priv8 -- ~/.priv8/mcp/priv8-mcp mcp
#        Gemini CLI   gemini mcp add --scope user priv8 ~/.priv8/mcp/priv8-mcp mcp
#      Para el resto (Grok CLI, Cursor, opencode...) imprime cómo añadirlo y no toca su configuración.
#      PRIV8_NO_REGISTRAR=1 se salta el registro y solo imprime las líneas.
# No usa sudo, no toca tu PATH y no pide ninguna clave. Se puede lanzar otra vez: actualiza.
# Para quitarlo: quita priv8 de tu asistente (claude mcp remove priv8 --scope user,
# codex mcp remove priv8, gemini mcp remove --scope user priv8) y rm -rf ~/.priv8/mcp
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
  *) fail "Priv8 MCP funciona en macOS y Linux." ;;
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

# Registro en los asistentes que haya, para tu usuario (vale en cualquier carpeta).
LAUNCHER="$DEST/priv8-mcp"
line() { printf '%q ' "$@"; }
# Se lee la configuración de cada asistente en lugar de preguntarle: `claude mcp get` arranca el
# servidor (y con él Chromium), y `codex mcp add` y `gemini mcp add` sobrescriben sin avisar.
# Imprime no (no hay priv8), ours (es este), other (hay otro priv8) o unknown (no se pudo leer).
registered() {
  "$DEST/.venv/bin/python" -I - "$1" "$LAUNCHER" <<'PY'
import json, os, sys
kind, launcher = sys.argv[1], sys.argv[2]
home = os.path.expanduser("~")
paths = {
    "claude": os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or home, ".claude.json"),
    "codex": os.path.join(os.environ.get("CODEX_HOME") or os.path.join(home, ".codex"), "config.toml"),
    "gemini": os.path.join(home, ".gemini", "settings.json"),
}
try:
    p = paths[kind]
    if not os.path.exists(p):
        print("no"); sys.exit()
    if kind == "codex":
        import tomllib
        with open(p, "rb") as f:
            servers = tomllib.load(f).get("mcp_servers") or {}
    else:
        with open(p, encoding="utf-8") as f:
            servers = json.load(f).get("mcpServers") or {}
    s = servers.get("priv8")
    print("no" if not s else "ours" if isinstance(s, dict) and s.get("command") == launcher else "other")
except Exception:
    print("unknown")
PY
}

ASIS=(claude codex gemini)
nombre() { case "$1" in claude) echo "Claude Code" ;; codex) echo "Codex" ;; gemini) echo "Gemini CLI" ;; esac; }
add_cmd() {
  case "$1" in
    claude) ADD=(claude mcp add --scope user priv8 -- "$LAUNCHER" mcp); RM="claude mcp remove priv8 --scope user" ;;
    codex) ADD=(codex mcp add priv8 -- "$LAUNCHER" mcp); RM="codex mcp remove priv8" ;;
    gemini) ADD=(gemini mcp add --scope user priv8 "$LAUNCHER" mcp); RM="gemini mcp remove --scope user priv8" ;;
  esac
}

echo >&2
hechos=0
for a in "${ASIS[@]}"; do
  add_cmd "$a"
  n="$(nombre "$a")"
  if [ "${PRIV8_NO_REGISTRAR:-0}" = 1 ]; then
    say "$n: sin registrar (PRIV8_NO_REGISTRAR=1). Para hacerlo: $(line "${ADD[@]}")"
    continue
  fi
  command -v "$a" >/dev/null 2>&1 || continue
  case "$(registered "$a")" in
    ours) say "$n: Priv8 ya estaba registrado, no se ha tocado"; hechos=$((hechos + 1)) ;;
    other) say "$n: ya tienes otro servidor MCP llamado priv8 y no se ha cambiado. Para usar este:"
           say "  $RM && $(line "${ADD[@]}")" ;;
    unknown) say "$n: no he podido leer su configuración y no la toco. Para registrarlo: $(line "${ADD[@]}")" ;;
    *) if "${ADD[@]}" </dev/null >/dev/null 2>&1; then
         say "$n: registrado para tu usuario: $(line "${ADD[@]}")"
         say "  para deshacerlo: $RM"
         hechos=$((hechos + 1))
       else
         say "$n: no se pudo registrar. Ejecuta tú: $(line "${ADD[@]}")"
       fi ;;
  esac
done
if [ "$hechos" = 0 ] && [ "${PRIV8_NO_REGISTRAR:-0}" != 1 ]; then
  say "no he registrado Priv8 en ningún asistente con línea de comandos. Para hacerlo a mano:"
  for a in "${ASIS[@]}"; do add_cmd "$a"; say "  $(nombre "$a"): $(line "${ADD[@]}")"; done
fi
say "En Grok CLI, Cursor, opencode o cualquier otro asistente MCP, añade un servidor local (stdio)"
say "llamado priv8 con el comando $LAUNCHER y el argumento mcp. Cómo, en cada uno: https://mcp.priv8.es/#pasos"
cat >&2 <<EOF

Listo. Abre tu asistente en cualquier carpeta y pídele:

  Registra en Alba Core la factura que ha llegado por correo de Suministros Lumen

Se abren Chromium con el cursor de 8 y la consola de Priv8 en tu navegador: lo que haya
que aprobar te espera ahí. Para quitarlo todo: quita priv8 de tu asistente y rm -rf $DEST
EOF
