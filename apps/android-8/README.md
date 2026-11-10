# apps/android-8

App Android de 8 (paquete `es.priv8.ocho`): una actividad de arranque y el servicio de accesibilidad `Priv8AccessibilityService`, que es el adaptador Android del núcleo.

- **Snapshot** (`SnapshotBuilder.kt`): convierte el árbol de accesibilidad de la ventana activa en un snapshot crudo según `docs/contracts/snapshot.schema.json`. Ids `n1`, `n2`… en preorden, estables dentro de un snapshot; `role` por clase de vista; `label` de `contentDescription`, `labelFor` o la pista; `sel` es el `viewIdResourceName` sin el paquete de la app (`id/iban_destino`); `screen` sale de la vista raíz `screen_<nombre>` si existe. Los campos con `isPassword` llevan `password: true` (rojo) y su texto va enmascarado ya en el dispositivo. Antes de leer espera a que la ventana se asiente: 300 ms sin cambios, la reacción a la última acción y que la ventana activa sea la del último `TYPE_WINDOW_STATE_CHANGED`.
- **Puente** (`BridgeClient.kt`): cliente WebSocket a `ws://127.0.0.1:8765` (por `adb reverse`), mensajes de `docs/contracts/bridge.schema.json`. Envía `hello` al conectar, responde a `snapshot.request` y `perform`, y emite los eventos `focus_password`, `system_dialog`, `system_dialog_closed`, `screen_changed` y `app_changed`. Si se cae, reintenta con espera exponencial de 1 a 30 s.
- **Acciones** (`Performer.kt`): `tap`, `type` (`ACTION_SET_TEXT`), `back`, `open_app` (paquete en `text`), `scroll` (con o sin `target`) y `key` (`enter`, `back`, `home`) sobre el id del último snapshot. Errores del contrato: `target_no_encontrado` (id inexistente o vista que ya no está), `no_permitido` (escribir en un campo de contraseña, operación que no corresponde a la pantalla), `timeout` (más de 5 s) y `otro`.

Logcat (etiqueta `Priv8A11y`) solo recibe tipos de mensaje, ids, recuentos y códigos de error, nunca el contenido de la pantalla ni los valores que manda el núcleo. El volcado crudo del árbol existe para depurar, pero solo se compila activado con `-Ppriv8.a11yDump=true`; nunca con datos reales.

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
~/Library/Android/sdk/platform-tools/adb reverse tcp:8765 tcp:8765
~/Library/Android/sdk/platform-tools/adb logcat -s Priv8A11y
```

`emu.sh` arranca el AVD (o reutiliza el que ya corre), espera al arranque, instala los APK y activa el servicio con `settings put secure enabled_accessibility_services`. Sin `--headless` se abre la ventana del emulador. Para pararlo: `adb emu kill`.

## Probar el puente sin el núcleo

`adapters/android/bridge_dev_server.py` hace de núcleo: acepta la conexión, valida cada mensaje en los dos sentidos contra los contratos y pide snapshots o manda acciones. Es una herramienta de desarrollo; el lado real es del núcleo.

```sh
python3.12 -m pip install -r adapters/android/requirements-dev.txt
python3.12 adapters/android/bridge_dev_server.py --contracts docs/contracts --adb-reverse \
  --run "snap; tap @btn_transferir; snap; type @iban_destino ES4891000004963300998877; snap; expect @iban_destino ES4891000004963300998877"
```

Sin `--run` lee órdenes por la entrada estándar (`snap`, `tap`, `type`, `scroll`, `back`, `open`, `key`, `expect`, `wait`). `@algo` busca el elemento del último snapshot por `sel`, `label` o `text`. El registro enmascara los textos salvo con `--show-values`, solo para datos simulados. Otra URL del núcleo: `./gradlew assembleDebug -Ppriv8.bridgeUrl=ws://127.0.0.1:9000`.

## Ajustes restringidos (Android 13+)

Probado en la issue #26 sobre Android 14 (API 34):

- **Instalado con `adb install`:** no hay restricción. El servicio se activa por `adb shell settings` y también desde Ajustes › Accesibilidad.
- **Instalado desde un archivo o el navegador:** Ajustes muestra el servicio en gris con «Restricted setting», y el sistema descarta el valor de `enabled_accessibility_services` puesto por adb. Se desbloquea con «Allow restricted settings» en Información de la app, o con `adb shell appops set es.priv8.ocho ACCESS_RESTRICTED_SETTINGS allow`. `emu.sh` ya lo hace antes de activar el servicio.
