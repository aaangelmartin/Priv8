# agent/ · servidor MCP y bucle del agente

Camino 3, issue #25. El agente (Claude) solo ve tres herramientas: `observe`, `act` y `oracle`. No hay más herramientas, ni recursos, ni prompts.

Sigue los **contratos v1** de `docs/contracts/` (PR #58, de Pablo; aún sin fusionar): `tools.schema.json`, `observation.schema.json`, `snapshot.schema.json` y `audit.schema.json`. Todo pasa por la interfaz `core_port.py`. El núcleo corre **en el mismo proceso** (decisión del equipo, opción A): `PRIV8_CORE=fake` (por defecto) usa el núcleo falso `fakes.py`, y `PRIV8_CORE=real` usa `core/` a través de `core_adapter.py`, que aún no existe (#4–#14).

## Archivos

| Archivo | Qué es |
|---|---|
| `tools.json` | Cómo se describen las tres herramientas al modelo: nombre, descripción y `input_schema`, que es el `*_input` de `docs/contracts/tools.schema.json` con las referencias resueltas. La API de Claude no admite `allOf` arriba del todo, así que las reglas condicionales del contrato (qué `op` necesita `target` o `text`) van en `x-priv8-rules` y solo las aplica el servidor |
| `core_port.py` | Interfaz con el núcleo: `ScreenPort.observe`, `ActPort.act`, `OraclePort.oracle`, `LeakCheckPort.check` (bloqueo final), `AuditPort.record`, agrupadas en `Core` |
| `core_adapter.py` | Adaptador al núcleo real en el mismo proceso: `build_real_core()` importa `core` solo cuando se pide y conecta los cinco puertos a sus funciones; `select_core()` elige según `PRIV8_CORE` |
| `fakes.py` | Núcleo falso en memoria: pantalla de alta de factura de Alba Core, bóveda, política de destino, oráculo con presupuesto, ejecutor que rehidrata, confirmación, bloqueo final y auditoría encadenada por hashes. Datos inventados en `SEED` |
| `server.py` | Servidor MCP (SDK oficial `mcp`, servidor de bajo nivel con esquemas explícitos). Streamable HTTP en `127.0.0.1:8701/mcp` o stdio |
| `agent.py` | Bucle del agente con el SDK oficial `anthropic` (`claude-opus-5-5`, pensamiento adaptativo), límite de pasos, auditoría por paso, modo replay y grabación |
| `replays/registrar_factura.json` | Respuestas grabadas de «registrar factura» |
| `tests/` | pytest |

`agent/` es un paquete (`agent.server`, `agent.agent`, `agent.core_port`...). Antes se llamaba `mcp/` y no tenía `__init__.py` para no tapar el paquete `mcp` del SDK; con el nombre nuevo ya no hay choque. Los comandos se lanzan desde la raíz del repositorio con `python -m`.

## Uso

```bash
uv sync                      # Python 3.12, dependencias fijadas en pyproject.toml / uv.lock
make replay-fake             # «registrar factura» con respuestas grabadas sobre el núcleo falso, sin clave
make replay                  # las dos escenas de la demo con el núcleo real, sin clave (core/replay.py, #79)
make agent                   # en vivo: servidor HTTP en :8701 y agente conectado a él (necesita ANTHROPIC_API_KEY)
uv run pytest                # tests

uv run python -m agent.server                  # solo el servidor, HTTP :8701
uv run python -m agent.server --transport stdio  # solo el servidor, stdio
uv run python -m agent.agent --server-url http://127.0.0.1:8701/mcp
uv run python -m agent.agent --record agent/replays/nueva.json   # en vivo y graba un replay
uv run python -m agent.agent --replay FILE --audit-out audit.jsonl
```

Opciones de `agent.agent`: `--task` (nombre de tarea o texto libre en español), `--max-steps` (20), `--session` (`s1`), `--port` (8701). Sale con 0 si la tarea termina.

## Garantías

- **Tres herramientas.** El servidor solo registra `tools/list` y `tools/call`; `resources/*` y `prompts/*` responden «Method not found». El agente se niega a arrancar si el servidor ofrece otra cosa que `observe`, `act` y `oracle`.
- **Entrada validada.** Cada llamada se valida contra su esquema; un error devuelve solo la ruta del campo, nunca el valor.
- **Bloqueo final.** Toda respuesta de herramienta pasa por `LeakCheckPort.check` antes de salir; si se escapa un patrón sensible, el modelo recibe `{"denied":"fuga"}` y queda un evento `blocked`. Lo mismo para la entrada de `act` y para cada petición a Claude (tarea, resultados de herramientas).
- **Auditoría, un dueño por evento.** Cada evento sale una sola vez en el registro:
  - **El núcleo** registra lo que hace en cada llamada: `observe_sent`, `act`, `held`, `approval`, `oracle` y `blocked` por sus propias denegaciones. El núcleo falso (`fakes.py`) hace lo mismo.
  - **El servidor** (`server.py`) solo registra `blocked` de lo que el núcleo no ve: herramienta desconocida, entrada inválida, dato real en la entrada y respuesta retenida por su bloqueo final.
  - **El bucle** (`agent.py`) registra `task` (inicio, cada paso del modelo con lo que dijo y `ms.model`, fin, errores) y `blocked` si retiene una petición a Claude.
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

Elección del núcleo: `PRIV8_CORE=fake|real` (por defecto `fake` hasta que llegue el núcleo). La usan `server.default_core()` y la entrada de `agent.agent`:

```bash
make replay                                   # escenas de la demo con el núcleo real (core/replay.py)
PRIV8_CORE=real uv run python -m agent.server
```

Si `core` no se importa o le falta alguna función, `build_real_core()` lanza `RealCoreUnavailable` con los nombres que faltan (`core.check, core.record`), y los comandos salen con ese mensaje en lugar de una traza. `tests/test_core_adapter.py` simula un núcleo mínimo con las cinco funciones y comprueba que el adaptador, el bloqueo final y la auditoría pasan por él.

## Cuando llegue el núcleo

1. Exponer en `core` las cinco funciones de arriba. Hecho: `make replay` corre las escenas de la demo contra el núcleo real (#79) y `make replay-fake` mantiene el replay del agente sobre el núcleo falso.
2. Si cambian los contratos o las firmas, ajustar `tools.json` (y `x-priv8-rules`), `core_port.py` y `core_adapter.py`; `test_contracts.py` dirá qué no cuadra.
3. Cambiar el valor por defecto de `PRIV8_CORE` a `real` en `core_adapter.py` cuando el núcleo esté listo.
4. Mantener `fakes.py` para los tests, o pasar los tests al núcleo real y borrarlo.
