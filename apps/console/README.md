# Consola de auditoría (#21)

App React + Vite que escucha `ws://127.0.0.1:8700/events` y muestra, en local. Usa la marca de `brand/` (tokens, logos, caras de 8) y las fuentes van empaquetadas, así que funciona sin red. Tema claro y oscuro (por defecto, oscuro).

- **Pantalla actual**: cada elemento en una fila con lo que ves y lo que ve la IA. En lo que ves se marca en ámbar el trozo exacto que se ha cambiado por un token; cada fila lleva su estado (lo ve, tokenizado, nunca sale).
- **Confirmaciones pendientes** arriba, con la frase y los valores reales en negrita, el origen de cada dato, la cuenta atrás y Aprobar/Rechazar: envía `approval_result` (`via: pantalla`, `by: persona`).
- **Alarmas de posible fraude** (cambio de cuenta por correo, órdenes a la IA, bloqueos del núcleo), con Marcar como revisada.
- **Actividad**: el registro en orden inverso, filtrable por bloqueos y confirmaciones, y la latencia media por paso (`ms.core`, `ms.adapter`, `ms.model`).
- **Verificar registro**: llama a `GET http://127.0.0.1:8700/verify` (cadena de hashes y firma del registro de auditoría), que devuelve `{ok, lines, error}`.

Se reconecta sola si el núcleo se cae.

```sh
python -m core.server        # núcleo en :8700 (desde la raíz del repo)
cd apps/console
pnpm install
pnpm dev                     # http://127.0.0.1:5175
pnpm build
```

**Demo sin núcleo ni IA:** abre `http://127.0.0.1:5175/?demo`. Reproduce `public/demo.json`, los mensajes reales del núcleo en el flujo de la factura con la trampa del IBAN (datos ficticios del seed), capturados sin llamar a la API.

El mensaje `screen` lleva valores reales: la consola solo debe abrirse en la máquina del núcleo.

**El mismo trámite con y sin protocolo (#45):** `make sin-protocolo` ejecuta la escena B2B de `metrics/b2b.py` (núcleo real, respuestas grabadas, sin API) y escribe dos feeds en `public/`:

- `?feed=sin-protocolo`: banner rojo «Sin protocolo: el modelo recibe esto». Cada pantalla va en bruto al lado de la IA, con los valores del seed marcados en rojo y la cuenta de valores reales enviados al modelo (acaba en la misma cifra que `make metrics`: 6). No hay oráculo, bloqueos ni confirmaciones.
- `?feed=con-protocolo`: la misma ejecución con Priv8 CUA (tokens, alarmas, dos bloqueos y tres confirmaciones), con 0 valores reales al modelo.

`make videos` (o `make video-sin-protocolo` y `make video-con-protocolo`) graba los dos con Playwright a 1440×900 en `docs/entregables/video/` (`.webm` y, con ffmpeg, `.mp4`). `scripts/grabar_consola.py --frames DIR` guarda además capturas para revisar la grabación.
