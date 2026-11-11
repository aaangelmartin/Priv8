# App 8 para Android (`apps/android-8/`)

App Android **Priv8** (paquete `es.priv8.ocho`): una actividad de arranque y el servicio de accesibilidad «Priv8» (`Priv8AccessibilityService`), que es el adaptador Android del núcleo. 8 es el nombre del agente dentro de la app.

- **Icono:** adaptativo (`mipmap-anydpi-v26`), 8 blanco sobre cobalto, sacado de `brand/logo/icono-app-cuadrado.svg`; también monocromo para los iconos temáticos de Android 13+.
- **Arranque:** la pantalla de los ojos (`Theme.Priv8.Ojos`) es cobalto desde el primer fotograma y la pantalla de bienvenida del sistema (Android 12+) es 8 sobre cobalto. Antes la ventana era blanca (`Theme.Material.Light`) y la bienvenida no tenía icono, así que al abrirla desde el icono se veía una pantalla en blanco mientras arrancaba el WebView.

- **Snapshot** (`SnapshotBuilder.kt`): convierte el árbol de accesibilidad de la ventana activa en un snapshot crudo según `docs/contracts/snapshot.schema.json`. Ids `n1`, `n2`… en preorden, estables dentro de un snapshot; `role` por clase de vista; `label` de `contentDescription`, `labelFor` o la pista; `sel` es el `viewIdResourceName` sin el paquete de la app (`id/iban_destino`); `screen` sale de la vista raíz `screen_<nombre>` si existe. Los campos rojos (`RojoField.kt`: `isPassword`, tipo de entrada de contraseña como `numberPassword` de los OTP, o un campo editable cuyo id, pista o etiqueta nombra un secreto: otp, pin, clave, código...) llevan `password: true` y su texto va enmascarado ya en el dispositivo; 8 no escribe en ellos. Antes de leer espera a que la ventana se asiente: 300 ms sin cambios, la reacción a la última acción y que la ventana activa sea la del último `TYPE_WINDOW_STATE_CHANGED`.
- **Puente** (`BridgeClient.kt`): cliente WebSocket a `ws://127.0.0.1:8765` (por `adb reverse`), mensajes de `docs/contracts/bridge.schema.json` (contratos v1.1). Envía `hello` al conectar, responde a `snapshot.request` y `perform`, y emite los eventos `focus_password`, `focus_left`, `system_dialog`, `system_dialog_closed`, `screen_changed` y `app_changed`. Si se cae, reintenta con espera exponencial de 1 a 4 s: en cuanto arranca el núcleo, el móvil se conecta solo.
- **Acciones** (`Performer.kt`): `tap`, `type` (`ACTION_SET_TEXT`), `back`, `open_app` (paquete en `text`), `scroll` (con o sin `target`) y `key` (`enter`, `back`, `home`) sobre el id del último snapshot. Errores del contrato: `target_no_encontrado` (id inexistente o vista que ya no está), `no_permitido` (escribir en un campo de contraseña, operación que no corresponde a la pantalla), `timeout` (más de 5 s) y `otro`.
- **Cursor de 8** (`CursorOverlay.kt`, `CursorMotion.kt`, #135): quien mira el móvil ve a 8 trabajar. Una capa `TYPE_ACCESSIBILITY_OVERLAY` del propio servicio (sin permisos nuevos, no enfocable y no táctil, oculta a la accesibilidad, así que no entra en el snapshot) dibuja los ojos de 8 en cobalto. Antes de `tap` y `type` se desliza al centro del nodo (350 a 500 ms con suavizado), deja una onda al pulsar y rodea el campo mientras el texto aparece en unos pasos; el último `ACTION_SET_TEXT` pone siempre el valor entero. Se oculta en todas las pausas (clave, OTP, huella, diálogo del sistema), en las pantallas de 8 y mientras hay una confirmación abierta, y se desvanece tras 4 s sin acciones.

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
- 8 está arriba y se mueve con el volumen real (#42): «hablar» sigue a la salida de TextToSpeech y «escuchar» al micrófono (`onRmsChanged`). La salida se mide con `Visualizer` sobre una sesión de audio propia (necesita `RECORD_AUDIO`, el mismo permiso que el micrófono); si no se puede, con una envolvente por palabras (`onRangeStart`). Solo se mide el volumen, nunca el audio. Unas 30 veces por segundo, por `OjosView.microfono`/`voz` → `Ocho.nivel` → `P8.nivel` (`docs/ojos.html`).
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

Todo el lado del móvil en un comando (issue #48): `scripts/movil.sh` compila la app 8 y los tres bancos (Alcor, Brezo, Nimbo), llama a `emu.sh` con las cuatro APK y abre los puertos 8765 (puente) y 8700 (eventos). Con `--no-build` instala lo ya compilado; `--headless` pasa a `emu.sh`. Necesita `JAVA_HOME` con un JDK 17.

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
- **`EventsClient.kt`**: cliente WebSocket del canal de eventos, con reconexión de 1 a 4 s: sin núcleo, 8 pone la cara «sin conexión» y vuelve sola al arrancarlo. Descarta `screen` (lleva la pantalla real para la consola) antes de que llegue a la interfaz y solo registra tipos de mensaje.
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
| `audit` `blocked` | `rojo`: nunca sale - `asesoria`: no puedo - `destino`, `fuga`: enfado - `caducado`, `cancelado`: cancelado - resto: tristeza |
| `audit` `call` | hablar |
| `voice` | hablar, con una duración aproximada hasta que la voz mixta avise del final |
| `confirm_request` | llamar (`atencion`) y luego esperar |
| `approval_result` | confirmado o cancelado |
| `screen`, `audit` `voice_out` | no cambian la cara |

Los gestos de una vez duran 2,8 s (`--p8-dur-gesto`) y vuelven a reposo (`mirar`). En el móvil no sale ningún texto de depuración; la línea con el estado de la conexión y la cara solo aparece en la vista previa del navegador con `?debug`.

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

## Renderizador local (issue #40)

Lo que dice 8 sale debajo de los ojos con los valores reales puestos en el móvil.

- El mensaje `voice` del canal de eventos solo trae tokens: «Entre tus tres cuentas tienes ‹SUMA_1›».
- Los valores llegan antes o justo después por el puente, con `render_values` (`bridge.schema.json` v1.1), y los guarda `LocalValues`: solo en memoria, sin registrar.
- `Frase.kt` lee el `voice` y lo pinta con el mismo `Renderer` de las confirmaciones habladas. Rechaza un token en un segmento `cloud`.
- `Subtitulo.kt` lo enseña. Si todavía falta algún valor, lo reintenta durante unos 2 s y mientras tanto enseña el token, nunca un valor inventado. El texto no se registra ni sale del dispositivo.
- Es un aspecto provisional (Sora blanca sobre cobalto) hasta el diseño de la app (#36).

Tests: `./gradlew testDebugUnitTest` (`FraseTest`, con los ejemplos de `docs/contracts/examples`).

## Dictado (issue #47)

Toca a 8 y dile la tarea: «¿Cuánto tengo entre mis bancos?». El texto sale en el subtítulo. Vuelve a tocar para dejar de escuchar.

Dos caminos, decididos por Ángel en la #47. En los dos el audio no sale del móvil o del portátil: nunca hay un reconocedor en la nube.

- **Móvil real (A).** `SpeechRecognizer.createOnDeviceSpeechRecognizer` (Android 12+), en es-ES, con la misma petición que las confirmaciones habladas. El texto va al núcleo en un `task_request` por el canal de eventos (`events.schema.json` v1.2); el núcleo lo tokeniza antes de que llegue al modelo. Sin conexión, la tarea espera y sale al reconectar.
- **Emulador (B).** Su reconocedor no funciona, así que la app manda `dictation_start` y el núcleo graba el micrófono del portátil y lo transcribe con Whisper en local (`voice/dictado.py`, `make dictado-install`). El núcleo devuelve `dictation` con el texto, que sale en el subtítulo, y encola la tarea él mismo.
- **Cuál se usa:** `auto` elige B en el emulador (`Build.FINGERPRINT`, `Build.HARDWARE`...) y A en un móvil. Un móvil sin reconocedor en el dispositivo, sin es-ES o con un error del reconocedor pasa también a B. Para forzarlo: `./gradlew assembleDebug -Ppriv8.dictado=portatil` (o `movil`), o `--es dictado portatil` en el `am start`. La sesión es `b2c` (`-Ppriv8.session=...`).
- **Lo oído no se escribe en logcat**: puede llevar datos. Solo se registra la longitud de la tarea. El texto de `dictation` no llega al WebView de los ojos.

Probar en el emulador, sin tocar la pantalla (con el núcleo corriendo y `adb reverse tcp:8700 tcp:8700`):

```bash
adb shell am start --activity-single-top -n es.priv8.ocho/.MainActivity --ez dictar true
adb logcat -s Priv8Dictado   # «dictado: listening on the laptop», luego «laptop task (N chars)»
```

Para probar el reconocedor del emulador (A) en vez de Whisper: `adb emu avd hostmicon` y `--es dictado movil`.
