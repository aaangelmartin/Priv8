# Adaptador web (Playwright)

Conecta el ERP Alba Core (`apps/erp-sim`, :5173) y la bandeja de correo (`apps/inbox-sim`, :5174) con el núcleo. Lee el DOM, no píxeles, y cumple `core/adapter.py`:

- `snapshot()` devuelve la pantalla con valores reales (`docs/contracts/snapshot.schema.json`). Solo entran los elementos marcados con `data-p8`; el selector es `#id` o `.clase`, que es lo que casan `policies/alba-core.yaml` y `policies/inbox.yaml`.
- `perform()` ejecuta `tap`, `type`, `key`, `scroll`, `back`, `send`, `open_app` (`alba-core` o `inbox`, una pestaña cada una) y `call` (de momento la llamada queda en `web.calls`; la real es #23). Recibe los valores ya rehidratados.

**Cursor de 8 (#135).** Con ventana (`make agent-web`), quien mira Chromium ve a 8 trabajar: antes de cada `tap`, `send`, `type` o `call`, unos ojos de 8 en cobalto se deslizan hasta el elemento (350 a 500 ms), dejan una onda al pulsar, rodean el campo y teclean el principio del texto a ritmo humano; `fill()` pone luego el valor entero, como sin cursor. Añade unos 0,5 s por pulsación y 0,7 s por escritura. La capa (`cursor8.js`) vive en un shadow root colgado de `<html>` con `data-p8-ignore` y `aria-hidden`, sin eventos de puntero, y el snapshot salta todo lo que cuelga de `data-p8-ignore`: el modelo ve lo mismo con cursor o sin él. `PRIV8_CURSOR=0` lo apaga y `PRIV8_CURSOR=1` lo enciende también sin ventana.

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
