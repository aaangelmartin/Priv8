# Puente Android (`adapters/android/`)

El lado del núcleo del puente con el móvil (B2C). El núcleo sirve `ws://127.0.0.1:8765` (el emulador llega con `adb reverse tcp:8765 tcp:8765`) y el servicio de accesibilidad de la app 8 (`apps/android-8`) se conecta como cliente. Así el núcleo lee y actúa en el móvil igual que en una escena o con Playwright. Contrato: `docs/contracts/bridge.schema.json`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `bridge.py` | `AndroidBridge`: envuelve la conexión en la interfaz de `core/adapter.py` (`snapshot()`, `perform()`) y lleva las confirmaciones y la voz al móvil |
| `bridge_dev_server.py` | Servidor de desarrollo que hace de núcleo en el portátil para probar el lado del móvil por separado |
| `fake_phone.py` | `FakePhone`: un móvil falso que responde como la app 8 sobre Banca Alcor, Brezo Banco y Nimbo Bróker, sin emulador |
| `requirements-dev.txt` | Dependencias fijadas de `bridge_dev_server.py` fuera de `uv` |
| `tests/` | pytest (`test_bridge.py`) |

## Uso

El agente monta el puente con `make agent-android` o `make agent-android-replay` (antes, `scripts/movil.sh` prepara el AVD, los APK y `adb reverse` de 8765 y 8700). Para probar el móvil sin el núcleo:

```bash
python -m pip install -r adapters/android/requirements-dev.txt
adb reverse tcp:8765 tcp:8765      # o --adb-reverse
python adapters/android/bridge_dev_server.py --contracts docs/contracts
```

Comandos interactivos del servidor de desarrollo, uno por línea o en un guion con `--run "cmd; cmd"`: `snap`, `tap`, `type`, `scroll`, `back`, `open`, `key`, `expect`, `confirm`, `resend`, `await`, `wait` y `quit`.

## Pruebas

```bash
uv run pytest adapters/android/tests
```

Usan `fake_phone.py`, que da las mismas pantallas que la app real en el AVD `priv8`.

## Detalles

- **Confirmaciones.** Cuando el núcleo retiene una acción, el puente manda `render_values` con los valores reales de sus tokens y después `confirm_request`; la app 8 lo dice con la voz local y responde `approval_result`, que pasa a `core.approve`. Tras cada `hello` se reenvía lo pendiente con el mismo id.
- **Voz.** Cuando el núcleo publica lo que dice 8 (`core.say`), el puente manda antes `render_values` y luego `voice`; el `voice.done` del móvil se registra como `voice_out`.
- **Validación.** Cada mensaje, de entrada y de salida, se valida contra `bridge.schema.json`; uno de salida inválido no se manda. Los mensajes llevan valores reales: el puente no registra textos ni valores, solo tipos, ids y cuentas.
- **Hilos.** El servidor corre en su propio hilo con su bucle; `snapshot()` y `perform()` esperan a que el móvil conteste.
- **Pantalla real en la consola (#147).** Mientras una consola mira y hay un móvil conectado, el arnés (no el agente) toma capturas con `adb exec-out screencap -p` y las manda por `core.frame`. `PRIV8_FRAMES=0` lo apaga. El agente nunca tiene adb.
