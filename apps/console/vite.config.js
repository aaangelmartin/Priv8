import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La marca (brand/tokens.css y brand/logo/) vive en la raíz del repo: se permite servir solo esa carpeta.
// Abrir '../..' expondría todo el repo (también audit/priv8.key) por /@fs/ a cualquier web.
// BASE_PATH=/consola/ compila la consola para servirla bajo una ruta (demo.priv8.es/consola/). Sin él, en la raíz.
export default defineConfig({ plugins: [react()], base: process.env.BASE_PATH || '/', server: { fs: { allow: ['.', '../../brand'] } } })
