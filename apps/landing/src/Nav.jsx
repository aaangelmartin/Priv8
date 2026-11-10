import { useEffect, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { useCompanion } from './companion.js';

const LINKS = [
  ['problema', 'Qué ve'],
  ['como', 'Cómo funciona'],
  ['producto', 'Productos'],
  ['demo', 'Pruébalo'],
  ['faq', 'Preguntas'],
];
const NAMES = { inicio: 'Priv8', demo: 'Pruébalo', problema: 'El problema', protocolo: 'Protocolo', producto: 'Productos', quien: 'Para quién', confianza: 'Confianza', contacto: 'Pide una demo' };

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
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8, inicio">
        <Eight className="nav-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
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
      </div>
    </nav>
  );
}
