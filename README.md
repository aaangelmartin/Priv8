# Priv8

**Priv8 CUA** es un protocolo para que un agente de IA use pantallas sin ver los datos. Cada dato sensible de la pantalla se cambia por un token (`‹IBAN_1·maestro›`, `‹IMPORTE_3·positivo›`) antes de llegar al modelo, y solo vuelve a su valor real en local, al ejecutar. El agente hace el trámite; la cifra, el IBAN o el nombre no salen del entorno de confianza.

> Visa y Google resolvieron cómo paga un agente. Priv8 resuelve qué ve mientras trabaja.

Proyecto para Hackfinance (Madrid Engineering Week 2026). Sobre el mismo núcleo hay dos verticales:

- **B2B · Priv8 para empresas.** Llega un correo con la factura de un proveedor. 8, el agente, la registra en un ERP antiguo (Alba Core, simulado) sin ver los datos y bloquea el cambio de IBAN que trae el mismo correo. Después llama al proveedor al teléfono de la ficha y contesta el correo. Todo queda en un registro firmado.
- **B2C · 8 en tu móvil.** En un Android del emulador, 8 maneja las apps de banca simuladas por accesibilidad y habla con voz. Responde "¿cuánto tengo?", prepara transferencias con confirmación por voz y mira a otro lado mientras la persona pone su huella o su clave.

Todos los datos, bancos y empresas son inventados.

Web: https://priv8.es (código en `apps/landing/`).

## Cómo funciona

```
pantalla ─ snapshot (DOM o accesibilidad) ─▶ núcleo: política → detector → bóveda → bloqueo final ─▶ Claude
Claude ─ act con tokens ─▶ núcleo: procedencia → confirmación humana → rehidrata en local ─▶ pantalla
```

El agente solo tiene tres herramientas: `observe`, `act` y `oracle` (calcula sin revelar). La especificación del protocolo está en [`docs/SPEC.md`](docs/SPEC.md) y los contratos, en [`docs/contracts/`](docs/contracts/).

## Estado

| Pieza | Carpeta | Estado |
|---|---|---|
| Núcleo: detector, tokens y bóveda, políticas, procedencia, oráculo, ejecutor, confirmación, bloqueo final, auditoría firmada | `core/`, `policies/` | Funciona, con tests |
| Servidor MCP y bucle del agente | `agent/` | Funciona, con tests |
| Modo replay de las dos escenas, sin claves | `core/replay.py` | Funciona |
| Voz mixta: ElevenLabs y voz local | `voice/` | Funciona, con tests |
| Servicio de accesibilidad, puente y app 8 | `apps/android-8/`, `adapters/android/` | Ver su README |
| Banca Alcor simulada | `apps/banks-sim/` | Ver su README |
| ERP Alba Core, bandeja de correo y factura en PDF | `apps/erp-sim/`, `apps/inbox-sim/` | Funciona |
| Adaptador web (Playwright) | `adapters/web/` | Funciona, con tests |
| Consola de auditoría | `apps/console/` | Funciona |
| Web de Priv8 (landing) | `apps/landing/` | Funciona; se publica en GitHub Pages con `.github/workflows/landing-pages.yml` |
| Llamada de verificación | `voice/call.py` | Simulada; la llamada real con ElevenLabs y Twilio está sin probar |
| Métricas B2B con y sin protocolo | `metrics/` | Funciona (el caso sin protocolo es un modelo, no una ejecución) |
| Datos inventados | `data/seed.json` | Validados con `data/check_seed.py` |

## Requisitos

- **[uv](https://docs.astral.sh/uv/)**. Instala Python 3.12 y las dependencias por su cuenta. No hace falta tener Python instalado.
- **make** (opcional). En Windows sin make, usa los comandos `uv run …` que acompañan a cada `make`.
- **Para la parte web (B2B en vivo):** Node 20 o superior y [pnpm](https://pnpm.io). Una vez: `make web-install`.
- **Para la parte Android:** Android Studio con un emulador de Android 14. Ver `apps/android-8/README.md`.
- **Claves** (solo para el modo en vivo): API de Claude y, para la voz en la nube, ElevenLabs. **El modo replay no necesita ninguna.**

## Instalación

Desde el repositorio o desde el ZIP descargado con "Download ZIP":

```bash
cd Priv8
uv sync
```

`uv sync` crea `.venv` con Python 3.12 y las dependencias exactas de `uv.lock`.

## Configuración

Solo hace falta para el modo en vivo. Copia el ejemplo y rellena lo que uses:

```bash
cp .env.example .env
```

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Agente en vivo con Claude |
| `PRIV8_CORE` | Núcleo del agente: `real` (el de `core/`, por defecto) o `fake` (uno simulado en memoria) |
| `PRIV8_AUDIT` | Dónde va el registro firmado (por defecto `audit/priv8.jsonl`); `off` lo deja solo en memoria |
| `PRIV8_AUDIT_KEY` | Clave ed25519 del registro (por defecto `audit/priv8.key`; se crea si no existe) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Voz en la nube (ver `voice/README.md`) |

Para pasar el `.env` a un comando: `uv run --env-file .env …`.

## Ejecución

### Las dos escenas de la demo, sin claves

```bash
make demo
```

Sin make: `uv run python -m core.replay`. Para una sola escena: `SCENE=b2b make demo` o `uv run python -m core.replay b2c`. (`make replay` hace lo mismo desde la entrada del agente, `agent.agent`, y `make replay-fake` lo corre sobre el núcleo simulado; ver `agent/README.md`.)

Corre las dos escenas con el **núcleo real** y respuestas del modelo grabadas (`core/replays/`). Por cada paso se ve lo que recibe y pide el modelo, siempre con tokens. Al final aparece:
- lo que dice 8 renderizado en local, con los valores reales;
- cuántas peticiones al modelo llevaban algún valor real (debe ser 0);
- un resumen de la auditoría;
- la comprobación del registro firmado `audit/replay.jsonl`.

Lo que hay que ver en la escena B2B:
- `act type e9 ‹IBAN_1·correo›` devuelve `denied: destino`: el IBAN del correo no entra en el pago.
- La llamada al teléfono del correo se rechaza; la del teléfono de la ficha pide confirmación.
- Registrar y Enviar quedan retenidos hasta que la persona confirma.

Y en la B2C:
- `oracle sum` devuelve `‹SUMA_1›`; la cifra solo se ve en local.
- La transferencia pide confirmación y el agente queda en pausa durante la huella.

### Con Claude en vivo

```bash
uv run --env-file .env python -m agent.agent --serve --task "registrar factura"
```

Lee la configuración del `.env` (hace falta `ANTHROPIC_API_KEY`; el núcleo real es el de por defecto). `make agent` lanza lo mismo, pero no lee el `.env`: con make hay que exportar antes las variables en la terminal. Con `--record FICHERO.json` se graba un replay nuevo. Detalles en `agent/README.md`.

### B2B en vivo: ERP, correo y consola

Lista para probar con un solo comando:

```bash
make web-install          # una vez: dependencias de las tres apps y Chromium
make demo-b2b             # las tres apps y 8 esperando en la consola; necesita ANTHROPIC_API_KEY en .env
```

`make demo-b2b` arranca Alba Core (:5173), el correo (:5174) y la consola (:5175) si no están en marcha, abre Chromium con las dos pestañas y deja a 8 esperando encargos. Usa el `.env` si existe (la clave de la API y, para pruebas más baratas, `PRIV8_MODEL`). Al terminar imprime la dirección de la consola: http://127.0.0.1:5175. `Ctrl-C` para el agente y las apps que arrancó.

Alba Core abre con la sesión ya abierta, como el ordenador de una empresa: nadie escribe la clave, ni la persona ni 8. Es una sesión recordada (`VITE_ALBA_SESION=admin.alba`, solo en desarrollo). Si alguien pulsa «Cerrar sesión», Alba Core vuelve a pedir la clave y 8 espera a que la persona entre, como en el producto. El correo no tiene identificación.

Chromium guarda su perfil en `.priv8/chromium/` (fuera de git), así que una sesión abierta a mano también se recuerda en la siguiente ejecución. `PRIV8_WEB_PROFILE=<carpeta>` usa otra carpeta y `PRIV8_WEB_PROFILE=off` un perfil de usar y tirar. Para empezar de cero: borrar `.priv8/` o abrir `/reset` en Alba Core (borra las facturas registradas).

Por partes, en dos terminales:

```bash
make web                  # Alba Core :5173, correo :5174, consola :5175
make agent-web            # en otra terminal; necesita ANTHROPIC_API_KEY
make agent-web TASK="registrar factura"   # o con una primera tarea ya puesta
```

Abre la consola en http://127.0.0.1:5175. Con `make web` Alba Core pide identificarse: la primera vez entra con `admin.alba` / `Alba-2026!` en la ventana de Chromium que abre el agente (la clave la escribe la persona, nunca 8); después la sesión queda recordada. El encargo se le pide a 8 desde la consola, por ejemplo «registrar factura». 8 lee el correo, registra la factura y la deja retenida: se aprueba desde la consola. La respuesta de 8 sale también en la consola, con tokens en lugar de datos. Después 8 espera el siguiente encargo; `Ctrl-C` lo para. La llamada a la ficha del proveedor va en modo simulado salvo que estén las variables de `voice/.env.example`.

Métricas con y sin protocolo, sin claves: `make metrics`.

### Llamar al banco por ti, sin claves

```bash
make llamada-banco                                   # «Quiero hablar con un gestor»
make llamada-banco OBJETIVO="Bloquea mi tarjeta, me la han robado" VOZ=texto
```

8 llama a la línea simulada de Banca Alcor (datos inventados), dice primero que es un asistente de IA que llama en nombre de un cliente, pasa el menú por tonos, espera y, cuando contesta un gestor, le pasa la llamada a la persona y se retira. Si la línea pide PIN, código, clave, tarjeta o DNI, cede la llamada en ese momento: la identificación la hace siempre la persona. La terminal muestra lo que dice la línea, lo que ve 8 (con tokens) y la auditoría sin valores. Detalles en `voice/README.md`.

### Comprobar un registro de auditoría

```bash
uv run python -m core.verify audit/replay.jsonl
```

Detecta líneas editadas, borradas, reordenadas o firmadas con otra clave.

### Eventos para la consola

En el proceso del agente, `core.server.start()` sirve `ws://127.0.0.1:8700/events`. Para probarlo suelto: `uv run python -m core.server`. Los mensajes siguen `docs/contracts/events.schema.json`.

### Android (B2C)

Ver `apps/android-8/README.md` y `apps/banks-sim/README.md`. En resumen:
- `scripts/emu.sh` arranca el emulador, instala los APK y activa el servicio de 8;
- `adb reverse tcp:8765 tcp:8765` une el emulador con el puente del portátil.

## Prueba

```bash
make test
```

Sin make:

```bash
uv run pytest agent/tests core/tests voice/tests adapters/web/tests metrics
uv run python docs/contracts/validate.py
uv run python data/check_seed.py
```

Debe terminar todo en verde. Entre otras cosas, comprueba:
- que ningún valor real llega al modelo;
- las 10 variantes del correo trampa;
- que la confirmación caduca;
- que el oráculo no deja reconstruir una cifra;
- que la auditoría detecta alteraciones;
- que las dos escenas del replay terminan sin fugas;
- que el ERP y el correo reales, por el adaptador web, no sueltan ningún dato del seed y el IBAN del correo no entra en el pago (los tests arrancan las apps si están instaladas y, si no, se saltan).

La lista de conformidad del protocolo, con el test que prueba cada punto, está en `docs/SPEC.md`.

## Estructura

```
core/            Núcleo Priv8 CUA (Python): detector, tokens, bóveda, políticas, procedencia,
                 oráculo, ejecutor, confirmación, bloqueo final, auditoría, escenas y replay
policies/        Políticas por sitio (YAML): formato en docs/contracts/policies.md
agent/           Servidor MCP (observe, act, oracle) y bucle del agente
voice/           Voz mixta: frases sin datos a ElevenLabs, cifras y nombres en local
adapters/        Adaptadores de pantalla: Android (puente WebSocket); el web, en curso
apps/            App 8 y bancos simulados (Android); ERP, bandeja y consola (web)
docs/            SPEC.md, contracts/, arquitectura, plan, marca y 8
scripts/emu.sh   Arranca el emulador e instala los APK
```

## Documentos

| Archivo | Qué es |
|---|---|
| `docs/SPEC.md` | Especificación del protocolo: clases de dato, tokens, las seis piezas, herramientas y conformidad |
| `docs/contracts/` | Contratos en JSON Schema con ejemplos (`uv run python docs/contracts/validate.py`) |
| `docs/arquitectura.html` | Arquitectura, contratos, flujos, despliegue y reparto (resumen en `docs/arquitectura.md`) |
| `docs/plan.html` | Estrategia: Priv8 CUA y sus dos verticales, demo, métricas, rúbrica y plan |
| `docs/marca.html` | Guía de marca |
| `docs/ojos.html` | 8 en vivo, con sus estados y el código de animación |
| `brand/` | Logos, icono, tokens de marca y esquema de expresiones de 8 |
| `CLAUDE.md` | Contexto del proyecto y reparto |
| `bases/bases-hackathon.pdf` | Bases y rúbrica oficiales |
| `research_notes/`, `reports/` | Investigación de mercado y validaciones |

Los `.html` se abren directamente en el navegador.

## Equipo

Pablo Rojo (núcleo), Álvaro (empresa: ERP, bandeja, consola, telefonía), Ángel (agente, Android, voz y diseño) y Marco (app 8 y bancos).
