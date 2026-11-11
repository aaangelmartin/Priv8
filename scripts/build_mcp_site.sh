#!/usr/bin/env bash
# Construye mcp.priv8.es (#157): el paquete priv8-mcp y el sitio apps/mcp-site, listos para subir.
#
#   scripts/build_mcp_site.sh      → apps/mcp-site/dist/ con index.html, instalar.sh,
#                                    priv8-mcp.tar.gz, priv8-mcp.tar.gz.sha256 y _headers
#
# Despliegue (no lo hace este script): docs/despliegue-subdominios.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SITE="apps/mcp-site"
say() { printf 'priv8: %s\n' "$*" >&2; }

scripts/build_mcp_bundle.sh
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' pyproject.toml | head -1)"

[ -d "$SITE/node_modules" ] || (cd "$SITE" && pnpm install --frozen-lockfile)
(cd "$SITE" && pnpm exec vite build --logLevel warn)

OUT="$SITE/dist"
cp scripts/mcp_bundle/instalar.sh "$OUT/instalar.sh"
cp "dist/priv8-mcp-$VERSION.tar.gz" "$OUT/priv8-mcp.tar.gz"
cp "dist/priv8-mcp-$VERSION.tar.gz.sha256" "$OUT/priv8-mcp.tar.gz.sha256"
# Cabeceras de Cloudflare Pages: el instalador se lee como texto y nada de lo descargable se queda en caché vieja.
cat > "$OUT/_headers" <<'EOF'
/instalar.sh
  Content-Type: text/plain; charset=utf-8
  Cache-Control: no-cache
/priv8-mcp.tar.gz
  Content-Type: application/gzip
  Cache-Control: no-cache
/priv8-mcp.tar.gz.sha256
  Content-Type: text/plain; charset=utf-8
  Cache-Control: no-cache
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
EOF

say "sitio listo en $ROOT/$OUT ($(du -sh "$OUT" | cut -f1 | tr -d ' '))"
say "probar en local: (cd $SITE && pnpm preview), y en otra terminal:"
say "  curl -fsSL http://127.0.0.1:5301/instalar.sh | PRIV8_MCP_URL=http://127.0.0.1:5301 PRIV8_MCP_DIR=/tmp/priv8-prueba bash"
