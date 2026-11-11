# agent/ · servidor MCP y bucle del agente

Camino 3, issue #25. El agente (Claude) solo ve tres herramientas: `observe`, `act` y `oracle`. No hay más herramientas, ni recursos, ni prompts.

Sigue los **contratos v1** de `docs/contracts/` (PR #58, de Pablo): `tools.schema.json`, `observation.schema.json`, `snapshot.schema.json` y `audit.schema.json`. Todo pasa por la interfaz `core_port.py`. El núcleo corre **en el mismo proceso** (decisión del equipo, opción A): `PRIV8_CORE=real` (por defecto) usa `core/` a través de `core_adapter.py`, y `PRIV8_CORE=fake` usa el núcleo falso `fakes.py`, que se queda para los tests y `make replay-fake`.

## Archivos

| Archivo | Qué es |
|---|---|
| `tools.json` | Cómo se describen las tres herramientas al modelo: nombre, descripción y `input_schema`, que es el `*_input` de `docs/contracts/tools.schema.json` con las referencias resueltas. La API de Claude no admite `allOf` arriba del todo, así que las reglas condicionales del contrato (qué `op` necesita `target` o `text`) van en `x-priv8-rules` y solo las aplica el servidor |
| `core_port.py` | Interfaz con el núcleo: `ScreenPort.observe`, `ActPort.act`, `OraclePort.oracle`, `LeakCheckPort.check` (bloqueo final), `AuditPort.record`, agrupadas en `Core` |
| `core_adapter.py` | Adaptador al núcleo real en el mismo proceso: `build_real_core()` importa `core` solo cuando se pide y conecta los cinco puertos a sus funciones; `select_core()` elige según `PRIV8_CORE`; `mount_scene()` conecta una escena de `core/scenes.py` a la sesión y `tokenize_task()` pasa la orden de la persona por el núcleo |
| `fakes.py` | Núcleo falso en memoria: pantalla de alta de factura de Alba Core, bóveda, política de destino, oráculo con presupuesto, ejecutor que rehidrata, confirmación, bloqueo final y auditoría encadenada por hashes. Datos inventados en `SEED` |
| `server.py` | Servidor MCP (SDK oficial `mcp`, servidor de bajo nivel con esquemas explícitos). Streamable HTTP en `127.0.0.1:8701/mcp` o stdio. Con `--web` o `--android` sirve a otros hosts MCP (Claude Code) sobre las apps reales |
| `asesoria.py` | Guarda de «no puedo» (#43): detecta peticiones de consejo de inversión y responde con la frase fija sin llamar al modelo |
| `agent.py` | Bucle del agente con el SDK oficial `anthropic` (`claude-opus-5-5`, pensamiento adaptativo), límite de pasos, auditoría por paso, modo replay y grabación |
| `replays/registrar_factura.json` | Respuestas grabadas de «registrar factura» |
| `tests/` | pytest |

`agent/` es un paquete (`agent.server`, `agent.agent`, `agent.core_port`...). Antes se llamaba `mcp/` y no tenía `__init__.py` para no tapar el paquete `mcp` del SDK; con el nombre nuevo ya no hay choque. Los comandos se lanzan desde la raíz del repositorio con `python -m`.

## Uso

```bash
uv sync                      # Python 3.12, dependencias fijadas en pyproject.toml / uv.lock
make replay                  # escena B2B (factura) con respuestas grabadas sobre el núcleo real, sin clave
make replay SCENE=b2c        # escena B2C (saldo y transferencia)
make replay-fake             # «registrar factura» con respuestas grabadas sobre el núcleo falso, sin clave
make demo                    # las dos escenas desde core/replay.py (#79), con registro firmado aparte
make agent                   # en vivo: servidor HTTP en :8701 y agente conectado a él (necesita ANTHROPIC_API_KEY)
uv run pytest                # tests

uv run python -m agent.server                  # solo el servidor, HTTP :8701, escena b2b
uv run python -m agent.server --transport stdio --scene b2c  # solo el servidor, stdio
make mcp-web                 # el servidor sobre Alba Core y el correo reales, para Claude Code u otro host
make mcp-android             # el servidor sobre el emulador
uv run python -m agent.agent --server-url http://127.0.0.1:8701/mcp --replay core/replays/b2b.json
uv run python -m agent.agent --record agent/replays/nueva.json   # en vivo y graba un replay
uv run python -m agent.agent --replay FILE --audit-out audit.jsonl
```

Opciones de `agent.agent`: `--task` (nombre de tarea o texto libre en español), `--max-steps` (20), `--session` (el nombre de la escena; `s1` con el núcleo falso), `--port` (8701), `--scene`, `--web`, `--android` y `--simulated-persona`. Sale con 0 si la tarea termina.

### Alba Core y el correo reales (`--web`, B2B)

```bash
make web                                   # Alba Core :5173, correo :5174, consola :5175
make agent-web                             # 8 espera el encargo en la consola
make agent-web TASK="registrar factura"    # primero esta tarea, después la consola
make demo-b2b                              # todo de una vez, con Alba Core ya con la sesión abierta
```

- **Sesión de Alba Core.** Chromium usa un perfil persistente (`.priv8/chromium/`): si Alba Core ya tiene la sesión abierta (recordada, o la de la demo con `make demo-b2b`), 8 empieza en seguida; si no, espera a que la persona entre. 8 nunca escribe la clave.

- **Encargos desde la consola.** Sin `--task`, el proceso espera la primera tarea de la consola (`task_request` en ws://127.0.0.1:8700/events, que el núcleo pasa a `core.next_task("b2b")`). Con `--task`, la ejecuta primero. El texto pasa por `core.tokenize_text` antes de llegar a Claude; un nombre de tarea como «registrar factura» se expande igual que con `--task`.
- **Después de cada tarea.** La respuesta final va a la consola con `core.say` (texto con tokens, con el bloqueo final), el proceso espera a que la persona apruebe o rechace lo retenido y vuelve a esperar el siguiente encargo. `Ctrl-C` lo para.
- **Replay.** Con `--replay` hace una sola tarea, como antes, y no espera encargos.

### Pantalla con el núcleo real

El núcleo lee la pantalla por un adaptador conectado a cada sesión (`core.connect`). Hasta que el adaptador web y el puente de Android estén en este proceso, la pantalla es una escena en memoria de `core/scenes.py`: `--scene b2b` (factura del proveedor, por defecto) o `--scene b2c` (saldo y transferencia), montada en la sesión del mismo nombre. Las respuestas grabadas de esas escenas están en `core/replays/`.

- **Confirmaciones.** Con `--simulated-persona` una persona simulada aprueba lo retenido antes de la siguiente lectura de pantalla, como en `make demo`. En `agent.agent` está activa por defecto con `--replay` y apagada en vivo (`--no-simulated-persona` / `--simulated-persona` lo cambian); en `agent.server` hay que pedirla. En vivo, sin ella, lo retenido espera a la persona.
- **La orden de la persona** pasa por `core.tokenize_text` antes de llegar a Claude, en el proceso que tiene la bóveda. Con `--server-url` la bóveda está en el otro proceso: la orden sale tal cual y el bloqueo final del bucle la retiene si lleva un dato (por ejemplo «pasa 200 €» de la escena B2C).
- **Dos procesos, dos registros.** Con `--server-url` o stdio, cada proceso abre su propio registro firmado. Si los dos apuntan al mismo `PRIV8_AUDIT`, las cadenas se mezclan: dale a cada uno su archivo.

### En el emulador Android (`--android`, B2C)

```bash
scripts/movil.sh --no-build          # AVD priv8, APK y adb reverse de 8765 y 8700
make agent-android-replay            # respuestas grabadas sobre Banca Alcor real, sin clave
make agent-android TASK="¿Cuánto tengo entre mis cuentas? Después pasa 200 € a mi cuenta de Nimbo Bróker."
make agent-android                   # sin TASK: espera las tareas dictadas en el móvil (core.next_task)
```

- **El puente.** El núcleo sirve `ws://127.0.0.1:8765` y el servicio de accesibilidad de la app 8 se conecta como cliente. `adapters/android/bridge.py` lo envuelve como adaptador (`snapshot`/`perform`) y valida cada mensaje contra `bridge.schema.json`. Arranca también el canal de eventos (:8700) para los ojos y los subtítulos de 8.
- **Antes de empezar**, el arnés (no el agente) abre Banca Alcor si no está delante y espera a que la persona entre: el login es siempre suyo.
- **Confirmaciones.** Lo retenido va al móvil: `render_values` con los valores de sus tokens y después `confirm_request`; 8 lo dice con la voz local y la `approval_result` vuelve por el puente. Tras cada `hello` se reenvía lo pendiente con el mismo id. Si al cerrarse la confirmación el móvil enseña la pantalla de 8 o ha olvidado los ids, el puente vuelve a leer la pantalla, encuentra el mismo elemento y ejecuta.
- **La respuesta.** Al acabar, el proceso espera lo retenido, espera a que la persona termine su código en el banco y pone a 8 delante: `core.say` publica la frase con tokens y el puente manda antes `render_values`, así que la cifra solo existe en el móvil.
- **Tareas dictadas.** Sin `--task`, cada tarea de `core.next_task("b2c")` pasa por `core.tokenize_text` antes de llegar a Claude, igual que la pantalla.
- **Replay.** `agent/replays/b2c_android.json` está escrito sobre las pantallas reales del AVD (ids `n1…`). Abre Banca Alcor, Brezo Banco y Nimbo Bróker, suma los cuatro saldos con el oráculo (17.977,98 € con los datos de partida) y transfiere 200 € de Alcor a Nimbo. La persona entra antes en los tres bancos desde el lanzador; abrirlos con `open_app` conserva la sesión. Los datos viven en la memoria de cada app: tras una transferencia, Alcor tiene 200 € menos hasta que se cierra. Los tests usan `adapters/android/fake_phone.py`, que da esas mismas pantallas. Sin emulador, `make demo` recorre los tres bancos en la escena de `core/scenes.py`.

## Servidor MCP para otros hosts (`agent.server --web` y `--android`)

Claude Code, Claude Desktop u otro agente pueden usar Priv8 CUA como su capa de *computer use* con la misma protección que 8. Cómo conectarlos, en el `README.md` de la raíz («Usar Priv8 desde Claude Code»).

```bash
uv run python -m agent.server --web                       # HTTP :8701, sesión b2b
uv run python -m agent.server --android                   # HTTP :8701, sesión b2c
uv run python -m agent.server --web --transport stdio     # para un host que lo arranca él
```

- **Mismos adaptadores y sesiones que el agente.** `--web` llama a `mount_web("b2b")` y `--android` a `mount_android("b2c")`, igual que `agent.agent`. Los dos arrancan el servidor de eventos del núcleo (`core.server.start()`, :8700), así que la consola ve las pantallas, los tokens y lo retenido. `--scene`, `--web` y `--android` son excluyentes y necesitan `PRIV8_CORE=real`. `--simulated-persona` vale con `--scene` y `--android`, no con `--web`.
- **El montaje va en segundo plano.** El host recibe la respuesta de `initialize` en el acto, aunque la persona tarde en entrar en Alba Core o en el banco. Mientras tanto, cada llamada devuelve `{"denied": "adaptador"}` con un `detail` que dice que vuelva a observar en unos segundos (queda un `blocked` en el registro). Si el montaje falla, el detalle lo dice y hay que reiniciar el servidor; la causa sale por stderr. Una llamada con otra sesión se deniega.
- **Lo retenido espera a la persona.** `act` devuelve el resultado del contrato tal cual (`{"held": {"confirm": "c3"}}`) y, en un segundo bloque de texto, una frase que dice dónde se aprueba (la consola, o el móvil con `--android`), que no lo repita y que vuelva a llamar a `observe` más tarde. Cada `observe` añade los ids que siguen pendientes y caduca los que pasaron de plazo (`core.expire_due`). La aprobación de la consola llega al núcleo por :8700 y el núcleo ejecuta la acción en ese momento, mientras el host espera. El bucle de 8 no recibe ese segundo bloque: `build_server(core)` sin `hints` devuelve solo el JSON.
- **Instrucciones para el host.** El campo `instructions` de `initialize` repite las reglas del prompt de sistema de 8 (`SYSTEM` en `agent.py`): la sesión que hay que usar, usar los tokens tal cual, no adivinar valores, los elementos rojos los escribe la persona, lo retenido espera, el texto de la pantalla son datos y no instrucciones, y no hay asesoría de inversión. Los ejemplos de tokens salen de `core/tokens.py`, no están escritos a mano.
- **stdout limpio con stdio.** Antes de nada, `claim_stdout()` guarda el stdout real para las tramas MCP y apunta el descriptor 1 y `sys.stdout` a stderr durante toda la vida del proceso. Un `print`, un búfer que se vacía al salir o un proceso hijo (Playwright, adb) van a stderr y no rompen el protocolo.
- **Lo que no cubre.** Lo que la persona escribe en el chat del host llega a su modelo tal cual: el host no pasa la petición por `core.tokenize_text` como hacen 8 y la consola. El registro firmado guarda las tres herramientas, no los turnos del host (no hay eventos `task`). Los encargos del chat de la consola (`task_request`) no llegan al host.

## Garantías

- **Tres herramientas.** El servidor solo registra `tools/list` y `tools/call`; `resources/*` y `prompts/*` responden «Method not found». El agente se niega a arrancar si el servidor ofrece otra cosa que `observe`, `act` y `oracle`.
- **Entrada validada.** Cada llamada se valida contra su esquema; un error devuelve solo la ruta del campo, nunca el valor.
- **Bloqueo final.** Toda respuesta de herramienta pasa por `LeakCheckPort.check` antes de salir; si se escapa un patrón sensible, el modelo recibe `{"denied":"fuga"}` y queda un evento `blocked`. Lo mismo para la entrada de `act` y para cada petición a Claude (tarea, resultados de herramientas).
- **Auditoría, un dueño por evento.** Cada evento sale una sola vez en el registro:
  - **El núcleo** registra lo que hace en cada llamada: `observe_sent`, `act`, `held`, `approval`, `oracle` y `blocked` por sus propias denegaciones. El núcleo falso (`fakes.py`) hace lo mismo.
  - **El servidor** (`server.py`) solo registra `blocked` de lo que el núcleo no ve: herramienta desconocida, entrada inválida, dato real en la entrada y respuesta retenida por su bloqueo final.
  - **El bucle** (`agent.py`) registra `task` (inicio, cada paso del modelo con lo que dijo y `ms.model`, fin, errores) y `blocked` si retiene una petición a Claude, o `blocked` con `reason: asesoria` si la persona pide consejo de inversión.
- **Ejecuta, no asesora** (#43). Antes de llamar a Claude, `asesoria.py` mira la tarea con reglas fijas: si pide elegir un producto o decidir si o cuánto invertir («¿en qué fondo lo meto?»), el modelo no la recibe. 8 dice la frase fija («Eso sería asesorarte y no puedo hacerlo. Si eliges tú el fondo, lo preparo.») con `Core.voice` (`core.say`, un `voice` toda en `cloud`) y queda el `blocked`, que la app 8 pinta con la cara «no puedo». Una orden con el producto elegido («invierte 200 € en el fondo X que he elegido») sigue su camino. El prompt de sistema repite la regla por si algo se escapa.
  - Con `PRIV8_CORE=real`, `--audit-out` solo trae lo que registró el lado del agente; el registro completo y firmado es el del núcleo (`audit/priv8.jsonl`).

## Formato de replay (`priv8-replay/1`)

Un JSON con las respuestas del modelo en orden, una por paso. El bucle las devuelve tal cual, sin mirar la petición, y ejecuta las herramientas de verdad contra el servidor, así que el resultado depende del núcleo, no del archivo.

```json
{
  "format": "priv8-replay/1",
  "model": "claude-opus-5-5",
  "task": "registrar factura",
  "responses": [
    {"stop_reason": "tool_use",
     "content": [{"type": "text", "text": "Miro la pantalla."},
                 {"type": "tool_use", "id": "toolu_r01", "name": "observe", "input": {"session": "s1"}}]},
    {"stop_reason": "end_turn",
     "content": [{"type": "text", "text": "He registrado la factura ‹FACTURA_1›."}]}
  ]
}
```

- `responses[i]` es lo que devolvería la API de Mensajes en el paso `i + 1`: `stop_reason` y `content` (bloques `text`, `tool_use`, y opcionalmente `thinking` tal como los da la API).
- Un `tool_use` con `stop_reason: "tool_use"` hace que el bucle llame a la herramienta y siga; un paso sin `tool_use` termina la tarea.
- Los `id` de `tool_use` solo tienen que ser únicos dentro del archivo.
- Si el bucle pide más pasos de los grabados, falla con `ReplayExhausted`.
- `--record FILE` escribe este mismo formato desde una ejecución en vivo (`response.model_dump()` de cada paso).

Esto es lo que necesita #14 (modo replay, Pablo): `ReplayModel` y `write_replay` en `agent/agent.py` se pueden reutilizar tal cual.

## Contratos en los tests

`tests/test_contracts.py` valida contra los esquemas v1, sin copiarlos: entradas y resultados de las tres herramientas (`tools.schema.json`), cada `observe` (`observation.schema.json`), cada evento de auditoría (`audit.schema.json`), el snapshot del adaptador falso (`snapshot.schema.json`) y los ejemplos válidos e inválidos de `examples/tools.*_input.*` contra `tools.json`.

Lee los esquemas de `PRIV8_CONTRACTS_DIR`, o de `docs/contracts/` en la raíz del repositorio. Si no hay ninguno, esos tests se saltan (así está esta rama hasta que se fusione #58). Para pasarlos ya contra la rama del PR:

```bash
mkdir -p /tmp/priv8 && git archive origin/docs/4-contratos-v1 docs/contracts | tar -x -C /tmp/priv8
PRIV8_CONTRACTS_DIR=/tmp/priv8/docs/contracts uv run pytest
```

La auditoría falsa escribe `sig` con un marcador fijo (`ed25519:…` de «priv8-fake-unsigned»): cumple el patrón del esquema pero no es una firma. La firma real es del núcleo.

## Lo que el núcleo expone

Decisión del equipo (opción A): el núcleo (`core/`, Camino 1) es una biblioteca de Python que corre en el mismo proceso que el servidor MCP y el agente. No hay HTTP entre ellos. Ese mismo proceso sirve también el WebSocket de eventos de la consola (`:8700`) y el puente de Android (`:8765`).

`agent/core_adapter.py` espera que `import core` dé estas cinco funciones de módulo (en `core/__init__.py`, o reexportadas allí). Todo lo que devuelven es un `dict` compatible con JSON:

| Función | Devuelve | Contrato |
|---|---|---|
| `observe(session) -> dict` | La pantalla tokenizada, o `{"denied": motivo, "detail": ...}`. Los elementos rojos llegan con `text: None` | `observation.schema.json` |
| `act(session, op, target=None, text=None, direction=None) -> dict` | `{"ok": true}`, `{"held": {"confirm": "c3"}}` o `{"denied": motivo, "detail": ...}`. `text` solo trae tokens o texto verde: el ejecutor rehidrata en local. `direction` solo llega en `scroll` (el adaptador no lo pasa si es `None`, así que una firma sin él vale para el resto) | `tools.schema.json` `act_input` / `act_result` |
| `oracle(session, op, args) -> dict` | `sum`: `{"result": "‹SUMA_n›", "tramo": ..., "budget_left": n}`; `compare`: `igual`/`mayor`/`menor`; `matches`: `coincide`/`no coincide`; sin presupuesto, `{"denied": "presupuesto"}` | `tools.schema.json` `oracle_input` / `oracle_result` |
| `check(payload: str) -> veredicto` | Bloqueo final sobre el texto serializado que va a salir: `allowed: bool` y `findings: list[str]` con el tipo de patrón (`"IBAN"`, `"vault"`), nunca el valor. Vale un `dict` o un objeto con esos atributos. Si `allowed` no es un `bool`, el adaptador bloquea | — |
| `record(event: dict) -> dict` | El evento tal como queda guardado, con `seq`, `ts`, `prev`, `hash` y `sig` añadidos. Recibe `session`, `kind` y cualquiera de `reason`, `app`, `screen`, `model_saw`, `tokens`, `confirm`, `approved_by`, `counts`, `detail`, `ms` | `audit.schema.json` |

Elección del núcleo: `PRIV8_CORE=real|fake` (por defecto `real`). La usan `server.default_core()` y la entrada de `agent.agent`:

```bash
make replay                                   # escena B2B con el núcleo real
PRIV8_CORE=fake uv run python -m agent.server   # el servidor sobre el núcleo falso
```

Si `core` no se importa o le falta alguna función, `build_real_core()` lanza `RealCoreUnavailable` con los nombres que faltan (`core.check, core.record`), y los comandos salen con ese mensaje en lugar de una traza. `tests/test_core_adapter.py` simula un núcleo mínimo con las cinco funciones y comprueba que el adaptador, el bloqueo final y la auditoría pasan por él. `tests/test_real_core.py` corre las dos escenas con el núcleo real: ninguna petición a Claude lleva un valor de las escenas y cada llamada deja un solo evento.

## Con el núcleo real

1. `core` expone las cinco funciones de arriba con estas firmas (`core/__init__.py`), y `build_real_core()` las conecta sin cambios.
2. `PRIV8_CORE=real` es el valor por defecto. `make replay` corre las escenas de `core/scenes.py` desde `agent.agent`; `make replay-fake` mantiene «registrar factura» sobre el núcleo falso.
3. Si cambian los contratos o las firmas, ajustar `tools.json` (y `x-priv8-rules`), `core_port.py` y `core_adapter.py`; `test_contracts.py` y `test_real_core.py` dirán qué no cuadra.
4. Queda: conectar el adaptador web y el puente de Android en lugar de las escenas, y una ejecución en vivo con Claude grabada con `--record` (#25).
5. Mantener `fakes.py` para los tests, o pasar los tests al núcleo real y borrarlo.
