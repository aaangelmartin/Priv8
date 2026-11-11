# Priv8 para Claude Code

Priv8 CUA como servidor MCP de tu Claude Code. Claude Code maneja dos pantallas de prueba (Alba Core, un ERP antiguo, y una bandeja de correo) a través de Priv8: el modelo solo recibe tokens como `‹IBAN_1-maestro›` en lugar de los datos, el valor real lo escribe un ejecutor local, y lo irreversible (registrar, enviar) espera a que lo apruebes en la consola de Priv8. No hace falta ninguna clave de API: el modelo es el de tu Claude Code.

Más información en https://mcp.priv8.es y https://priv8.es.

## Requisitos

- macOS o Linux.
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh` o `brew install uv`).
- [Claude Code](https://docs.claude.com/claude-code).

## Uso

```bash
curl -fsSL https://mcp.priv8.es/instalar.sh | bash   # todo: descarga, dependencias, Chromium y registro en Claude Code
claude
```

Y en Claude Code: «Registra en Alba Core la factura que ha llegado por correo de Suministros Lumen».

Claude Code arranca Priv8 al abrir la sesión: sirve las tres apps en `127.0.0.1:5173`, `:5174` y `:5175` (si no están ya en marcha), abre Chromium con el cursor de 8 y abre la consola en tu navegador. Allí ves lo que recibe el modelo y apruebas lo retenido.

| Orden | Qué hace |
|---|---|
| `priv8-mcp instalar` | `uv sync` en `.venv/` y Chromium de Playwright en `navegadores/` |
| `priv8-mcp mcp` | El servidor MCP por stdio (lo arranca Claude Code) |
| `priv8-mcp demo` | Solo las tres apps, sin servidor MCP, para mirarlas |
| `priv8-mcp comando` | La línea de `claude mcp add` para esta copia |

Puertos: `PRIV8_ALBA_PORT`, `PRIV8_INBOX_PORT`, `PRIV8_CONSOLE_PORT` y `PRIV8_EVENTS_PORT` (5173, 5174, 5175 y 8700). Por ejemplo: `claude mcp add --scope user priv8 -e PRIV8_EVENTS_PORT=8790 -- ~/.priv8/mcp/priv8-mcp mcp`. `PRIV8_ABRIR_CONSOLA=0` no abre la consola.

## Qué protege y qué no

Priv8 protege lo que el agente lee en la pantalla y lo que escribe en ella. Lo que tú escribes en el chat de Claude Code llega a tu modelo tal cual: no pegues ahí datos reales.

## Qué hay en esta carpeta

- `agent/`, `core/`, `adapters/web/`, `voice/`, `policies/`, `data/`: el núcleo de Priv8 CUA, el servidor MCP y el adaptador web. Los datos de `data/seed.json` son inventados.
- `apps/`: las tres apps ya construidas (no hace falta Node).
- Al usarlo se crean `.venv/`, `navegadores/`, `.priv8/` (perfil de Chromium) y `audit/` (registro firmado y su clave, solo en tu ordenador).

Para quitarlo: `claude mcp remove priv8 --scope user` y `rm -rf ~/.priv8/mcp`.
