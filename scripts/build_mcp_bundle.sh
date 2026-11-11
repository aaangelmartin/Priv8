#!/usr/bin/env bash
# Construye el paquete priv8-mcp (#157): Priv8 CUA como servidor MCP de Claude Code sobre las
# apps de la demo, listo para descargar desde mcp.priv8.es.
#
#   scripts/build_mcp_bundle.sh        → dist/priv8-mcp-<versión>.tar.gz y su .sha256
#
# Lleva solo lo que hace falta para `python -m agent.server --web`: core/, agent/, adapters/web/,
# voice/ (la llamada de verificación simulada), policies/, data/ (seed inventado), pyproject.toml
# y uv.lock, y las builds estáticas de apps/erp-sim, apps/inbox-sim y apps/console (sin Node).
# Solo entran archivos que sigue git, sin tests: nunca .env, audit/, .priv8/, node_modules,
# investigación ni vídeos. Al final se comprueba otra vez y falla si se cuela algo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' pyproject.toml | head -1)"
SHA="$(git rev-parse --short HEAD)"
DIRTY="$(git status --porcelain -- core agent adapters/web voice policies data apps/erp-sim apps/inbox-sim apps/console scripts/mcp_bundle pyproject.toml uv.lock | head -1)"
OUT="$ROOT/dist"
STAGE="$OUT/stage/priv8-mcp"
NAME="priv8-mcp-$VERSION.tar.gz"
say() { printf 'priv8: %s\n' "$*" >&2; }

rm -rf "$OUT/stage"
mkdir -p "$STAGE/apps"

# 1. Las tres apps, construidas. Alba Core lleva la sesión de la demo ya abierta, como en make demo-b2b.
for app in erp-sim inbox-sim console; do
  dir="apps/$app"
  [ -d "$dir/node_modules" ] || (cd "$dir" && pnpm install --frozen-lockfile)
  say "build de $dir"
  if [ "$app" = erp-sim ]; then
    (cd "$dir" && VITE_ALBA_SESION=admin.alba VITE_ALBA_SESION_BUILD=1 pnpm exec vite build --logLevel warn --outDir "$STAGE/apps/$app" --emptyOutDir)
  else
    (cd "$dir" && pnpm exec vite build --logLevel warn --outDir "$STAGE/apps/$app" --emptyOutDir)
  fi
done
# Los vídeos y grabaciones de la consola (?feed=, ?demo) no hacen falta en el paquete.
rm -f "$STAGE/apps/console/"{sin-protocolo,con-protocolo,demo}.json

# 2. El código Python: lo que sigue git, sin tests ni grabaciones.
git ls-files -z -- core agent adapters/web voice policies data pyproject.toml uv.lock LICENSE apps/console/src/eight/engine.js \
  | tr '\0' '\n' \
  | grep -vE '(^|/)tests/|(^|/)replays/|^voice/android/|^data/test_|\.md$|(^|/)\.env' \
  | while IFS= read -r f; do
      mkdir -p "$STAGE/$(dirname "$f")"
      cp -p "$f" "$STAGE/$f"
    done

# 3. El lanzador, su README y la versión.
cp scripts/mcp_bundle/priv8-mcp "$STAGE/priv8-mcp"
chmod 755 "$STAGE/priv8-mcp"
cp scripts/mcp_bundle/README.md "$STAGE/README.md"
echo "$VERSION ($SHA${DIRTY:+, con cambios sin commit})" > "$STAGE/VERSION"

# 4. Nada privado ni pesado dentro.
bad="$(cd "$OUT/stage" && find . \( -name '.env*' -o -name '*.key' -o -name '*.pem' -o -name '.priv8' -o -name audit \
  -o -name node_modules -o -name research_notes -o -name reports -o -name '*.mp4' -o -name '*.mov' -o -name '*.webm' \
  -o -name '*.jsonl' -o -name '__pycache__' -o -name '.DS_Store' \) -print)"
if [ -n "$bad" ]; then
  say "el paquete lleva algo que no debe:"; echo "$bad" >&2; exit 1
fi

# 5. El tar (sin metadatos de macOS) y su suma.
rm -f "$OUT/$NAME" "$OUT/$NAME.sha256"
(cd "$OUT/stage" && COPYFILE_DISABLE=1 tar -czf "$OUT/$NAME" priv8-mcp)
if command -v shasum >/dev/null 2>&1; then sum="$(shasum -a 256 "$OUT/$NAME" | cut -d' ' -f1)"
else sum="$(sha256sum "$OUT/$NAME" | cut -d' ' -f1)"; fi
echo "$sum  priv8-mcp.tar.gz" > "$OUT/$NAME.sha256"
rm -rf "$OUT/stage"

say "$OUT/$NAME ($(du -h "$OUT/$NAME" | cut -f1 | tr -d ' '), $(tar -tzf "$OUT/$NAME" | wc -l | tr -d ' ') entradas)"
say "SHA-256 $sum"
[ -z "$DIRTY" ] || say "aviso: hay cambios sin commit en lo que entra en el paquete"
