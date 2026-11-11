<img alt="Priv8. Sin ver tus datos." src="brand/banner/readme.png" width="100%">

**Priv8 CUA** es un protocolo de privacidad para agentes de IA que usan pantallas. Cada dato sensible se cambia por un token, como `‹IBAN_1-propio›`, antes de llegar al modelo, y el valor real solo vuelve en local al escribirlo en la pantalla. El agente se llama **8**.

> Visa y Google resolvieron cómo paga un agente. Priv8 resuelve qué ve mientras trabaja.

**[Web](https://priv8.es)** | **[Demo en el navegador](https://demo.priv8.es)** | **[Priv8 en tu asistente](https://mcp.priv8.es)** | **[Especificación](docs/SPEC.md)** | **Presentación** (pendiente)

Hackfinance, Madrid Engineering Week 2026. Los datos, bancos y empresas de la demo son inventados.

## Cómo funciona

<img alt="Los datos no cruzan, los tokens sí: la pantalla pasa por Priv8 en tu máquina, el modelo solo recibe tokens, la persona confirma y el ejecutor escribe el valor real" src="docs/img/como-funciona.png" width="100%">

<img alt="Tres clases de dato: libre (8 lo ve), se tokeniza (IBAN, nombres, importes) y nunca sale (contraseña, PIN, OTP, tarjeta)" src="docs/img/clases.png" width="100%">

| Pieza | Qué hace |
|---|---|
| Lectura | El DOM con Playwright en la web y el árbol de accesibilidad en Android. Nunca píxeles. |
| Detector | Política por sitio, IBAN con mod-97, DNI y NIE con su letra, Luhn, nombres y la bóveda local |
| Herramientas | Solo `observe`, `act` y `oracle`. El oráculo suma y compara sin revelar, con presupuesto |
| Procedencia | Un IBAN que llega por correo no puede ser la cuenta de pago |
| Tu «sí» | Registrar, transferir y enviar esperan a la persona. La huella o el OTP los pone ella |
| Bloqueo final | Si un patrón sensible se escapa sin tokenizar, la petición no sale |
| Auditoría | Registro firmado con ed25519: qué recibió el modelo, qué se bloqueó, qué se aprobó |
| Voz mixta | ElevenLabs lee las frases sin datos; la voz local lee cifras y nombres |

## Dos verticales, un núcleo

<img alt="B2B: la factura del correo al ERP sin verla, con el cambio de IBAN bloqueado y la llamada al proveedor. B2C: 8 en el móvil suma tus bancos con el oráculo y la cifra solo suena en local" src="docs/img/verticales.png" width="100%">

## Requisitos

| Para | Necesita |
|---|---|
| Todo | [uv](https://docs.astral.sh/uv/) (instala Python 3.12 y las dependencias) y `make` |
| Web en vivo | Node 20 o superior y [pnpm](https://pnpm.io) |
| Android | Android Studio, un emulador de Android 14 llamado `priv8` y un JDK 17 |
| Modo en vivo | Clave de la API de Claude. ElevenLabs, opcional, para la voz en la nube |

En Windows, cada objetivo del `Makefile` es un `uv run ...` que se puede lanzar a mano.

## Instalación

<img alt="Tres pasos: uv sync y make web-install, la clave en .env, y doble clic en Demo Priv8.command" src="docs/img/uso-instalar.png" width="100%">

```bash
uv sync             # Python y las dependencias exactas de uv.lock
make web-install    # solo para la web en vivo: las tres apps web y Chromium
```

Sirve igual una copia del repositorio o el ZIP de "Download ZIP".

## Configuración

Solo para el modo en vivo: `cp .env.example .env` y rellena la clave.

| Variable | Para qué | Por defecto |
|---|---|---|
| `ANTHROPIC_API_KEY` | Agente en vivo con Claude | - |
| `PRIV8_MODEL` | Modelo del agente; `.env.example` trae `claude-haiku-5-5`, el de la demo | `claude-opus-5-5` |
| `PRIV8_EFFORT` | Esfuerzo de razonamiento (`low` para pruebas) | `high` |
| `PRIV8_TASK_BUDGET_USD` | Límite de gasto por encargo, en dólares | `0.05` |
| `PRIV8_SESSION_BUDGET_USD` | Límite de gasto de la sesión (el proceso del agente) | `0.50` |
| `PRIV8_CORE` | `real` (el núcleo de `core/`) o `fake` (simulado en memoria) | `real` |
| `PRIV8_AUDIT` | Registro firmado; `off` lo deja solo en memoria | `audit/priv8.jsonl` |
| `PRIV8_AUDIT_KEY` | Clave ed25519 del registro; se crea si no existe | `audit/priv8.key` |
| `PRIV8_POLITICA_ESTRICTA` | `1` o vacía: modo estricto, al modelo solo llega lo que cubre una regla del sitio. `0`: permisivo, también el resto de la página filtrado por el detector (salvo en una política con `modo: estricto`). Ver [`core/README.md`](core/README.md#modo-estricto) | estricto |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Voz en la nube (ver [`voice/README.md`](voice/README.md)) | - |

Al llegar a un límite, 8 para y lo dice en la consola. `make demo-b2b` lee el `.env` solo; para el resto, `uv run --env-file .env ...`.

## Ejecución

| | Modo | Comando | Clave | Primera vez |
|---|---|---|---|---|
| 0 | La demo en directo, con un botón | Doble clic en `Demo Priv8.command` (o `make panel`) | Sí | 5-15 min |
| 1 | Las dos escenas, grabadas | `make demo` | No | 1 min |
| 2 | B2B en vivo: ERP, correo y consola | `make demo-b2b` | Sí | 3-5 min |
| 3 | B2C en el emulador | `scripts/movil.sh` y `make agent-android` | Sí (`-replay`: no) | 10-15 min |
| 4 | Priv8 en tu asistente (Claude Code, Codex, Gemini CLI...) | `make mcp-web` o el instalador de [mcp.priv8.es](https://mcp.priv8.es) | No | 5 min |

### 0. La demo en directo, con doble clic

<img alt="El panel en 127.0.0.1:5170: Preparar B2B o B2C; con la demo lista, Abrir la consola, Ver las pantallas o Ver el móvil" src="docs/img/uso-panel.png" width="100%">

En macOS, doble clic en **`Demo Priv8.command`** (o `make panel`). B2B: "Abrir la consola" y "Ver las pantallas". B2C: "Ver el móvil".

Antes, una vez: `cp .env.example .env` con tu `ANTHROPIC_API_KEY`. Si macOS no lo abre: clic derecho, Abrir (o `chmod +x "Demo Priv8.command"` tras descomprimir el ZIP). Cerrar el Terminal lo para todo.

### 1. Sin claves

```bash
make demo    # o: uv run python -m core.replay [b2b|b2c]
```

El núcleo real con respuestas del modelo grabadas. Al final, el número de peticiones con un valor real: **0**.

| Escena | Qué mirar |
|---|---|
| B2B | `act type e9 ‹IBAN_1-correo›` devuelve `denied: destino`. Registrar y Enviar esperan tu «sí» |
| B2C | `oracle sum` devuelve `‹SUMA_1›`. La transferencia pide confirmación y 8 se pausa en la huella |

### 2. B2B en vivo

<img alt="B2B: llega la factura al correo, Alba Core sin API, y 8 la registra con tokens mientras la persona aprueba en la consola" src="docs/img/uso-b2b.png" width="100%">

```bash
make demo-b2b    # Alba Core :5173, correo :5174, consola :5175 y 8 esperando
```

En http://127.0.0.1:5175, pídele a 8 «registrar factura» y aprueba lo retenido. Por partes: `make web` y `make agent-web` (entonces Alba Core pide `admin.alba` / `Alba-2026!`, y la clave la escribe la persona).

### 3. B2C en el emulador

<img alt="B2C: se lo dices a 8, la cifra suena con la voz local mientras el modelo solo ve ‹SUMA_1›, y la transferencia la confirmas tú" src="docs/img/uso-b2c.png" width="100%">

```bash
scripts/movil.sh             # compila, arranca el AVD, instala y abre los puertos
make agent-android-replay    # grabado, sin clave
make agent-android           # Claude en vivo
```

Detalle del emulador en [`apps/android-8/README.md`](apps/android-8/README.md). La huella, la clave y el código los pone la persona; 8 mira a otro lado.

### 4. Priv8 en tu asistente

<img alt="Priv8 en Claude Code: una línea de instalación, Claude recibe solo tokens y lo irreversible se aprueba en la consola" src="docs/img/uso-claude.png" width="100%">

```bash
curl -fsSL https://mcp.priv8.es/instalar.sh | bash    # sin clonar: paquete en ~/.priv8/mcp
```

El instalador registra Priv8 como servidor MCP local (stdio) en Claude Code, Codex y Gemini CLI si los encuentra, sin tocar un servidor `priv8` que ya exista. Para Grok CLI, Cursor, opencode o cualquier otro asistente MCP, el comando es `~/.priv8/mcp/priv8-mcp mcp`: [mcp.priv8.es](https://mcp.priv8.es/#pasos) tiene la configuración de cada uno.

Desde el código: `make web`, `make mcp-web` y `claude mcp add --transport http priv8 http://127.0.0.1:8701/mcp`. Priv8 protege lo que el agente lee en pantalla, no lo que escribes en el chat del host. Más en [`agent/README.md`](agent/README.md) y [mcp.priv8.es](https://mcp.priv8.es).

### Otras, sin claves

```bash
make llamada-banco                                  # 8 llama a la línea simulada de Banca Alcor
make metrics                                        # métricas B2B y B2C con y sin protocolo
make casos-provisionales                            # los casos de demo.priv8.es, grabados sin emulador ni API
uv run python -m core.verify audit/replay.jsonl     # comprueba el registro firmado
```

## Tests

```bash
make test
```

| Qué comprueba | Cómo |
|---|---|
| Ningún valor real llega al modelo | también con el ERP y el correo reales, si están instalados |
| Las 10 variantes del correo que cambia el IBAN | todas bloqueadas por procedencia |
| El oráculo no deja reconstruir una cifra | presupuesto y tramos |
| La confirmación caduca | a los `expires_s` |
| La auditoría detecta alteraciones | cadena de hashes y firma |
| Contratos, seed, consola, ERP y app 8 | esquemas y tests de cada app |

Cada punto de conformidad, con su test, en [`docs/SPEC.md`](docs/SPEC.md).

## Estructura

| Carpeta | Qué es |
|---|---|
| [`core/`](core/) | Núcleo Priv8 CUA |
| [`agent/`](agent/) | Servidor MCP y bucle del agente |
| [`adapters/`](adapters/) | Web (Playwright) y Android (puente) |
| [`voice/`](voice/) | Voz mixta, llamadas y dictado |
| [`policies/`](policies/) | Qué es rojo, ámbar o verde en cada pantalla |
| [`apps/`](apps/) | App 8, bancos, ERP, correo, consola y las webs |
| [`metrics/`](metrics/), [`data/`](data/) | Métricas y datos inventados de la demo |
| [`docs/`](docs/) | [Especificación](docs/SPEC.md), [contratos](docs/contracts/), [arquitectura](docs/arquitectura.md), marca y entregables |
| [`brand/`](brand/) | Logos, banners (`scripts/banners.py`) y variables de marca |
| `bases/`, `research_notes/`, `reports/` | Bases de la hackathon e investigación previa |

## Equipo

| Persona | Parte |
|---|---|
| Ángel Martín ([@aaangelmartin](https://github.com/aaangelmartin)) | Agente, servidor MCP, Android, voz y diseño |
| Álvaro Carpintero ([@alvaarocl](https://github.com/alvaarocl)) | Empresa: ERP, bandeja, adaptador web, consola y telefonía |
| Pablo Rojo ([@rrojjo](https://github.com/rrojjo)) | Núcleo del protocolo y especificación |
| Marco Barroso ([@marcoobarroso](https://github.com/marcoobarroso)) | App 8, renderizador local, bancos y dictado |

## Licencia

Apache 2.0. Ver [`LICENSE`](LICENSE) y [`NOTICE`](NOTICE).

<img alt="Priv8, by laaabs" src="brand/banner/pie.png" width="100%">
