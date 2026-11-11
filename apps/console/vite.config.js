import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La marca (brand/tokens.css y brand/logo/) vive en la raíz del repo: se permite servir solo esa carpeta.
// Abrir '../..' expondría todo el repo (también audit/priv8.key) por /@fs/ a cualquier web.
export default defineConfig({ plugins: [react()], server: { fs: { allow: ['.', '../../brand'] } } })
