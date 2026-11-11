import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Panel de la demo (#169). En la build lo sirve scripts/panel.py en :5170; en desarrollo (pnpm dev, :5171)
   las llamadas a /api van a ese servidor. Los casos preparados se leen de data/casos.json (#187). */
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://127.0.0.1:5170' }, fs: { allow: ['.', '../../data'] } },
});
