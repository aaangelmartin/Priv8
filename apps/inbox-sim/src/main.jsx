import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './correo.css'

// A pantalla completa (la demo en directo) la app crece con la ventana en lugar de quedarse pequeña
// en una esquina. Nunca se encoge: por debajo de 1280x800 se ve como siempre.
function escala() {
  const z = Math.min(window.innerWidth / 1280, window.innerHeight / 800, 1.8)
  document.documentElement.style.zoom = z > 1.05 ? z.toFixed(3) : ''
}
escala()
window.addEventListener('resize', escala)

createRoot(document.getElementById('root')).render(<App />)
