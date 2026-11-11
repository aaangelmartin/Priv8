# Adaptador web (Playwright)

Conecta el ERP Alba Core (`apps/erp-sim`, :5173) y la bandeja de correo (`apps/inbox-sim`, :5174) con el núcleo. Lee el DOM, no píxeles, y cumple `core/adapter.py`:

- `snapshot()` devuelve la pantalla con valores reales (`docs/contracts/snapshot.schema.json`). Solo entran los elementos marcados con `data-p8`; el selector es `#id` o `.clase`, que es lo que casan `policies/alba-core.yaml` y `policies/inbox.yaml`.
- `perform()` ejecuta `tap`, `type`, `key`, `scroll`, `back`, `send`, `open_app` (`alba-core` o `inbox`, una pestaña cada una) y `call` (de momento la llamada queda en `web.calls`; la real es #23). Recibe los valores ya rehidratados.

**Pantallas conocidas (#148).** `back` nunca sale de la app: si atrás iría a otro origen o a una página sin `data-p8` o sin política, lleva a la pantalla de inicio de la app (`/bandeja`, `/facturas/alta`). `open_app` funciona desde cualquier página y, si la pestaña está en una muerta, la lleva a su inicio; si está viva, la deja como estaba. `recover()` lo usa el núcleo cuando `observe` no encuentra política, y `reset_view()` lo llama el bucle del agente antes de cada encargo de la consola: las dos apps a su inicio, sin cerrar la sesión de Alba Core. Ninguno de los dos es una herramienta del modelo. Con `known=` (lo pasa `mount_web`) el adaptador pregunta a las políticas del núcleo si una pantalla sale.

**Cursor de 8 (#135).** Con ventana (`make agent-web`), quien mira Chromium ve a 8 trabajar: antes de cada `tap`, `send`, `type` o `call`, unos ojos de 8 en cobalto se deslizan hasta el elemento (350 a 500 ms), dejan una onda al pulsar, rodean el campo y teclean el principio del texto a ritmo humano; `fill()` pone luego el valor entero, como sin cursor. Añade unos 0,5 s por pulsación y 0,7 s por escritura. La capa (`cursor8.js`) vive en un shadow root colgado de `<html>` con `data-p8-ignore` y `aria-hidden`, sin eventos de puntero, y el snapshot salta todo lo que cuelga de `data-p8-ignore`: el modelo ve lo mismo con cursor o sin él. `PRIV8_CURSOR=0` lo apaga y `PRIV8_CURSOR=1` lo enciende también sin ventana.

**8 vivo en la ventana (#154).** El cursor es 8 tal cual (el 8 cobalto con un borde fino blanco y los ojos con su fondo, sin píldora), animado con el motor de los ojos de la web (`apps/console/src/eight/engine.js` y las fuentes de la marca, inyectados con `add_init_script`). Pone la cara de lo que hace: curiosidad ante una pantalla nueva y leer en las conocidas, pensar mientras espera al modelo, hablar al escribir, sorpresa cuando el correo pide cambiar la cuenta, enfado (o negar, rechazar) en un bloqueo, esperar en una acción retenida, duda si algo falla, apartar mientras la persona escribe un secreto, listo y alegría al terminar. A su lado, el bocadillo de 8 de la web (Companion de `apps/landing`), uno cada vez y tecleado, con lo que hace paso a paso y lo que razona. Lo mueve el canal de eventos del núcleo en el mismo proceso (`on_core_event`, lo suscribe `core.connect`). En la ventana real el bocadillo lleva los valores (es la pantalla de la persona); en la vista de 8, tokens.

**Toda la página (#154).** Además de lo marcado con `data-p8` (ids `e1`, `e2`… sin cambios), el snapshot lleva cada texto visible de la página como elemento de solo lectura (`extra: true`, ids `t1`, `t2`…, sin acciones): títulos, menús, etiquetas, botones, filas, cuerpo, el valor y el placeholder de un buscador. Mismo texto, mismo id; como mucho 160 y de 280 caracteres; sin lo invisible ni lo que queda fuera de la ventana. Llevan `sel` (`#id` o `.clase`), así que las reglas del sitio también los alcanzan (`.nombre` en el correo). El núcleo los clasifica después de lo marcado: regla si la hay; si no, siempre el detector (bóveda, semilla, IBAN, DNI/NIE, tarjeta, teléfono, correo, importes, nombres), con la procedencia de la pantalla; lo que repite un trozo de un elemento ámbar sale con su token, y uno que no pasa el bloqueo final sale como «nunca sale» en vez de tumbar la pantalla.

**Vista de 8 (#154).** Mientras una consola mira, el adaptador mantiene una página espejo en un Chromium aparte y sin ventana que el agente nunca navega (`vista.py`). En cada cambio de la pestaña de 8 (MutationObserver, desplazamiento, foco, teclado; como mucho cada 100 ms) vuelve a leer la página con el mismo recorrido que `snapshot()`, con sus propios ids (`data-p8-pv`, nunca los del agente), y el núcleo la clasifica igual que en `observe()` sin mandarla a ningún sitio (`core.preview`). `vista8.js` clona el documento y escribe en la copia cada texto exactamente como lo recibiría el modelo, en su sitio y con los estilos de la página: la interfaz tal cual, los datos con su token, lo rojo «nunca sale», el token que escribe 8 en los campos. Lo poco que no entra en la observación (fuera de pantalla, por encima del tope) pasa por el detector del núcleo (`core.mask_text`): solo lo sensible se tapa, con una barra suave del color del texto. Imágenes vacías y solo atributos de presentación. Antes de escribir la copia en el espejo pasa el bloqueo final (`guard`): ningún valor de la bóveda, de la semilla de confianza ni del texto real de lo ámbar o rojo, y el mismo `check` que las peticiones al modelo; si no pasa, se intenta solo con lo que recibiría el modelo y, si tampoco, la vista se queda como estaba. Lo que se emite a la consola (`frame` con `vista: "8"`) es el screencast de ese espejo: los píxeles de la pestaña real no salen del adaptador.

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
