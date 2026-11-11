# Adaptador web (`adapters/web/`)

El adaptador del núcleo para las apps web del B2B: conecta Alba Core (`apps/erp-sim`, :5173) y la bandeja de correo (`apps/inbox-sim`, :5174) con el núcleo usando Playwright. Lee el DOM, no píxeles, y cumple la interfaz de `core/adapter.py`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `adapter.py` | `WebAdapter`: `snapshot()`, `perform()`, `recover()`, `reset_view()`, `logged_in()`, `wait_until_logged_in()` |
| `cursor8.js` | Cursor de 8 en la ventana de Chromium (#135, #154) |
| `vista.py`, `vista8.js` | Vista de 8 (#154): espejo censurado de la pestaña para la consola |
| `tests/` | pytest: adaptador, sesión y vista de 8 |

## Uso

```bash
uv run playwright install chromium     # una vez
make web                               # las dos apps y la consola
make agent-web                         # agente en vivo sobre ellas (ANTHROPIC_API_KEY)
```

```python
from adapters.web import WebAdapter
import core

web = WebAdapter(start="inbox")
core.connect("b2b", web)
core.observe("b2b")
```

## Pruebas

```bash
uv run pytest adapters/web/tests       # arranca las apps si no están en marcha
```

`PRIV8_ALBA_URL` y `PRIV8_INBOX_URL` apuntan el adaptador y sus tests a otra copia de las apps, para probar sin tocar una demo en marcha:

```bash
(cd apps/erp-sim && pnpm exec vite --port 5190 --strictPort) & (cd apps/inbox-sim && pnpm exec vite --port 5191 --strictPort) &
PRIV8_ALBA_URL=http://127.0.0.1:5190 PRIV8_INBOX_URL=http://127.0.0.1:5191 uv run pytest adapters/web/tests
```

## Detalles

- **Snapshot.** Devuelve la pantalla con valores reales (`docs/contracts/snapshot.schema.json`). Solo entran los elementos marcados con `data-p8`; el selector es `#id` o `.clase`, que es lo que casan `policies/alba-core.yaml` y `policies/inbox.yaml`.
- **Acciones.** `perform()` recibe los valores ya rehidratados y ejecuta `tap`, `type`, `key`, `scroll`, `back`, `send`, `open_app` (`alba-core` o `inbox`, una pestaña cada una) y `call`. La llamada queda de momento en `web.calls`; la real es #23.
- **Pantallas conocidas (#148).** `back` nunca sale de la app: si iría a otro origen o a una página sin `data-p8` o sin política, lleva al inicio (`/bandeja`, `/facturas/alta`). `open_app` funciona desde cualquier página. El núcleo usa `recover()` cuando `observe` no encuentra política, y el bucle llama a `reset_view()` antes de cada encargo de la consola, sin cerrar la sesión de Alba Core. Ninguno de los dos es una herramienta del modelo. Con `known=` (lo pasa `mount_web`) el adaptador pregunta a las políticas del núcleo si una pantalla sale.
- **Cursor de 8 (#135, #154).** Con ventana, antes de cada `tap`, `send`, `type` o `call` los ojos de 8 se deslizan hasta el elemento, dejan una onda al pulsar y teclean el principio del texto; `fill()` pone después el valor entero. Usan el motor de `apps/console/src/eight/engine.js` y cambian de cara según los eventos del núcleo (`on_core_event`). Añade unos 0,5 s por pulsación y 0,7 s por escritura. La capa vive en un shadow root con `data-p8-ignore` y `aria-hidden`, y el snapshot salta todo lo que cuelga de `data-p8-ignore`: el modelo ve lo mismo con cursor o sin él. `PRIV8_CURSOR=0` lo apaga y `PRIV8_CURSOR=1` lo enciende también sin ventana.
- **Vista de 8 (#154).** Mientras una consola mira, `vista.py` mantiene una página espejo en un Chromium aparte y sin ventana. En cada cambio (como mucho cada 100 ms) `vista8.js` clona el documento y lo censura: cada elemento `data-p8` lleva lo que leyó el modelo (tokens en lo ámbar, «nunca sale» en lo rojo) y el resto sale como marcador neutro. Antes de escribir la copia pasa el bloqueo final (`guard`); si no pasa, la vista no cambia. A la consola solo llega el screencast de ese espejo (`frame` con `vista: "8"`).
- **Sesión.** Con `profile=<carpeta>` el contexto es persistente; el agente usa `.priv8/chromium/` (`PRIV8_WEB_PROFILE` lo cambia, `off` lo apaga). Si el perfil está en uso, abre uno temporal. El adaptador nunca escribe la clave: `wait_until_logged_in(app)` espera a que entre la persona.
- **Hilos.** Chromium vive en un hilo propio porque Playwright síncrono no se puede usar desde varios hilos, y el núcleo llama desde el bucle del agente y desde el WebSocket de aprobaciones.
