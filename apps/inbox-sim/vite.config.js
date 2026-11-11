import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// data/seed.json vive en la raíz del repo: se permite leer hasta allí.
export default defineConfig({
  plugins: [react()],
  // BASE_PATH=/erp/ o /correo/ compila la copia de demo.priv8.es; sin él, en la raíz como siempre.
  base: process.env.BASE_PATH || '/',
  server: { fs: { allow: ['../..'] } },
})
