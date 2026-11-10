import { useEffect, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { useCompanion } from './companion.js';

const LINKS = [
  ['problema', 'Qué ve'],
  ['cifras', 'Por qué ahora'],
  ['como', 'Cómo funciona'],
  ['producto', 'Productos'],
  ['comparar', 'Comparativa'],
  ['faq', 'Preguntas'],
];
const NAMES = { inicio: 'Priv8', demo: 'Demostración', problema: 'El problema', protocolo: 'Protocolo', producto: 'Productos', quien: 'Para quién', confianza: 'Confianza', contacto: 'Pide una demo' };

/* Barra suelta y blanca, con el radio del notch. 8 vive dentro y te sigue con la mirada. */
export default function Nav() {
  const { section } = useCompanion();
  const [scrolled, setScrolled] = useState(false);
  const [tone, setTone] = useState('cobalt');
  useEffect(() => {
    const mo = new MutationObserver(() => setTone(document.body.dataset.tone || 'cobalt'));
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-tone'] });
    return () => mo.disconnect();
  }, []);
  const onLight = tone === 'dark';
  /* sobre blanco la barra se vuelve cobalto, para no fundirse con el fondo */
  const [onWhite, setOnWhite] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const nav = document.querySelector('.nav'); if (!nav) return;
      if (window.visualViewport && window.visualViewport.scale > 1.01) return;
      const r = nav.getBoundingClientRect();
      const y = r.top + r.height / 2;
      let light = false;
      for (const el of document.elementsFromPoint(document.documentElement.clientWidth / 2, y)) {
        if (nav.contains(el) || el.closest('.companion, .bubble8')) continue;
        let n = el, c = null;
        while (n && n !== document.documentElement) {
          const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
          if (m) { const p = m[1].split(',').map(parseFloat); if (p.length < 4 || p[3] > 0.6) { c = p; break; } }
          n = n.parentElement;
        }
        if (c) { light = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 > 0.6; break; }
      }
      setOnWhite(light);
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(check); };
    ask(); window.addEventListener('scroll', ask, { passive: true }); window.addEventListener('resize', ask);
    const t = setInterval(ask, 400);
    return () => { clearInterval(t); window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}${onWhite ? ' on-white' : ''}`} aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8, inicio">
        <Eight className="nav-eight" mode="mirar" fg={onWhite ? '#FFFFFF' : '#2D45D6'} cut={onWhite ? '#2D45D6' : '#FFFFFF'} label="8" />
        <span className="word">Priv8</span>
      </a>
      <span className="now" aria-hidden="true">{NAMES[section] || 'Priv8'}</span>
      <ul className="links">
        {LINKS.map(([id, label]) => (
          <li key={id}><a href={`#${id}`} aria-current={section === id ? 'true' : undefined}>{label}</a></li>
        ))}
      </ul>
      <div className="tools">
        <a className="pill" href="#contacto">Pide una demo</a>
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((o) => !o)}>
          <span /><span />
        </button>
      </div>
      {/* móvil: el menú se despliega bajo la barra con todas las secciones */}
      <div id="nav-menu" className={'nav-menu' + (open ? ' open' : '')} hidden={!open}>
        {LINKS.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)} aria-current={section === id ? 'true' : undefined}>{label}</a>)}
        <a className="nav-menu-cta" href="#contacto" onClick={() => setOpen(false)}>Pide una demo</a>
      </div>
    </nav>
  );
}
