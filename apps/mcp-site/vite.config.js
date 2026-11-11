import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* mcp.priv8.es (#157). En la build, scripts/build_mcp_site.sh copia al lado instalar.sh y el paquete
   priv8-mcp.tar.gz con su suma. En desarrollo este plugin los sirve desde el repositorio (el instalador de
   scripts/mcp_bundle y el último paquete de dist/), así se puede probar la instalación contra el servidor local:
   curl -fsSL http://127.0.0.1:5301/instalar.sh | PRIV8_MCP_URL=http://127.0.0.1:5301 bash */
const REPO = resolve(__dirname, '../..');
function latestBundle() {
  const dir = resolve(REPO, 'dist');
  if (!existsSync(dir)) return null;
  const all = readdirSync(dir).filter((f) => /^priv8-mcp-.+\.tar\.gz$/.test(f)).map((f) => resolve(dir, f));
  all.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return all[0] || null;
}
function paquete() {
  return {
    name: 'priv8-paquete',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        let file = null;
        let type = 'text/plain; charset=utf-8';
        if (url === '/instalar.sh') file = resolve(REPO, 'scripts/mcp_bundle/instalar.sh');
        else if (url === '/priv8-mcp.tar.gz') { file = latestBundle(); type = 'application/gzip'; }
        else if (url === '/priv8-mcp.tar.gz.sha256') { const b = latestBundle(); file = b && `${b}.sha256`; }
        else return next();
        if (!file || !existsSync(file)) { res.statusCode = 404; return res.end('falta el paquete: scripts/build_mcp_bundle.sh\n'); }
        res.setHeader('Content-Type', type);
        res.setHeader('Cache-Control', 'no-store');
        return res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), paquete()],
  base: './',
});
