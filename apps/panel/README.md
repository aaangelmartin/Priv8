# Panel de la demo

Página local para la demo en directo (#169): un botón prepara B2B y otro B2C. La sirve `scripts/panel.py` en http://127.0.0.1:5170, junto con su API (`/api/estado`, `/api/b2b`, `/api/b2c`, `/api/parar`, `/api/liberar`).

- **Abrirlo:** doble clic en `Demo Priv8.command` (raíz del repositorio) o `make panel`.
- **B2B:** lanza `scripts/demo_b2b.sh`.
- **B2C:** lanza `scripts/movil.sh` (compila, arranca el emulador e instala las APK) y `python -m agent.agent --android`; cuando 8 espera la tarea, pone la app Priv8 delante.
- **La consola (:5175)** la arranca el panel una vez y sirve a las dos.
- **Desarrollo:** `pnpm dev` en :5171, con `/api` hacia el servidor de :5170.

Mismo sistema visual que `apps/landing` y `apps/mcp-site` (copia de su `Field`, `Eight` y estilos).
