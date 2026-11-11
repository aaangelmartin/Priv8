# Panel de la demo

Página local para la demo en directo (#169): un botón prepara B2B y otro B2C. La sirve `scripts/panel.py` en http://127.0.0.1:5170, junto con su API (`/api/estado`, `/api/b2b`, `/api/b2c`, `/api/caso`, `/api/parar`, `/api/liberar`).

- **Abrirlo:** doble clic en `Demo Priv8.command` (raíz del repositorio) o `make panel`.
- **B2B:** lanza `scripts/demo_b2b.sh`.
- **B2C:** lanza `scripts/movil.sh` (compila, arranca el emulador e instala las APK) y `python -m agent.agent --android`; cuando 8 espera la tarea, pone la app Priv8 delante.
- **Casos preparados (#187):** con B2B o B2C lista, el panel muestra sus casos de `data/casos.json` con un botón «Pedir a 8» (y «Copiar»). El botón hace `POST /api/caso` con `{id}`; `scripts/panel.py` comprueba que el caso es de la demo preparada y que 8 escucha en el 8700, y manda `{"type":"task_request","session":"b2b"|"b2c","text":pedido}` por `ws://127.0.0.1:8700/events`, como la consola o la app 8. Los casos sin pedido (sin protocolo) enlazan a la consola con `?feed=`. Para «La clave nunca sale», deja Banca Alcor en su pantalla de entrada antes de pedirlo.
- **La consola (:5175)** la arranca el panel una vez y sirve a las dos.
- **Desarrollo:** `pnpm dev` en :5171, con `/api` hacia el servidor de :5170.

Mismo sistema visual que `apps/landing` y `apps/mcp-site` (copia de su `Field`, `Eight` y estilos).
