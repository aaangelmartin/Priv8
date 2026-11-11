# Despliegue de subdominios: mcp.priv8.es

GitHub Pages ya sirve `priv8.es` desde este repositorio (`.github/workflows/landing-pages.yml`), y GitHub Pages solo admite un dominio propio por repositorio. Por eso `mcp.priv8.es` va en **Cloudflare Pages**, donde ya está el DNS de `priv8.es`. Nada de esto está desplegado: cada paso lo autoriza y lo ejecuta una persona del equipo.

## Qué se publica

`scripts/build_mcp_site.sh` deja en `apps/mcp-site/dist/`:

| Archivo | Qué es |
|---|---|
| `index.html`, `assets/`, `favicon.svg` | El sitio (Vite + React) |
| `instalar.sh` | El instalador de una línea (`scripts/mcp_bundle/instalar.sh`) |
| `priv8-mcp.tar.gz` y `.sha256` | El paquete de `scripts/build_mcp_bundle.sh` y su suma, que el instalador comprueba |
| `_headers` | Cabeceras de Cloudflare Pages: tipos y sin caché para lo descargable |

## Antes de publicar: el repositorio es privado

El paquete lleva el código Python de Priv8 CUA (`core/`, `agent/`, `adapters/web/`, `voice/`, `policies/`) y las tres apps construidas. Publicarlo en un sitio abierto **hace público ese código**, aunque el repositorio siga siendo privado, y el sitio enlaza a `github.com/aaangelmartin/Priv8`, que dará 404 a quien no tenga acceso. Decidir antes una de estas:

1. Hacer público el repositorio para la entrega (las bases piden un repositorio público o compartido).
2. Mantenerlo privado y aceptar que el código va dentro del paquete. Quitar o cambiar el enlace al repositorio.
3. Proteger `mcp.priv8.es` con Cloudflare Access (correo del jurado). Entonces `curl` necesita un token de servicio: el instalador de una línea deja de valer tal cual.

El repositorio tiene licencia Apache 2.0 (`LICENSE`), y el paquete la lleva dentro.

## Opción A (recomendada): subida directa con Wrangler

No necesita que Cloudflare lea el repositorio privado. Se publica lo que se ha construido en local y revisado.

```bash
scripts/build_mcp_site.sh                       # paquete + sitio en apps/mcp-site/dist
npx wrangler@3 login                            # una vez, con la cuenta de Cloudflare de priv8.es
npx wrangler@3 pages project create priv8-mcp --production-branch main    # una vez
npx wrangler@3 pages deploy apps/mcp-site/dist --project-name priv8-mcp --branch main
```

`wrangler pages deploy` imprime una URL `https://<hash>.priv8-mcp.pages.dev` para probar antes del dominio.

## Opción B: Cloudflare Pages conectado a GitHub

En el panel de Cloudflare: Workers y Pages, Crear, Pages, Conectar a Git, el repositorio `aaangelmartin/Priv8` (hay que dar acceso a la app de Cloudflare a este repositorio privado).

| Campo | Valor |
|---|---|
| Nombre del proyecto | `priv8-mcp` |
| Rama de producción | `main` |
| Preset | Ninguno |
| Comando de build | `npm i -g pnpm@9 && scripts/build_mcp_site.sh` |
| Directorio de salida | `apps/mcp-site/dist` |
| Variables de entorno | `NODE_VERSION=20` |
| Rutas incluidas (Build watch paths) | `apps/mcp-site/*`, `apps/erp-sim/*`, `apps/inbox-sim/*`, `apps/console/*`, `core/*`, `agent/*`, `adapters/web/*`, `voice/*`, `policies/*`, `data/*`, `scripts/*`, `pyproject.toml`, `uv.lock` |

El build necesita `git` (lo tiene) y `pnpm`; no necesita Python ni uv. Cada push a `main` que toque esas rutas vuelve a publicar.

## Dominio propio

En el proyecto `priv8-mcp`: Dominios personalizados, Configurar un dominio, `mcp.priv8.es`. Como la zona `priv8.es` está en la misma cuenta de Cloudflare, crea solo el registro:

```
mcp   CNAME   priv8-mcp.pages.dev   (con proxy)
```

No toca los registros de `priv8.es` y `www` que apuntan a GitHub Pages. El certificado tarda unos minutos.

## Comprobar después de publicar

```bash
curl -sI https://mcp.priv8.es/instalar.sh | grep -i content-type        # text/plain
curl -fsSL https://mcp.priv8.es/priv8-mcp.tar.gz.sha256
curl -fsSL https://mcp.priv8.es/priv8-mcp.tar.gz | shasum -a 256         # la misma suma
curl -fsSL https://mcp.priv8.es/instalar.sh | PRIV8_MCP_DIR=/tmp/priv8-prueba bash
```

## Otros subdominios

El mismo patrón vale para cualquier otro subdominio de `priv8.es`: un proyecto de Cloudflare Pages por sitio y un CNAME con proxy por subdominio. `priv8.es` se queda en GitHub Pages.
