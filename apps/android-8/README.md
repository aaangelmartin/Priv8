# apps/android-8

App Android de 8 (paquete `es.priv8.ocho`): una actividad de arranque y el servicio de accesibilidad `Priv8AccessibilityService`, que es el adaptador Android del núcleo.

- **Snapshot** (`SnapshotBuilder.kt`): convierte el árbol de accesibilidad de la ventana activa en un snapshot crudo según `docs/contracts/snapshot.schema.json`. Ids `n1`, `n2`… en preorden, estables dentro de un snapshot; `role` por clase de vista; `label` de `contentDescription`, `labelFor` o la pista; `sel` es el `viewIdResourceName` sin el paquete de la app (`id/iban_destino`); `screen` sale de la vista raíz `screen_<nombre>` si existe. Los campos rojos (`RojoField.kt`: `isPassword`, tipo de entrada de contraseña como `numberPassword` de los OTP, o un campo editable cuyo id, pista o etiqueta nombra un secreto: otp, pin, clave, código...) llevan `password: true` y su texto va enmascarado ya en el dispositivo; 8 no escribe en ellos. Antes de leer espera a que la ventana se asiente: 300 ms sin cambios, la reacción a la última acción y que la ventana activa sea la del último `TYPE_WINDOW_STATE_CHANGED`.
- **Puente** (`BridgeClient.kt`): cliente WebSocket a `ws://127.0.0.1:8765` (por `adb reverse`), mensajes de `docs/contracts/bridge.schema.json` (contratos v1.1). Envía `hello` al conectar, responde a `snapshot.request` y `perform`, y emite los eventos `focus_password`, `focus_left`, `system_dialog`, `system_dialog_closed`, `screen_changed` y `app_changed`. Si se cae, reintenta con espera exponencial de 1 a 30 s.
- **Acciones** (`Performer.kt`): `tap`, `type` (`ACTION_SET_TEXT`), `back`, `open_app` (paquete en `text`), `scroll` (con o sin `target`) y `key` (`enter`, `back`, `home`) sobre el id del último snapshot. Errores del contrato: `target_no_encontrado` (id inexistente o vista que ya no está), `no_permitido` (escribir en un campo de contraseña, operación que no corresponde a la pantalla), `timeout` (más de 5 s) y `otro`.

Logcat (etiqueta `Priv8A11y`) solo recibe tipos de mensaje, ids, recuentos y códigos de error, nunca el contenido de la pantalla ni los valores que manda el núcleo. El volcado crudo del árbol existe para depurar, pero solo se compila activado con `-Ppriv8.a11yDump=true`; nunca con datos reales.

## Mira a otro lado (pausa)

Mientras un campo rojo tiene el foco (la persona escribe su clave o el OTP), hay un diálogo del sistema abierto (huella, permiso) o está delante la pantalla de confirmación de 8, el servicio no deja salir nada de esa ventana (`Pause.kt`):

| Situación | Snapshot | Evento |
|---|---|---|
| Foco en campo rojo | un solo elemento `n1`, `password: true`, `text: null`; `focus: "n1"`; `screen` sí | `focus_password` con `detail` `clave` u `otp`; al salir, `focus_left` |
| Diálogo del sistema | `system_dialog` (`biometria`, `permiso`, u `oculta` si 8 no puede leer la ventana: en Android 14 el diálogo de permisos está oculto a los servicios que no son herramientas de accesibilidad), sin elementos, `app: "desconocida"` si es oculta | `system_dialog` / `system_dialog_closed` |
| Confirmación de 8 | `screen: "confirmacion"`, sin elementos | ninguno (el núcleo ya la tiene pendiente) |

Con eso el núcleo pone `paused: autenticacion`, `dialogo_sistema` o `confirmacion` en la observación, y la app 8 pasa a «mirar a otro lado». Durante la pausa todo `perform` devuelve `no_permitido`. La pausa empieza con el foco, antes de la primera tecla, y termina en cuanto el foco sale o cambia la pantalla.

## Confirmaciones habladas

Paquete `es.priv8.ocho.confirm`, aislado para que la app (#39) y el diseño (#36) lo vistan:

- El núcleo manda por el puente `render_values` (tabla token → valor de la sesión) y `confirm_request` (`confirm.schema.json`), los dos en `bridge.schema.json` desde v1.1. La tabla vive solo en memoria y nunca va al registro.
- `ConfirmActivity` muestra la frase con los valores («200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?») y la dice con TextToSpeech es-ES, solo con una voz instalada (sin síntesis en red), con las cifras ya en palabras («Doscientos euros…», `Verbalizer.kt`, port de `voice/verbalize.py`).
- Escucha «confirmo» o «cancela» con el reconocedor en el dispositivo (`createOnDeviceSpeechRecognizer`). Si no hay reconocedor local, permiso de micrófono o modelo es-ES, lo dice en pantalla y quedan los botones. La app pide el modelo es-ES al abrirla, nunca en mitad de una confirmación.
- `emu.sh --headless` arranca el emulador con `-no-audio`: ahí la voz no suena ni hay micrófono, el reconocedor solo oye silencio y se responde con los botones. Para probar la voz, arrancarlo con ventana (con audio). Si el motor no avisa del final de la frase, 8 empieza a escuchar tras un margen calculado por longitud.
- Botones Confirmar y Cancelar. Si falta el valor de algún token, Confirmar no se ofrece.
- Una respuesta por petición: `approval_result` con `by: persona` y `via: voz|pantalla`, o `caducado` (`via` y `by` `sistema`) a los `expires_s` (300 por defecto).
- El agente no puede leer ni tocar esta pantalla: snapshot vacío y `perform` rechazado mientras está delante.

Logcat (etiqueta `Priv8Confirm`) solo recibe ids, recuentos y resultados; nunca la frase ni lo que se oyó.

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

Sin `--run` lee órdenes por la entrada estándar (`snap`, `tap`, `type`, `scroll`, `back`, `open`, `key`, `expect`, `wait`, `confirm`, `await`). `confirm [IMPORTE [NOMBRE [SEGUNDOS]]]` manda una confirmación como la del núcleo y escribe el `approval_result`, validado; `await` espera a que llegue:

```sh
python3.12 adapters/android/bridge_dev_server.py --contracts docs/contracts --adb-reverse \
  --run 'confirm "200,00 €" "Nimbo Bróker" 300; snap; await'
```

 `@algo` busca el elemento del último snapshot por `sel`, `label` o `text`. El registro enmascara los textos salvo con `--show-values`, solo para datos simulados. Otra URL del núcleo: `./gradlew assembleDebug -Ppriv8.bridgeUrl=ws://127.0.0.1:9000`.

## Ajustes restringidos (Android 13+)

Probado en la issue #26 sobre Android 14 (API 34):

- **Instalado con `adb install`:** no hay restricción. El servicio se activa por `adb shell settings` y también desde Ajustes › Accesibilidad.
- **Instalado desde un archivo o el navegador:** Ajustes muestra el servicio en gris con «Restricted setting», y el sistema descarta el valor de `enabled_accessibility_services` puesto por adb. Se desbloquea con «Allow restricted settings» en Información de la app, o con `adb shell appops set es.priv8.ocho ACCESS_RESTRICTED_SETTINGS allow`. `emu.sh` ya lo hace antes de activar el servicio.

## Los ojos de 8 (issue #39)

La pantalla de la app es 8 a pantalla completa, movido por el canal de eventos del núcleo (`ws://127.0.0.1:8700/events`, `docs/contracts/events.schema.json`).

- **`OjosView.kt`**: WebView con `assets/ocho/app.html`. Todo se sirve desde el APK (`https://appassets.androidplatform.net/assets/`); la página no sale a la red: la petición a Google Fonts de `ojos.html` se responde con la Sora incluida (`assets/ocho/fonts/`, OFL) y cualquier otra recibe un 403.
- **`docs/ojos.html` es la única fuente de los ojos.** El build lo copia sin tocarlo a `build/generated/ojos/ocho/ojos.html` (tarea `copyOjos`). `app.html` lo carga en un iframe, deja visible solo el 8 grande y lo mueve con `P8.poner()`.
- **`EventsClient.kt`**: cliente WebSocket del canal de eventos, con reconexión de 1 a 30 s. Descarta `screen` (lleva la pantalla real para la consola) antes de que llegue a la interfaz y solo registra tipos de mensaje.
- **`assets/ocho/estados.js`**: de evento a cara. Función pura, con tests en `dev/test_estados.mjs`.

| Evento | Cara |
|---|---|
| conexión abierta / perdida | saludar / sin conexión |
| `audit` `task` | pensar |
| `audit` `observe_sent` | leer; después asteriscos (`nove`) si hubo datos ámbar o ojos cerrados (`nuncasale`) si hubo rojos |
| `audit` `act`, `oracle` | cargando |
| `audit` `held` | esperar |
| `audit` `paused` | mirar a otro lado (`apartar`), hasta el siguiente evento |
| `audit` `approval` | confirmado (`asentir`) o cancelado (`negar`) |
| `audit` `blocked` | `rojo`: nunca sale · `destino`, `fuga`: enfado · `caducado`, `cancelado`: cancelado · resto: tristeza |
| `audit` `call` | hablar |
| `voice` | hablar, con una duración aproximada hasta que la voz mixta avise del final |
| `confirm_request` | llamar (`atencion`) y luego esperar |
| `approval_result` | confirmado o cancelado |
| `screen`, `audit` `voice_out` | no cambian la cara |

Los gestos de una vez duran 2,8 s (`--p8-dur-gesto`) y vuelven a reposo (`mirar`). En los builds de depuración se ve abajo el estado de la conexión y la cara actual.

### Probar sin el núcleo

`dev/events_dev_server.py` hace de canal de eventos: valida cada mensaje contra los contratos antes de mandarlo y reproduce tres escenas (`saldo`, `transferencia`, `bloqueos`). También sirve una vista previa para el navegador.

```sh
uv run --python 3.12 --with websockets==15.0.1 --with jsonschema==4.25.1 \
  python apps/android-8/dev/events_dev_server.py --run "wait 3; todo" --loop
# navegador: http://127.0.0.1:8710/ocho/app.html?debug
# emulador:
~/Library/Android/sdk/platform-tools/adb reverse tcp:8700 tcp:8700
```

Tests de la tabla de caras: `node apps/android-8/dev/test_estados.mjs`.
