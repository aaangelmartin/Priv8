#!/usr/bin/env bash
# Demo B2B en un comando (#137): Alba Core con la sesión abierta, el correo, la consola
# y 8 esperando encargos en la consola. Nada que teclear antes de pedirle algo a 8.
#
# Uso:
#   scripts/demo_b2b.sh            (o make demo-b2b)
#
# - Arranca Alba Core (:5173), el correo (:5174) y la consola (:5175) si no están en marcha.
#   Alba Core arranca con VITE_ALBA_SESION=admin.alba: abre como el ordenador de la empresa,
#   con la sesión ya abierta. Nadie escribe la clave; si la persona cierra la sesión, se pide
#   otra vez como siempre. Si Alba Core ya estaba en marcha sin esa variable, vale la sesión
#   recordada en el perfil de Chromium (.priv8/chromium) o, la primera vez, entra la persona.
# - Lanza el agente (python -m agent.agent --web) con el .env si existe (ANTHROPIC_API_KEY,
#   PRIV8_MODEL). Ctrl-C para el agente y las apps que arrancó este script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CONSOLE_URL="http://127.0.0.1:5175"
export VITE_ALBA_SESION="${VITE_ALBA_SESION:-admin.alba}"

up() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/"; }
port_busy() { nc -z 127.0.0.1 "$1" 2>/dev/null; }

if port_busy 8700; then
  echo "priv8: el puerto 8700 está ocupado: ya hay un agente en marcha. Páralo antes (Ctrl-C en su terminal)." >&2
  exit 1
fi

started=()  # puertos de las apps que arranca este script: solo esas se paran al salir
cleanup() {
  for port in ${started[@]+"${started[@]}"}; do
    lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

for app in erp-sim:5173 inbox-sim:5174 console:5175; do
  dir="apps/${app%%:*}"; port="${app##*:}"
  if up "$port"; then
    echo "priv8: $dir ya está en marcha en :$port" >&2
    [ "$dir" = apps/erp-sim ] && echo "priv8: (si no tiene la sesión de la demo, vale la recordada o entra la persona)" >&2
    continue
  fi
  if [ ! -d "$dir/node_modules" ]; then
    echo "priv8: faltan las dependencias de $dir: make web-install" >&2
    exit 1
  fi
  (cd "$dir" && exec pnpm dev >/dev/null 2>&1) &
  started+=("$port")
done

for port in 5173 5174 5175; do
  for _ in $(seq 1 60); do up "$port" && break; sleep 0.5; done
  up "$port" || { echo "priv8: la app de :$port no arrancó" >&2; exit 1; }
done

env_file=()
[ -f .env ] && env_file=(--env-file .env)
echo "priv8: consola lista en $CONSOLE_URL (pide el encargo a 8 ahí, por ejemplo «registrar factura»)" >&2
uv run ${env_file[@]+"${env_file[@]}"} python -m agent.agent --web ${TASK:+--task "$TASK"}
