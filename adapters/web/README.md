# Adaptador web (Playwright)

Conecta el ERP Alba Core (`apps/erp-sim`, :5173) y la bandeja de correo (`apps/inbox-sim`, :5174) con el núcleo. Lee el DOM, no píxeles, y cumple `core/adapter.py`:

- `snapshot()` devuelve la pantalla con valores reales (`docs/contracts/snapshot.schema.json`). Solo entran los elementos marcados con `data-p8`; el selector es `#id` o `.clase`, que es lo que casan `policies/alba-core.yaml` y `policies/inbox.yaml`.
- `perform()` ejecuta `tap`, `type`, `key`, `scroll`, `back`, `send`, `open_app` (`alba-core` o `inbox`, una pestaña cada una) y `call` (de momento la llamada queda en `web.calls`; la real es #23). Recibe los valores ya rehidratados.

**Pantallas conocidas (#148).** `back` nunca sale de la app: si atrás iría a otro origen o a una página sin `data-p8` o sin política, lleva a la pantalla de inicio de la app (`/bandeja`, `/facturas/alta`). `open_app` funciona desde cualquier página y, si la pestaña está en una muerta, la lleva a su inicio; si está viva, la deja como estaba. `recover()` lo usa el núcleo cuando `observe` no encuentra política, y `reset_view()` lo llama el bucle del agente antes de cada encargo de la consola: las dos apps a su inicio, sin cerrar la sesión de Alba Core. Ninguno de los dos es una herramienta del modelo. Con `known=` (lo pasa `mount_web`) el adaptador pregunta a las políticas del núcleo si una pantalla sale.

**Cursor de 8 (#135).** Con ventana (`make agent-web`), quien mira Chromium ve a 8 trabajar: antes de cada `tap`, `send`, `type` o `call`, unos ojos de 8 en cobalto se deslizan hasta el elemento (350 a 500 ms), dejan una onda al pulsar, rodean el campo y teclean el principio del texto a ritmo humano; `fill()` pone luego el valor entero, como sin cursor. Añade unos 0,5 s por pulsación y 0,7 s por escritura. La capa (`cursor8.js`) vive en un shadow root colgado de `<html>` con `data-p8-ignore` y `aria-hidden`, sin eventos de puntero, y el snapshot salta todo lo que cuelga de `data-p8-ignore`: el modelo ve lo mismo con cursor o sin él. `PRIV8_CURSOR=0` lo apaga y `PRIV8_CURSOR=1` lo enciende también sin ventana.

**8 vivo en la ventana (#154).** El cursor son los ojos de 8 con el motor de la web (`apps/console/src/eight/engine.js` y las fuentes de la marca, inyectados con `add_init_script`): miran hacia donde va, parpadean y cambian de cara según lo que hace (leer al observar, pensar mientras espera al modelo, hablar al escribir, esperar en una acción retenida, enfado en un bloqueo, listo al terminar). Al lado lleva un bocadillo como el de 8 en el chat de la consola, tecleado, con lo que razona (`paso N - razona`) y lo que hace. Lo mueve el canal de eventos del núcleo en el mismo proceso (`on_core_event`, lo suscribe `core.connect`). En la ventana real el bocadillo lleva los valores (es la pantalla de la persona); en la vista de 8, tokens.

**Vista de 8 (#154).** Mientras una consola mira, el adaptador mantiene una página espejo en un Chromium aparte y sin ventana que el agente nunca navega (`vista.py`). En cada cambio de la pestaña de 8 (MutationObserver, desplazamiento, foco, teclado; como mucho cada 100 ms) `vista8.js` clona el documento en la propia pestaña y censura la copia: cada elemento `data-p8` lleva el texto que leyó el modelo (tokens en lo ámbar, «nunca sale» en lo rojo, el token que escribe 8 en los campos), lo que aún no ha leído y el texto sin marcar que el modelo no recibió salen como marcador neutro, las imágenes y los campos sin marcar quedan vacíos y solo quedan los atributos de presentación. Antes de escribir la copia en el espejo pasa el bloqueo final (`guard`): ningún valor de la bóveda, de la semilla de confianza ni del texto real de lo ámbar o rojo, y el mismo `check` que las peticiones al modelo. Si no pasa, la vista se queda como estaba. Lo que se emite a la consola (`frame` con `vista: "8"`) es el screencast de ese espejo: los píxeles de la pestaña real ya no salen del adaptador.

`PRIV8_ALBA_URL` y `PRIV8_INBOX_URL` apuntan el adaptador (y sus tests) a otra copia de las apps, por ejemplo para probar sin tocar una demo en marcha:

```bash
(cd apps/erp-sim && pnpm exec vite --port 5190 --strictPort) & (cd apps/inbox-sim && pnpm exec vite --port 5191 --strictPort) &
PRIV8_ALBA_URL=http://127.0.0.1:5190 PRIV8_INBOX_URL=http://127.0.0.1:5191 uv run pytest adapters/web/tests
```

Con `profile=<carpeta>` el contexto es persistente y la sesión se recuerda entre ejecuciones; el agente usa `.priv8/chromium/` (`PRIV8_WEB_PROFILE` lo cambia, `off` lo apaga). Si el perfil está en uso por otro proceso, abre uno de usar y tirar. `logged_in(app)` dice si la app ya tiene la sesión abierta y `wait_until_logged_in(app)` espera a que la persona entre: el adaptador nunca escribe la clave.

Chromium vive en un hilo propio porque Playwright síncrono no se puede usar desde varios hilos y el núcleo llama desde el bucle del agente y desde el WebSocket de aprobaciones.

```bash
uv run playwright install chromium     # una vez
make web                               # las dos apps
make agent-web                         # agente en vivo sobre ellas (ANTHROPIC_API_KEY)
uv run pytest adapters/web/tests       # arranca las apps si no están en marcha
```

```python
from adapters.web import WebAdapter
import core

web = WebAdapter(start="inbox")
core.connect("b2b", web)
core.observe("b2b")
```
