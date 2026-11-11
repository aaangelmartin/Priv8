import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* demo.priv8.es: la misma marca que la web. El motor de 8, el campo de datos y los estilos se importan de
   apps/landing (@landing) para que haya una sola copia; react se resuelve siempre desde aquí (dedupe), así la
   build no depende de que apps/landing tenga sus node_modules. Solo se abre esa carpeta al servidor de desarrollo. */
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: { '@landing': fileURLToPath(new URL('../landing/src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: ['.', '../landing/src'] } },
});
