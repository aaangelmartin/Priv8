import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// data/seed.json vive en la raíz del repo: se permite leer hasta allí.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['../..'] } },
})
