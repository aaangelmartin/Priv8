# Consola de auditoría (#21)

App React + Vite que escucha `ws://127.0.0.1:8700/events` y muestra, en local. Usa la marca de `brand/` (tokens, logos, caras de 8) y las fuentes van empaquetadas, así que funciona sin red. Tiene el diseño de la web (`apps/landing`), solo en claro.

La vista principal son dos cosas: 8 en directo y el chat. Lo demás va en pestañas de la barra cobalto (**En directo**, **Alarmas**, **Pantalla**, **Registro**), con insignias para lo que espera: confirmaciones pendientes, alarmas sin revisar y bloqueos. La pestaña va en la URL (`#alarmas`, `#pantalla`, `#registro`).

- **En directo**: banda cobalto con 8 animado (`src/eight/`, copia del motor de la web) y, en una línea, lo que hace ahora (`src/directo.js`), con el paso y el tiempo del encargo. Debajo, dos columnas:
  - **La pantalla de 8** (`src/Vivo.jsx`, lógica en `src/vivo.js`): la última pantalla que ha leído 8, dibujada como una ventana (Alba Core, Correo) o como un móvil si viene de Android (Banca Alcor, Brezo Banco, Nimbo Bróker). El cursor de 8 (sus ojos en una píldora cobalto) se desliza hasta el elemento de cada acción: al pulsar deja una onda, al escribir las letras aparecen en el campo, al cambiar de pantalla la ventana pasa, un bloqueo pone el elemento en rojo con el motivo y una acción retenida late en ámbar con «Esperando tu confirmación». El oráculo señala el dato que compara.
  - **Razonamiento y acciones**: cada paso, en orden y con el tiempo desde el inicio del encargo (observa, pulsa, escribe, pregunta al oráculo, bloqueado, espera, aprobado, la respuesta de 8 palabra a palabra) y «pensando» mientras espera al modelo. Sigue el final salvo que subas.
  - Conmutador **Lo que ves** (valores reales, solo en local) / **Lo que ve 8** (tokens; lo rojo, «nunca sale»). En las reproducciones empieza en lo que ve 8.
  - Los mensajes se reproducen con su ritmo (el cursor llega, pulsa, teclea); si llegan muchos de golpe, se acelera para no quedarse atrás.
- **Pide a 8**: chat para pedir encargos (`task_request` con la sesión de la última pantalla, por defecto `b2b`; el texto no se registra), con sugerencias para la demo B2B. Las frases de 8 (`voice`) se ven con los valores reales en local; las confirmaciones aparecen dentro del chat con la frase, el origen de cada dato, la cuenta atrás y Aprobar/Rechazar (`approval_result`, `via: pantalla`, `by: persona`). En `?demo` y `?feed=` el campo está desactivado.
- **Alarmas** de posible fraude (cambio de cuenta por correo, órdenes a la IA, bloqueos del núcleo), con Marcar como revisada.
- **Pantalla**: cada elemento en una fila con lo que ves y lo que ve la IA. En lo que ves se marca en ámbar el trozo exacto que se ha cambiado por un token; la fila tiene fondo ámbar suave si está tokenizada y rojo suave si nunca sale o va en claro.
- **Registro**: la actividad en orden inverso, filtrable por bloqueos y confirmaciones, la latencia media por paso (`ms.core`, `ms.adapter`, `ms.model`) y **Verificar registro**, que llama a `GET http://127.0.0.1:8700/verify` (cadena de hashes y firma del registro de auditoría) y devuelve `{ok, lines, error}`.

Se reconecta sola si el núcleo se cae.

```sh
python -m core.server        # núcleo en :8700 (desde la raíz del repo)
cd apps/console
pnpm install
pnpm dev                     # http://127.0.0.1:5175
pnpm build
for t in alertas tokens directo vivo; do node src/$t.test.mjs; done   # pruebas sin dependencias
```

**Demo sin núcleo ni IA:** abre `http://127.0.0.1:5175/?demo`. Reproduce `public/demo.json`, los mensajes reales del núcleo en el flujo de la factura con la trampa del IBAN (datos ficticios del seed), capturados sin llamar a la API.

El mensaje `screen` lleva valores reales: la consola solo debe abrirse en la máquina del núcleo.

**El mismo trámite con y sin protocolo (#45):** `make sin-protocolo` ejecuta la escena B2B de `metrics/b2b.py` (núcleo real, respuestas grabadas, sin API) y escribe dos feeds en `public/`:

- `?feed=sin-protocolo`: banda noche «Sin protocolo: el modelo recibe los datos reales». En la pantalla de 8, lo que recibe el modelo lleva los valores del seed marcados en rojo y la cuenta de valores reales enviados al modelo (acaba en la misma cifra que `make metrics`: 6). No hay oráculo, bloqueos ni confirmaciones.
- `?feed=con-protocolo`: la misma ejecución con Priv8 CUA (tokens, alarmas, dos bloqueos y tres confirmaciones), con 0 valores reales al modelo.

`make videos` (o `make video-sin-protocolo` y `make video-con-protocolo`) graba los dos con Playwright a 1440×900 en `docs/entregables/video/` (`.webm` y, con ffmpeg, `.mp4`). `scripts/grabar_consola.py --frames DIR` guarda además capturas para revisar la grabación.
