# Contratos v1

Las interfaces contra las que construye cada camino. Salen de `docs/arquitectura.html` y lo concretan en JSON Schema (draft 2020-12) con ejemplos que validan. Un cambio lo aprueban Pablo (Camino 1) y quien consume el contrato.

| Contrato | Archivo | Dueño | Lo usan |
|---|---|---|---|
| Gramática de tokens | `token.md` | 1 | 2, 3, 4 (renderizador, consola, voz) |
| Tipos comunes | `common.schema.json` | 1 | todos |
| Snapshot crudo de pantalla | `snapshot.schema.json` | 1 | 2 (web), 3 (Android) |
| Observación tokenizada (salida de `observe`) | `observation.schema.json` | 1 | 3 (MCP), 2 (consola) |
| Entradas y salidas de `observe`, `act`, `oracle` | `tools.schema.json` | 1 | 3 (`mcp/tools.json` las expone al modelo) |
| Interfaz de adaptador | `core/adapter.py` | 1 | 2 (web) |
| Puente Android | `bridge.schema.json` | 1 | 3 |
| Evento de auditoría | `audit.schema.json` | 1 | 2 (consola, métricas), 4 (estados de 8) |
| Petición y resultado de confirmación | `confirm.schema.json` | 1 | 2 (consola), 3 y 4 (voz, app 8) |
| Frase de voz mixta | `voice.schema.json` | 1 con 3 | 2 (llamadas), 3 (voz mixta), 4 (app 8) |
| Canal de eventos `ws://127.0.0.1:8700/events` | `events.schema.json` | 1 | 2 (consola), 3 (agente), 4 (app 8) |
| Políticas YAML por sitio | `policies/*.yaml` | 1 (formato, issue #7) | 2 escribe ERP y bandeja, 3 las apps de banca |

## Comprobar

```bash
python -m pip install "jsonschema>=4.18"
python docs/contracts/validate.py
```

Valida cada ejemplo de `examples/` contra su esquema y comprueba que los de `examples/invalid/` se rechazan. El nombre del ejemplo dice contra qué se valida: `audit.blocked.json` contra `audit.schema.json`; `tools.act_input.tap.json` contra `tools.schema.json#/$defs/act_input`.

## Recorrido

```
observe  adaptador.snapshot() ─ snapshot ─▶ núcleo ─ observation ─▶ MCP ─▶ Claude
act      Claude ─ act_input ─▶ núcleo ─ (políticas, procedencia, confirmación, ejecutor) ─ RealAction ─▶ adaptador.perform()
                               núcleo ─ act_result {ok | held | denied} ─▶ Claude
oracle   Claude ─ oracle_input ─▶ núcleo ─ oracle_result ─▶ Claude
eventos  núcleo ─ audit · screen · voice · confirm_request ─▶ consola, app 8, agente
         app 8 o consola ─ approval_result ─▶ núcleo
```

## Qué concreta respecto a la arquitectura

Estos puntos no estaban cerrados en `docs/arquitectura.html`. Se proponen así; si alguien necesita otra cosa, se comenta en el PR.

1. **Un solo campo de contenido, `text`.** El ejemplo de `observe` usaba `value` y el del snapshot `text`. Queda `text` en los dos: contenido visible o del campo.
2. **Valores de enumerados sin tildes:** `paused: "autenticacion"`, `cls: "ambar"`.
3. **`observation.schema.json` y `tools.schema.json` aparte de `mcp/tools.json`.** El núcleo fija qué acepta y devuelve; el servidor MCP (Camino 3) decide cómo se lo describe al modelo.
4. **Motivos de rechazo comunes** a `act`, `oracle` y la auditoría: `fuga`, `destino`, `rojo`, `presupuesto`, `sin_regla`, `token_desconocido`, `caducado`, `cancelado`.
5. **`confirm_request` y `approval_result` llevan `type`** para poder ir por el mismo WebSocket. Un `ok: false` lleva `reason` (`cancelado` o `caducado`). Se añade `llamar` a los tipos de confirmación para la llamada de verificación.
6. **Canal de eventos nuevo (`events.schema.json`).** Mensaje `screen` con la pantalla real y la observada, para la vista partida de la consola. Es local y no se guarda en el registro.
7. **Puente:** mensaje `hello` al conectar con `version: 1`, `error` en los resultados fallidos y eventos `system_dialog_closed`, `screen_changed` y `app_changed`.
8. **Auditoría:** `prev` de la primera línea es `sha256:` y 64 ceros; `hash` se calcula sobre el JSON canónico (claves ordenadas, sin espacios, UTF-8) sin `hash` ni `sig`; `counts` en `observe_sent` para las métricas.
9. **Voz:** un segmento `local` puede llevar `text` en vez de `token`, para leer en local una frase entera que el bloqueo final no dejó salir.
