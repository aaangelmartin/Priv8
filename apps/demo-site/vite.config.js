import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { appDe } from './functions/_middleware.js';

/* En `vite preview`, las rutas profundas de las apps alojadas (/correo/bandeja, /erp/facturas) se sirven con el
   index.html de su app, como hace el middleware en Cloudflare Pages. */
const rutasDeApps = {
  name: 'priv8-rutas-de-apps',
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const app = appDe((req.url || '/').split('?')[0]);
      if (app) req.url = `/${app}/index.html`;
      next();
    });
  },
};

/* demo.priv8.es: la misma marca que la web. El motor de 8, el campo de datos, la firma y los estilos se importan de
   apps/landing (@landing) para que haya una sola copia; react se resuelve siempre desde aquí (dedupe), así la
   build no depende de que apps/landing tenga sus node_modules. Solo se abre esa carpeta al servidor de desarrollo. */
export default defineConfig({
  plugins: [react(), rutasDeApps],
  base: '/',
  resolve: {
    alias: { '@landing': fileURLToPath(new URL('../landing/src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: ['.', '../landing/src'] } },
});
