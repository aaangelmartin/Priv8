import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { mood, setSection, useCompanion } from './companion.js';

/* Cara y lado de la pantalla en cada sección. */
const SECTIONS = {
  inicio: { mode: 'mirar', side: 'right' },
  demo: { mode: 'leer', side: 'right' },
  problema: { mode: 'curiosidad', side: 'left' },
  protocolo: { mode: 'pensar', side: 'right' },
  producto: { mode: 'hablar', side: 'left' },
  quien: { mode: 'alegria', side: 'right' },
  confianza: { mode: 'agradecer', side: 'left' },
  contacto: { mode: 'mirar', side: 'right' },
};

const BASE = 360; // tamaño de dibujo; se escala con transform
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);

/* El 8 que vive en la portada y, al bajar, sale de ella y te acompaña por la web. */
export default function Companion({ band, intro }) {
  const { section, override } = useCompanion();
  const [greet, setGreet] = useState(true);
  const box = useRef(null);
  const docked = useRef(null);
  const phase = useRef(intro ? 'intro' : 'live');

  useEffect(() => { const t = setTimeout(() => setGreet(false), 2400); return () => clearTimeout(t); }, []);

  /* sección visible */
  useEffect(() => {
    const els = Object.keys(SECTIONS).map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setSection(e.target.id); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* posición: sobre el ancla de la portada y, al bajar, hacia su sitio en el lateral */
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = 0;
      const el = box.current; const anchor = document.getElementById('hero-anchor');
      if (!el || !anchor) return;
      const vw = window.innerWidth, vh = window.innerHeight, a = anchor.getBoundingClientRect();
      if (phase.current === 'intro') {
        const S = Math.min(vw * 0.5, vh * 0.5, 440);
        el.style.transition = 'none';
        el.style.transform = `translate3d(${(vw - S) / 2}px, ${(vh - S) / 2}px, 0) scale(${S / BASE})`;
        el.style.setProperty('--disc', '0');
        return;
      }
      if (phase.current === 'flying') {
        el.style.transition = 'transform 1.15s cubic-bezier(.65, 0, .15, 1)';
        el.style.transform = `translate3d(${a.left}px, ${a.top}px, 0) scale(${a.width / BASE})`;
        return;
      }
      const small = vw < 1320;
      const D = small ? 58 : 92, m = small ? 16 : 28;
      const side = (SECTIONS[document.body.dataset.section] || SECTIONS.inicio).side;
      const dx = small || side === 'right' ? vw - D - m : m;
      const dy = small ? vh - D - m : vh * 0.56 - D / 2;
      const p = clamp((90 - a.top) / (a.height * 0.85), 0, 1);
      const k = ease(p);
      const size = a.width + (D - a.width) * k;
      const x = a.left + (dx - a.left) * k, y = a.top + (dy - a.top) * k;
      const isDocked = p >= 1;
      el.style.transition = isDocked && docked.current ? 'transform .9s cubic-bezier(.2,.8,.2,1)' : 'none';
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${size / BASE})`;
      el.classList.toggle('docked', isDocked);
      el.style.setProperty('--disc', String(clamp((p - 0.55) / 0.45, 0, 1)));
      docked.current = isDocked;
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
    ask();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    const mo = new MutationObserver(ask);
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-section'] });
    return () => { window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { document.body.dataset.section = section; }, [section]);

  /* al terminar la bienvenida, 8 vuela del centro a su sitio en la portada */
  useEffect(() => {
    if (intro || phase.current !== 'intro') return undefined;
    phase.current = 'flying';
    window.dispatchEvent(new Event('scroll'));
    const t = setTimeout(() => { phase.current = 'live'; window.dispatchEvent(new Event('scroll')); }, 1200);
    return () => clearTimeout(t);
  }, [intro]);

  const mode = override || (greet && section === 'inicio' ? 'saludar' : (SECTIONS[section] || SECTIONS.inicio).mode);
  return (
    <button type="button" ref={box} className="companion" style={{ width: BASE, height: BASE }}
      onClick={() => mood('risa', 1600)} aria-label="8, el agente de Priv8. Haz clic: tiene cosquillas.">
      <span className="disc" aria-hidden="true" />
      <Eight className="companion-eight" mode={mode} fg="#FFFFFF" cut={band} label="8" />
    </button>
  );
}
