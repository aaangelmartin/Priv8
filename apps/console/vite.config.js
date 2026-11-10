import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La marca (brand/tokens.css y brand/logo/) vive en la raíz del repo: se permite servirla.
export default defineConfig({ plugins: [react()], server: { fs: { allow: ['../..'] } } })
