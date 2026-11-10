# Priv8

**Priv8 CUA** es un protocolo para que un agente de IA use pantallas sin ver los datos. Cada dato sensible de la pantalla se cambia por un token (`‹IBAN_1·maestro›`, `‹IMPORTE_3·positivo›`) antes de llegar al modelo, y solo vuelve a su valor real en local, al ejecutar. El agente hace el trámite; la cifra, el IBAN o el nombre no salen del entorno de confianza.

> Visa y Google resolvieron cómo paga un agente. Priv8 resuelve qué ve mientras trabaja.

Proyecto para Hackfinance (Madrid Engineering Week 2026). Sobre el mismo núcleo hay dos verticales:

- **B2B · Priv8 para empresas.** Llega un correo con la factura de un proveedor. 8, el agente, la registra en un ERP antiguo (Alba Core, simulado) sin ver los datos y bloquea el cambio de IBAN que trae el mismo correo. Después llama al proveedor al teléfono de la ficha y contesta el correo. Todo queda en un registro firmado.
- **B2C · 8 en tu móvil.** En un Android del emulador, 8 maneja las apps de banca simuladas por accesibilidad y habla con voz. Responde "¿cuánto tengo?", prepara transferencias con confirmación por voz y mira a otro lado mientras la persona pone su huella o su clave.

Todos los datos, bancos y empresas son inventados.

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
| ERP, bandeja de correo, consola de auditoría y adaptador web | `apps/`, `adapters/web/` | En curso |

## Requisitos

- **[uv](https://docs.astral.sh/uv/)**. Instala Python 3.12 y las dependencias por su cuenta. No hace falta tener Python instalado.
- **make** (opcional). En Windows sin make, usa los comandos `uv run …` que acompañan a cada `make`.
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
| `PRIV8_CORE` | Núcleo del agente: `real` (el de `core/`) o `fake` (uno simulado en memoria) |
| `PRIV8_AUDIT` | Dónde va el registro firmado (por defecto `audit/priv8.jsonl`); `off` lo deja solo en memoria |
| `PRIV8_AUDIT_KEY` | Clave ed25519 del registro (por defecto `audit/priv8.key`; se crea si no existe) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Voz en la nube (ver `voice/README.md`) |

Para pasar el `.env` a un comando: `uv run --env-file .env …`.

## Ejecución

### Las dos escenas de la demo, sin claves

```bash
make replay
```

Sin make: `uv run python -m core.replay`. Para una sola escena: `SCENE=b2b make replay` o `uv run python -m core.replay b2c`.

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
PRIV8_CORE=real make agent
```

Sin make: `uv run --env-file .env python -m agent.agent --serve --task "registrar factura"`. Hace falta `ANTHROPIC_API_KEY`. Con `--record FICHERO.json` se graba un replay nuevo. Detalles en `agent/README.md`.

### Comprobar un registro de auditoría

```bash
uv run python -m core.audit verify audit/replay.jsonl
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
uv run pytest agent/tests core/tests voice/tests
uv run python docs/contracts/validate.py
```

Debe terminar todo en verde. Entre otras cosas, comprueba:
- que ningún valor real llega al modelo;
- las 10 variantes del correo trampa;
- que la confirmación caduca;
- que el oráculo no deja reconstruir una cifra;
- que la auditoría detecta alteraciones;
- que las dos escenas del replay terminan sin fugas.

La lista de conformidad del protocolo, con el test que prueba cada punto, está en `docs/SPEC.md`.

## Estructura

```
core/            Núcleo Priv8 CUA (Python): detector, tokens, bóveda, políticas, procedencia,
                 oráculo, ejecutor, confirmación, bloqueo final, auditoría, escenas y replay
policies/        Políticas por sitio (YAML): formato en docs/contracts/policies.md
agent/           Servidor MCP (observe, act, oracle) y bucle del agente
voice/           Voz mixta: frases sin datos a ElevenLabs, cifras y nombres en local
adapters/        Adaptadores de pantalla: Android (puente WebSocket) y web
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
