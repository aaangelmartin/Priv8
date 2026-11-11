import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* BASE_PATH lo pone el despliegue de GitHub Pages (/Priv8/). En local se queda en relativo para que el dist
   se pueda abrir tal cual, también desde el ZIP. */
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        notfound: resolve(__dirname, '404.html'),
        /* la presentación del jurado, en priv8.es/pitch */
        pitch: resolve(__dirname, 'pitch/index.html'),
      },
    },
  },
});
