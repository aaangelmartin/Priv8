import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes de la marca servidas en local: la demo funciona sin red.
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '../../../brand/tokens.css'
import App, { SoloVista } from './App.jsx'
import { textureUrl } from './texture.js'
import { SESION } from './useEvents.js'
import { reloj } from './reproductor.js'

document.documentElement.style.setProperty('--c-textura', textureUrl())
import './styles.css'

// ?vista=8: solo lo que ve 8, a pantalla completa (otra pestaña o la pantalla de la demo).
const solo = new URLSearchParams(window.location.search).get('vista') === '8'

// Sesión grabada (?feed=sesion-b2b): Reiniciar vuelve a montar la consola desde cero.
function Raiz() {
  const [n, setN] = useState(reloj.estado.reinicios)
  useEffect(() => reloj.suscribir((e) => { if (e.reinicios !== n) { window.__p8FeedFin = false; setN(e.reinicios) } }), [n])
  return <App key={n} />
}
createRoot(document.getElementById('root')).render(solo ? <SoloVista /> : SESION ? <Raiz /> : <App />)
