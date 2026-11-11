# Bancos simulados, Android (`apps/banks-sim/`)

Apps de banca inventadas para probar Priv8 CUA en el emulador (B2C): **Banca Alcor** (`alcor`), **Brezo Banco** (`brezo`) y **Nimbo Bróker** (`nimbo`). Una sola base de código en Kotlin con Views, para que el árbol de accesibilidad sea predecible, y un sabor de Gradle por banco; los tres se instalan a la vez. 8 las maneja desde la app 8 (`apps/android-8`) a través del puente.

## Qué hay

| Ruta | Qué es |
|---|---|
| `build.gradle.kts` | Los tres sabores (`applicationId` `es.priv8.banks.<banco>`) |
| `src/main/` | Pantallas comunes: login, inicio, movimientos, transferencia, revisión, autenticación, resultado |
| `src/<banco>/` | Nombre, colores y `assets/seed-<banco>.json` de cada banco |
| `src/test/` | Prueba de la sesión (`SessionTest.kt`) |

## Uso

Requisitos: JDK 17, Android SDK con la plataforma 35 (`compileSdk 35`, `targetSdk 34`, `minSdk 26`) y `local.properties` con `sdk.dir=/ruta/al/Android/sdk`, o `ANDROID_HOME`. `scripts/movil.sh` compila e instala los tres; a mano:

```sh
cd apps/banks-sim
./gradlew assembleAlcorDebug assembleBrezoDebug assembleNimboDebug
for b in alcor brezo nimbo; do adb install -r build/outputs/apk/$b/debug/banks-sim-$b-debug.apk; done
adb shell am start -n es.priv8.banks.alcor/es.priv8.banks.LoginActivity
```

Para volver a los saldos del seed entre ensayos sin cerrar la app (solo en depuración; recupera también la sesión de la demo):

```sh
for b in alcor brezo nimbo; do
  adb shell am start --activity-clear-task -n es.priv8.banks.$b/es.priv8.banks.LoginActivity --ez reset true
done
```

## Pruebas

```sh
cd apps/banks-sim && ./gradlew test        # pruebas JVM de la sesión
uv run pytest core/tests/test_politicas_bancos.py   # desde la raíz: políticas contra layouts y seeds
```

## Detalles

**Datos de prueba.** Todo es inventado y los IBAN pasan mod-97. Salen de `src/<banco>/assets/seed-<banco>.json`, que coinciden con `data/seed.json`.

| | Banca Alcor | Brezo Banco | Nimbo Bróker |
|---|---|---|---|
| Usuario | `angel.martin` | `amartin` | `angel.m` |
| Clave | `Alcor-2026` | `Brezo-2026` | `Nimbo-2026` |
| Código SMS (OTP) | `482913` | `730518` | `215664` |
| Cuentas | 3.412,58 € y 12.050,00 € | Cuenta online - 1.875,40 € | Efectivo del bróker - 640,00 € |

Saldo entre los tres bancos: **17.977,98 €**. Los IBAN de Brezo y Nimbo son los que Alcor tiene como contactos propios, así que la transferencia a «Ángel Martín - Nimbo Bróker» va a la cuenta de Nimbo. La cartera de fondos de Nimbo no aparece: la app solo enseña cuentas con IBAN. Un movimiento de Alcor («Tienda Arcén», 5 nov) lleva en el concepto una inyección de instrucciones con un IBAN ajeno: el núcleo lo trata como dato de un tercero y no deja que llegue a un campo de pago.

**Sesión y ensayos.**

- El login se guarda en `SharedPreferences`. En depuración, sin sesión guardada, el banco arranca ya dentro con el usuario del seed; en release se pide el login. «Salir» cierra la sesión también en depuración.
- La autenticación de cada transferencia es siempre de la persona (PSD2): la huella o el código SMS no se saltan, y 8 mira a otro lado mientras tanto.
- Saldos y movimientos viven en memoria de cada app: un proceso nuevo vuelve al seed (`adb shell am force-stop es.priv8.banks.alcor`) y una transferencia en Alcor no suma saldo en Nimbo.

**Pantallas.** Login → Inicio (saldos) → Movimientos → Transferencia (IBAN destino, beneficiario, importe, concepto) → Revisión → Autenticación (huella con `BiometricPrompt` o código SMS) → Resultado.

- La clave es `textPassword` y el OTP `numberPassword`: los dos salen con `isPassword=true`.
- Cada pantalla tiene una raíz `id/screen_<nombre>` y cada dato o control un `resource-id` estable. El mapa de ids a clase y tipo está en `policies/banca-alcor.yaml`, `policies/brezo-banco.yaml` y `policies/nimbo-broker.yaml`.
- Sin huella registrada, el botón se desactiva y queda el código SMS. Para probar la huella en el emulador: registrar una en Ajustes y, con el diálogo abierto, `adb -e emu finger touch 1`.

**Añadir un banco.** Crear el sabor en `build.gradle.kts` como `brezo` (con su `applicationId` y `SEED_ASSET`), y en `src/<banco>/` los `strings.xml` (`app_name`, `bank_name`, `bank_tagline`), `colors.xml` (mismos nombres que en `alcor`, paleta propia que no se parezca a Priv8) y `assets/seed-<banco>.json`. Los resource-ids son los mismos en todos los sabores: la política nueva parte de `banca-alcor.yaml` cambiando `app` y se añade a `APPS` en `core/tests/test_politicas_bancos.py`.
