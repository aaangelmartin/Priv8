import { useEffect, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { useCompanion } from './companion.js';

const LINKS = [
  ['demo', 'Pruébalo'],
  ['protocolo', 'Protocolo'],
  ['producto', 'Productos'],
  ['confianza', 'Confianza'],
];
const NAMES = { inicio: 'Priv8', demo: 'Pruébalo', problema: 'El problema', protocolo: 'Protocolo', producto: 'Productos', quien: 'Para quién', confianza: 'Confianza', contacto: 'Pide una demo' };

function ThemeIcon({ dark }) {
  return dark ? (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="currentColor" /></svg>
  );
}

/* Barra superior: un notch ancho pegado arriba, como el de un portátil. 8 vive dentro y te sigue con la mirada. */
export default function Nav({ dark, onTheme, pal }) {
  const { section } = useCompanion();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8, inicio">
        <Eight className="nav-eight" mode="mirar" fg="#FFFFFF" cut={pal.ink} label="8" />
        <span className="word">Priv8</span>
      </a>
      <span className="now" aria-hidden="true">{NAMES[section] || 'Priv8'}</span>
      <ul className="links">
        {LINKS.map(([id, label]) => (
          <li key={id}><a href={`#${id}`} aria-current={section === id ? 'true' : undefined}>{label}</a></li>
        ))}
      </ul>
      <div className="tools">
        <button type="button" className="icon" onClick={onTheme} aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}><ThemeIcon dark={dark} /></button>
        <a className="pill" href="#contacto">Pide una demo</a>
      </div>
    </nav>
  );
}
