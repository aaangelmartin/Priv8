# Consola de auditoría (#21)

App React + Vite que escucha `ws://127.0.0.1:8700/events` y muestra, en local:

- **Lo que ves / Lo que ve la IA**: el snapshot real frente a la observación tokenizada (tokens ‹…› resaltados).
- **Eventos bloqueados** con su motivo, y **latencia por paso** (`ms.core`, `ms.adapter`, `ms.model`).
- **Confirmaciones pendientes** con Aprobar/Rechazar: envía `approval_result` (`via: pantalla`, `by: persona`).
- **Verificar registro**: llama a `GET http://127.0.0.1:8700/verify` (cadena de hashes y firma del registro de auditoría), que devuelve `{ok, lines, error}`.

Se reconecta sola si el núcleo se cae.

```sh
python -m core.server        # núcleo en :8700 (desde la raíz del repo)
cd apps/console
pnpm install
pnpm dev                     # http://127.0.0.1:5175
pnpm build
```

El mensaje `screen` lleva valores reales: la consola solo debe abrirse en la máquina del núcleo.
