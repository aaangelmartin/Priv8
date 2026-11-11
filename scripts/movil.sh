#!/usr/bin/env bash
# B2C en un comando (#48): compila la app 8 y los tres bancos, arranca el AVD
# con scripts/emu.sh (que instala las APK y activa el servicio de accesibilidad)
# y abre los puertos del núcleo hacia el emulador.
#
# Uso:
#   scripts/movil.sh [--headless] [--no-build]
#
#   --headless  sin ventana (lo pasa a emu.sh)
#   --no-build  instala las APK ya compiladas
#
# Entorno: ANDROID_HOME y AVD como en emu.sh; JAVA_HOME con un JDK 17.
#
# Puertos (adb reverse, el móvil ve el portátil en 127.0.0.1):
#   8765  puente del núcleo (snapshot, perform, render_values, confirmaciones)
#   8700  canal de eventos (los ojos de 8 y los subtítulos)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_HOME
ADB="$ANDROID_HOME/platform-tools/adb"
BANKS=(alcor brezo nimbo)

build=1
emu_args=()
for arg in "$@"; do
  case "$arg" in
    --no-build) build=0 ;;
    --headless) emu_args+=(--headless) ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "[movil] opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '[movil] %s\n' "$*"; }

if [[ $build -eq 1 ]]; then
  log "compilando la app 8"
  (cd "$ROOT/apps/android-8" && ./gradlew -q assembleDebug)
  log "compilando ${BANKS[*]}"
  (cd "$ROOT/apps/banks-sim" && ./gradlew -q assembleAlcorDebug assembleBrezoDebug assembleNimboDebug)
fi

apks=("$ROOT/apps/android-8/app/build/outputs/apk/debug/app-debug.apk")
for b in "${BANKS[@]}"; do
  apks+=("$ROOT/apps/banks-sim/build/outputs/apk/$b/debug/banks-sim-$b-debug.apk")
done
for apk in "${apks[@]}"; do
  [[ -f "$apk" ]] || { log "falta $apk (quita --no-build)"; exit 1; }
done

"$ROOT/scripts/emu.sh" "${emu_args[@]+"${emu_args[@]}"}" "${apks[@]}"

for port in 8765 8700; do
  "$ADB" reverse "tcp:$port" "tcp:$port" >/dev/null
done
log "puertos abiertos: $("$ADB" reverse --list | awk '{print $3}' | tr '\n' ' ')"
log "listo. Núcleo en el portátil: PYTHONPATH=. uv run python -m core.server"
