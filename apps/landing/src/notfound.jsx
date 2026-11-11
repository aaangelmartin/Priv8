import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Eight from './eight/Eight.jsx';
import Field from './Field.jsx';
import { textureUrl } from './texture.js';
import './styles.css';

/* 404 propia. GitHub Pages la sirve para cualquier ruta que no existe, incluidas las páginas de detalle que aún no
   hemos hecho. 8 busca la página, no la encuentra y te devuelve al inicio. */
document.documentElement.style.setProperty('--texture', textureUrl());
const HOME = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/';

function NotFound() {
  /* 8 busca la página, no la encuentra y se queda triste; al rato vuelve a buscar. Nunca se pone contento. */
  const [mode, setMode] = useState('leer');
  useEffect(() => {
    const seq = [['leer', 1900], ['duda', 1500], ['tristeza', 4800]];
    let i = 0, t = 0;
    const next = () => { const [m, d] = seq[i % seq.length]; i += 1; setMode(m); t = setTimeout(next, d); };
    next();
    return () => clearTimeout(t);
  }, []);
  /* la ruta pedida, como la vería el modelo: un token */
  let path = '/';
  try { path = decodeURIComponent(window.location.pathname.replace(HOME, '/')) || '/'; } catch (e) { /* ruta mal codificada */ }
  return (
    <main className="nf">
      <Field />
      <a className="nf-brand" href={HOME}>Priv8</a>
      <div className="nf-in">
        <div id="hero-anchor" className="nf-eight"><Eight mode={mode} fg="#FFFFFF" cut="#2D45D6" label="8" /></div>
        <p className="eyebrow">Error 404</p>
        <h1>Esta página <span className="soft">todavía no existe.</span></h1>
        <div className="pair nf-pair" aria-label={`La dirección ${path} no existe`}>
          <span className="real">{path.length > 28 ? path.slice(0, 27) + '…' : path}</span><span className="arrow" /><span className="tok">‹PÁGINA_1-no existe›</span>
        </div>
        <p className="nf-sub">8 la ha buscado por todas partes. Mientras la preparamos, en el inicio está todo lo importante.</p>
        <a className="btn btn-white" href={HOME}>Volver al inicio</a>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><NotFound /></StrictMode>);
