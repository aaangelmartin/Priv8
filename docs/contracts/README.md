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
tarea    app 8 ─ task_request (texto) ─▶ núcleo ─ next_task() ─▶ agente (tokeniza antes de Claude)
dictado  app 8 ─ dictation_start ─▶ núcleo ─ micro del portátil + Whisper local ─ dictation ─▶ app 8
                                                                   └─ tarea en cola ─▶ next_task()
```

## v1.3 (11 nov) - separador de la etiqueta

No aditivo: la etiqueta del token se separa con un guion, `‹IBAN_1-propio›`, no con el punto medio (issue #130). Cambian a la vez el núcleo, el agente, la voz, la consola, la app 8, los ejemplos y las repeticiones grabadas. Ver `token.md`.

## v1.2 (11 nov) · cambios aditivos

Aditivo: un cliente v1.1 sigue validando.

- **`task_request`** (cliente → núcleo): `{"type":"task_request","session":"b2c","text":"…"}`. La tarea de la persona en texto, dictada en el móvil real con el reconocedor del dispositivo o escrita. El núcleo la encola (`core.next_task`) y la auditoría guarda un `task` con sus tokens y su longitud, nunca el texto.
- **`dictation_start`** (cliente → núcleo): el emulador no reconoce la voz, así que el núcleo graba el micrófono del portátil y lo transcribe con Whisper en local (`voice/dictado.py`). El audio no sale del portátil; no hay reconocedor en la nube.
- **`dictation`** (núcleo → clientes): el texto entendido, para el subtítulo de la app 8. Lleva valores reales, así que solo viaja por el canal local y no se registra. Con `error` (`no_disponible`, `sin_voz`) el texto va vacío.
- **Motivo de rechazo `asesoria`** (issue #43), solo en la auditoría: la persona pidió consejo de inversión («¿en qué fondo lo meto?») y 8 no lo da, porque ejecuta y no asesora (MiFID II). El bucle del agente lo detecta antes de llamar al modelo, así que la petición no sale. En el canal de eventos va primero un `voice` con la frase fija, toda en `cloud` porque no lleva datos, y después el `audit` `blocked` con `reason: asesoria`, que la app 8 pinta con la cara «no puedo» (`rechazar` en `docs/ojos.html`). No es un motivo de `act` ni de `oracle`. Ejemplos: `audit.blocked-asesoria.json`, `events.audit-asesoria.json`, `events.voice-no-puedo.json`.

## v1.1 (10 nov) · cambios aditivos

Un cliente v1 sigue validando. Salen de las notas de Ángel en #58 y #70 (issue #66).

- **Puente:**
  - `confirm_request` y `approval_result` van también por el puente.
  - `render_values` manda al móvil los valores reales de los tokens para que los muestre y los lea en local.
  - Mensajes de voz: `voice`, `voice.audio` y `voice.audio.end` (PCM 24 kHz en tramas binarias entre los dos) y `voice.done`, que se registra como `voice_out`.
  - Evento `focus_left` cuando el foco sale de un campo rojo.
  - `detail` definido: `clave`/`otp`, `permiso`/`biometria`/`oculta`, o el nombre de la pantalla.
- **Nombres de tecla:** `key` acepta `enter`, `back` y `home`. En Android, `send`, `call` y `type` sobre una contraseña devuelven `no_permitido`.
- **Snapshot:** solo trae lo visible. `parent` es el ancestro conservado más cercano y va vacío si no hay ventana. `system_dialog: oculta` para ventanas que no se pueden leer.
- **Pausa antes que la política.** El núcleo mira la pausa antes de buscar política, en este orden:
  1. `system_dialog` no nulo → `dialogo_sistema`;
  2. `app` es `es.priv8.ocho` y `screen` es `confirmacion` → `confirmacion`;
  3. `focus` sobre un elemento con `password: true` → `autenticacion`.

  Con pausa, la observación sale sin elementos y con `screen` crudo o `null`, y `act` se rechaza hasta que acabe. Así, una ventana sin política (un diálogo del sistema, la confirmación de 8) da pausa y no `sin_regla`.
- **Reenvío de confirmaciones.** Tras cada `hello`, el núcleo reenvía los `confirm_request` pendientes con el mismo `id`. Si el móvil ya los había respondido, contesta otra vez con el mismo `approval_result`.
- **Motivo de rechazo `adaptador`:** el adaptador no pudo ejecutar la acción. Vale en `act` y en la auditoría.
- **Ejemplos:** paquete real `es.priv8.banks.alcor`; el campo de contraseña no ofrece `type`; `hello.device` como lo manda el emulador.

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
