# mcp/ · servidor MCP y bucle del agente

Camino 3, issue #25. El agente (Claude) solo ve tres herramientas: `observe`, `act` y `oracle`. No hay más herramientas, ni recursos, ni prompts.

Sigue los **contratos v1** de `docs/contracts/` (PR #58, de Pablo; aún sin fusionar): `tools.schema.json`, `observation.schema.json`, `snapshot.schema.json` y `audit.schema.json`. El núcleo real (`core/`, #4–#14) aún no existe: todo pasa por la interfaz `core_port.py`, y mientras tanto corre sobre el núcleo falso `fakes.py`.

## Archivos

| Archivo | Qué es |
|---|---|
| `tools.json` | Cómo se describen las tres herramientas al modelo: nombre, descripción y `input_schema`, que es el `*_input` de `docs/contracts/tools.schema.json` con las referencias resueltas. La API de Claude no admite `allOf` arriba del todo, así que las reglas condicionales del contrato (qué `op` necesita `target` o `text`) van en `x-priv8-rules` y solo las aplica el servidor |
| `core_port.py` | Interfaz con el núcleo: `ScreenPort.observe`, `ActPort.act`, `OraclePort.oracle`, `LeakCheckPort.check` (bloqueo final), `AuditPort.record`, agrupadas en `Core` |
| `fakes.py` | Núcleo falso en memoria: pantalla de alta de factura de Alba Core, bóveda, política de destino, oráculo con presupuesto, ejecutor que rehidrata, confirmación, bloqueo final y auditoría encadenada por hashes. Datos inventados en `SEED` |
| `server.py` | Servidor MCP (SDK oficial `mcp`, servidor de bajo nivel con esquemas explícitos). Streamable HTTP en `127.0.0.1:8701/mcp` o stdio |
| `agent.py` | Bucle del agente con el SDK oficial `anthropic` (`claude-opus-5-5`, pensamiento adaptativo), límite de pasos, auditoría por paso, modo replay y grabación |
| `replays/registrar_factura.json` | Respuestas grabadas de «registrar factura» |
| `tests/` | pytest |

`mcp/` no tiene `__init__.py` a propósito: así nunca tapa el paquete `mcp` del SDK. Los módulos se importan como `server`, `agent`, etc. (pytest añade `mcp/` al path).

## Uso

```bash
uv sync                      # Python 3.12, dependencias fijadas en pyproject.toml / uv.lock
make replay                  # «registrar factura» con respuestas grabadas, sin clave
make agent                   # en vivo: servidor HTTP en :8701 y agente conectado a él (necesita ANTHROPIC_API_KEY)
uv run pytest                # tests

uv run python mcp/server.py                    # solo el servidor, HTTP :8701
uv run python mcp/server.py --transport stdio  # solo el servidor, stdio
uv run python mcp/agent.py --server-url http://127.0.0.1:8701/mcp
uv run python mcp/agent.py --record mcp/replays/nueva.json   # en vivo y graba un replay
uv run python mcp/agent.py --replay FILE --audit-out audit.jsonl
```

Opciones de `agent.py`: `--task` (nombre de tarea o texto libre en español), `--max-steps` (20), `--session` (`s1`), `--port` (8701). Sale con 0 si la tarea termina.

## Garantías

- **Tres herramientas.** El servidor solo registra `tools/list` y `tools/call`; `resources/*` y `prompts/*` responden «Method not found». El agente se niega a arrancar si el servidor ofrece otra cosa que `observe`, `act` y `oracle`.
- **Entrada validada.** Cada llamada se valida contra su esquema; un error devuelve solo la ruta del campo, nunca el valor.
- **Bloqueo final.** Toda respuesta de herramienta pasa por `LeakCheckPort.check` antes de salir; si se escapa un patrón sensible, el modelo recibe `{"denied":"fuga"}` y queda un evento `blocked`. Lo mismo para la entrada de `act` y para cada petición a Claude (tarea, resultados de herramientas).
- **Auditoría.** Cada llamada deja un evento (`observe_sent`, `act`, `oracle`, `held`, `approval`, `blocked`) y cada paso del modelo un evento `task` con lo que dijo y su latencia (`ms.model`).

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

Esto es lo que necesita #14 (modo replay, Pablo): `ReplayModel` y `write_replay` en `agent.py` se pueden reutilizar tal cual.

## Contratos en los tests

`tests/test_contracts.py` valida contra los esquemas v1, sin copiarlos: entradas y resultados de las tres herramientas (`tools.schema.json`), cada `observe` (`observation.schema.json`), cada evento de auditoría (`audit.schema.json`), el snapshot del adaptador falso (`snapshot.schema.json`) y los ejemplos válidos e inválidos de `examples/tools.*_input.*` contra `tools.json`.

Lee los esquemas de `PRIV8_CONTRACTS_DIR`, o de `docs/contracts/` en la raíz del repositorio. Si no hay ninguno, esos tests se saltan (así está esta rama hasta que se fusione #58). Para pasarlos ya contra la rama del PR:

```bash
mkdir -p /tmp/priv8 && git archive origin/docs/4-contratos-v1 docs/contracts | tar -x -C /tmp/priv8
PRIV8_CONTRACTS_DIR=/tmp/priv8/docs/contracts uv run pytest
```

La auditoría falsa escribe `sig` con un marcador fijo (`ed25519:…` de «priv8-fake-unsigned»): cumple el patrón del esquema pero no es una firma. La firma real es del núcleo.

## Cuando llegue el núcleo

1. Si cambian los contratos, ajustar `tools.json` (y `x-priv8-rules`) y `core_port.py`; `test_contracts.py` dirá qué no cuadra.
2. Escribir un adaptador sobre `core/` que implemente los cinco puertos y usarlo en `server.default_core()` y en `agent._main()` en lugar de `build_fake_core()`.
3. Mantener `fakes.py` para los tests, o pasar los tests al núcleo real y borrarlo.
