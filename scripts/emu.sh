#!/usr/bin/env bash
# Start the `priv8` AVD, wait for boot, install APKs and enable 8's
# accessibility service.
#
# Usage:
#   scripts/emu.sh [--headless] [--no-a11y] [apk ...]
#
# Environment:
#   ANDROID_HOME  SDK path (default: ~/Library/Android/sdk)
#   AVD           AVD name (default: priv8)
#   A11Y_SERVICE  component to enable
#                 (default: es.priv8.ocho/.Priv8AccessibilityService)
#
# If the emulator is already running it is reused. Stop it with
#   "$ANDROID_HOME/platform-tools/adb" emu kill
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
AVD="${AVD:-priv8}"
A11Y_SERVICE="${A11Y_SERVICE:-es.priv8.ocho/.Priv8AccessibilityService}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"

headless=0
enable_a11y=1
apks=()
for arg in "$@"; do
  case "$arg" in
    --headless) headless=1 ;;
    --no-a11y) enable_a11y=0 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) apks+=("$arg") ;;
  esac
done

log() { printf '[emu] %s\n' "$*"; }

if "$ADB" devices | grep -q '^emulator-.*device$'; then
  log "emulator already running, reusing it"
else
  emu_args=(-avd "$AVD" -no-snapshot-save -no-boot-anim)
  if [[ $headless -eq 1 ]]; then
    emu_args+=(-no-window -no-audio)
  fi
  log "starting AVD $AVD"
  nohup "$EMULATOR" "${emu_args[@]}" >"${TMPDIR:-/tmp}/priv8-emulator.log" 2>&1 &
fi

log "waiting for device"
"$ADB" wait-for-device
for _ in $(seq 1 180); do
  if [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    break
  fi
  sleep 1
done
if [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]]; then
  log "boot did not complete in 180 s"
  exit 1
fi
log "booted: Android $("$ADB" shell getprop ro.build.version.release | tr -d '\r') (API $("$ADB" shell getprop ro.build.version.sdk | tr -d '\r'))"

for apk in "${apks[@]+"${apks[@]}"}"; do
  log "installing $apk"
  "$ADB" install -r -g "$apk"
done

if [[ $enable_a11y -eq 1 ]]; then
  pkg="${A11Y_SERVICE%%/*}"
  if "$ADB" shell pm path "$pkg" >/dev/null 2>&1; then
    # Android 13+ "restricted settings": if the app was sideloaded from a file
    # or browser, the system silently drops it from the setting below. Lifting
    # the restriction is what "Allow restricted settings" in App info does.
    "$ADB" shell appops set "$pkg" ACCESS_RESTRICTED_SETTINGS allow >/dev/null 2>&1 || true
    current="$("$ADB" shell settings get secure enabled_accessibility_services | tr -d '\r')"
    if [[ "$current" == "null" || -z "$current" ]]; then
      services="$A11Y_SERVICE"
    elif [[ ":$current:" == *":$A11Y_SERVICE:"* ]]; then
      services="$current"
    else
      services="$current:$A11Y_SERVICE"
    fi
    "$ADB" shell settings put secure enabled_accessibility_services "$services"
    "$ADB" shell settings put secure accessibility_enabled 1
    log "accessibility service enabled: $services"
  else
    log "package $pkg not installed, skipping accessibility setup"
  fi
fi

log "ready. Logs: $ADB logcat -s Priv8A11y"
