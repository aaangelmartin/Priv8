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
import App from './App.jsx'
import { textureUrl } from './texture.js'

document.documentElement.style.setProperty('--c-textura', textureUrl())
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
