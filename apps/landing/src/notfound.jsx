import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Eight from './eight/Eight.jsx';
import './styles.css';

/* 404 propia. GitHub Pages la sirve para cualquier ruta que no existe, incluidas las páginas de detalle que aún no
   hemos hecho. 8 busca la página, no la encuentra y te devuelve al inicio. */
const HOME = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/';

function NotFound() {
  const [mode, setMode] = useState('curiosidad');
  useEffect(() => {
    const seq = [['curiosidad', 1400], ['pensar', 1600], ['disculpa', 0]];
    let i = 0, t = 0;
    const next = () => { const [m, d] = seq[i++]; setMode(m); if (d) t = setTimeout(next, d); };
    next();
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="nf">
      <a className="nf-brand" href={HOME}>Priv8</a>
      <div className="nf-eight"><Eight mode={mode} fg="#FFFFFF" cut="#2D45D6" label="8" /></div>
      <p className="eyebrow">Error 404</p>
      <h1>Esta página <span className="soft">todavía no existe.</span></h1>
      <p className="nf-sub">La estamos preparando. Mientras, en el inicio está todo lo importante.</p>
      <a className="btn btn-white" href={HOME}>Volver al inicio</a>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><NotFound /></StrictMode>);
