# Núcleo del protocolo (`core/`)

El núcleo de Priv8 CUA: una librería de Python que corre en el mismo proceso que el servidor MCP y el agente (`agent/`). Recibe la pantalla real de un adaptador, la devuelve tokenizada, ejecuta las acciones del modelo rehidratando en local, retiene lo irreversible hasta que la persona confirma, bloquea cualquier fuga y firma el registro de auditoría. Sigue los contratos de `docs/contracts/`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `__init__.py` | API del núcleo: `observe`, `act`, `oracle`, `check`, `record`, y para quien monta el proceso `connect`, `tokenize_text`, `trust`, `say`, `frame`, `submit_task`, `next_task` |
| `adapter.py` | Interfaz de adaptador (`snapshot`, `perform`) que cumplen el adaptador web, el puente Android y las escenas |
| `session.py` | Estado de cada sesión: bóveda, adaptador y última pantalla |
| `tokens.py` | Gramática de tokens `‹TIPO_n-etiqueta›` (`docs/contracts/token.md`) |
| `vault.py` | Bóveda por sesión: token → valor real; lo rojo no entra nunca |
| `policies.py` | Políticas YAML por sitio (`policies/*.yaml`): pantallas, clase y tipo de cada elemento, acciones críticas |
| `detect/` | Detector del perfil Finanzas: IBAN mod-97, DNI/NIE, CIF, Luhn, importes, teléfonos, correos, OTP, nombres (`validators.py`) |
| `screen.py` | Snapshot crudo → observación tokenizada; también los textos visibles sin marcar (`extra`, ids `t1`...), clasificados después de lo marcado |
| `oraculo.py` | Oráculo `sum`, `compare`, `matches` con presupuesto por sesión y por token |
| `executor.py` | Ejecutor: comprueba, rehidrata en local y llama a `adapter.perform()` |
| `provenance.py` | Procedencia y política de destino: un IBAN visto solo en un correo no llega al campo de pago |
| `confirm.py` | Confirmación humana obligatoria para transferir, invertir, firmar, enviar y llamar |
| `leak.py` | Bloqueo final de todo lo que sale hacia Claude o ElevenLabs |
| `audit.py`, `verify.py` | Registro JSONL encadenado por hashes y firmado con ed25519, y su verificación |
| `events.py` | Canal de eventos del proceso (audit, screen, voice, confirm_request) |
| `server.py` | WebSocket de eventos `ws://127.0.0.1:8700/events` para la consola y la app 8 |
| `scenes.py` | Escenas en memoria (`b2b`, `b2c`) con una persona simulada, para el replay y los tests |
| `replay.py`, `replays/` | Modo replay sin claves (#14) con respuestas grabadas: `b2b.json`, `b2c.json` |
| `tests/` | pytest |

## Uso

Desde la raíz del repositorio, después de `uv sync`:

```bash
make demo                                          # las dos escenas con el núcleo real, sin clave
make demo SCENE=b2b                                # solo la factura del proveedor (SCENE=b2c: saldo y transferencia)
uv run python -m core.verify audit/replay.jsonl    # comprueba el registro firmado que deja make demo
uv run python -m core.server                       # solo el canal de eventos (también make events)
```

## Pruebas

```bash
uv run pytest core/tests
```

## Detalles

- **Orden del ejecutor.** Antes de tocar la pantalla comprueba que el elemento exista en la última observación, que no haya pausa (la persona se autentica) ni sea rojo o una contraseña, que todos los tokens existan en la bóveda, la procedencia y la confirmación. Después rehidrata y ejecuta.
- **Pausa.** Un diálogo del sistema, la confirmación de 8 o el foco en una contraseña dejan la observación vacía y rechazan `act` hasta que acaba. Una pantalla sin política no sale (`denied: sin_regla`).
- **Oráculo.** Cada pregunta gasta una del presupuesto de la sesión (30 por defecto) y cada token entra en un número limitado de `compare` o `matches`, para que el agente no reconstruya una cifra por búsqueda binaria.
- **Auditoría.** Cada línea lleva `prev`, `hash` y `sig`; una línea alterada, quitada o reordenada rompe la cadena. Clave en `PRIV8_AUDIT_KEY` (por defecto `audit/priv8.key`, se crea si no existe, con la pública al lado). Registro en `PRIV8_AUDIT` (por defecto `audit/priv8.jsonl`); `PRIV8_AUDIT=off` lo deja solo en memoria.
- **Canal de eventos.** Solo escucha en 127.0.0.1, porque el mensaje `screen` lleva la pantalla real. Acepta `approval_result`, `task_request` y `dictation_start` (Whisper en local, `voice/dictado.py`). Los fotogramas de la pantalla real van por un canal aparte que no pasa por la auditoría ni por el puente.
- **Vista de 8.** `preview` clasifica una pantalla igual que `observe` sin mandarla a ningún sitio, y `mask_text` tapa solo lo sensible de un texto suelto. Los usa la vista de 8 del adaptador web (`adapters/web/vista.py`).
- El estado vive en el proceso y no se persiste.
