# apps/android-8

App Android de 8 (paquete `es.priv8.ocho`). Por ahora es un esqueleto: una actividad de arranque y un servicio de accesibilidad (`Priv8AccessibilityService`) que, en cada cambio de ventana, escribe en logcat (etiqueta `Priv8A11y`) el árbol de nodos en JSON compacto: clase, `id`, texto, descripción, `password` y límites.

El volcado lleva datos de pantalla en claro. Solo se usa en el emulador con datos simulados.

## Requisitos

- JDK 17.
- Android SDK en `~/Library/Android/sdk` con `platforms;android-34`, `platform-tools`, `emulator` y `cmdline-tools;latest`.
- AVD `priv8`: Pixel 7, `system-images;android-34;google_apis;arm64-v8a` (Android 14).

Crear el AVD si no existe:

```sh
SDK=~/Library/Android/sdk
$SDK/cmdline-tools/latest/bin/sdkmanager "system-images;android-34;google_apis;arm64-v8a" "platforms;android-34"
echo no | $SDK/cmdline-tools/latest/bin/avdmanager create avd -n priv8 \
  -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_7
```

## Compilar

```sh
cd apps/android-8
ANDROID_HOME=~/Library/Android/sdk ./gradlew assembleDebug
```

El APK queda en `app/build/outputs/apk/debug/app-debug.apk`. La primera vez el wrapper descarga Gradle 8.14.3 y las dependencias; después funciona sin red (`--offline`).

## Ejecutar

Desde la raíz del repositorio:

```sh
scripts/emu.sh --headless apps/android-8/app/build/outputs/apk/debug/app-debug.apk
~/Library/Android/sdk/platform-tools/adb logcat -s Priv8A11y
```

`emu.sh` arranca el AVD (o reutiliza el que ya corre), espera al arranque, instala los APK y activa el servicio con `settings put secure enabled_accessibility_services`. Sin `--headless` se abre la ventana del emulador. Para pararlo: `adb emu kill`.

## Ajustes restringidos (Android 13+)

Probado en la issue #26 sobre Android 14 (API 34):

- **Instalado con `adb install`:** no hay restricción. El servicio se activa por `adb shell settings` y también desde Ajustes › Accesibilidad.
- **Instalado desde un archivo o el navegador:** Ajustes muestra el servicio en gris con «Restricted setting», y el sistema descarta el valor de `enabled_accessibility_services` puesto por adb. Se desbloquea con «Allow restricted settings» en Información de la app, o con `adb shell appops set es.priv8.ocho ACCESS_RESTRICTED_SETTINGS allow`. `emu.sh` ya lo hace antes de activar el servicio.
