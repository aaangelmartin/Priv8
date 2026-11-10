# Adaptador web (Playwright)

Conecta el ERP Alba Core (`apps/erp-sim`, :5173) y la bandeja de correo (`apps/inbox-sim`, :5174) con el núcleo. Lee el DOM, no píxeles, y cumple `core/adapter.py`:

- `snapshot()` devuelve la pantalla con valores reales (`docs/contracts/snapshot.schema.json`). Solo entran los elementos marcados con `data-p8`; el selector es `#id` o `.clase`, que es lo que casan `policies/alba-core.yaml` y `policies/inbox.yaml`.
- `perform()` ejecuta `tap`, `type`, `key`, `scroll`, `back`, `send`, `open_app` (`alba-core` o `inbox`, una pestaña cada una) y `call` (de momento la llamada queda en `web.calls`; la real es #23). Recibe los valores ya rehidratados.

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
