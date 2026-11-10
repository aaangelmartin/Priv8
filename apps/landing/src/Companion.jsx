import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { mood, setSection, useCompanion } from './companion.js';

/* Cara y lado de la pantalla en cada sección. */
const SECTIONS = {
  inicio: { mode: 'mirar', side: 'right' },
  problema: { mode: 'curiosidad', side: 'right' },
  coste: { mode: 'pensar', side: 'left' },
  como: { mode: 'leer', side: 'right' },
  demo: { mode: 'leer', side: 'right' },
  producto: { mode: 'hablar', side: 'left' },
  confianza: { mode: 'agradecer', side: 'right' },
  faq: { mode: 'duda', side: 'left' },
  contacto: { mode: 'alegria', side: 'right' },
};

const BASE = 360; // tamaño de dibujo; se escala con transform
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const COBALT = '#2D45D6';

/* Lee el color de fondo real que hay detrás de un punto, ignorando al propio 8. */
function backgroundAt(x, y, self) {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    if (self.contains(el)) continue;
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const m = c && c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(',').map((v) => parseFloat(v));
        if (p.length < 4 || p[3] > 0.6) return p;
      }
      n = n.parentElement;
    }
  }
  return [255, 255, 255];
}
const isDark = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;

/* El 8 que vive en la portada y, al bajar, sale de ella y te acompaña por la web.
   Cambia de color solo según lo que tiene detrás: blanco sobre oscuro, cobalto sobre claro. */
export default function Companion({ pal, intro }) {
  const { section, override } = useCompanion();
  const [greet, setGreet] = useState(true);
  const [dark, setDark] = useState(true);
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

  /* posición y color */
  useEffect(() => {
    let raf = 0, last = 0;
    const frame = () => {
      raf = 0;
      const el = box.current; const anchor = document.getElementById('hero-anchor');
      if (!el || !anchor) return;
      const vw = window.innerWidth, vh = window.innerHeight, a = anchor.getBoundingClientRect();
      if (phase.current === 'intro') {
        const S = Math.min(vw * 0.92, vh * 1.25, 1150);
        el.style.transition = 'none';
        el.style.transform = `translate3d(${(vw - S) / 2}px, ${(vh - S) / 2}px, 0) scale(${S / BASE})`;
        return;
      }
      if (phase.current === 'flying') {
        el.style.transition = 'transform 1.15s cubic-bezier(.65, 0, .15, 1)';
        el.style.transform = `translate3d(${a.left}px, ${a.top}px, 0) scale(${a.width / BASE})`;
        return;
      }
      /* va en el margen lateral, sin tapar el contenido; si no cabe, abajo a la derecha */
      const gutter = Math.max(0, (vw - 1240) / 2) + Math.min(56, Math.max(20, vw * 0.04));
      const small = gutter < 120;
      const D = small ? 86 : Math.min(150, gutter - 16), m = small ? 10 : (gutter - D) / 2;
      const side = (SECTIONS[document.body.dataset.section] || SECTIONS.inicio).side;
      const dx = small || side === 'right' ? vw - D - m : m;
      const dy = small ? vh - D * 0.62 - m : vh * 0.56 - D / 2;
      const p = clamp((90 - a.top) / (a.height * 0.85), 0, 1);
      const k = ease(p);
      const size = a.width + (D - a.width) * k;
      const x = a.left + (dx - a.left) * k, y = a.top + (dy - a.top) * k;
      const isDocked = p >= 1;
      el.style.transition = isDocked && docked.current ? 'transform 1s cubic-bezier(.2,.8,.2,1)' : 'none';
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${size / BASE})`;
      docked.current = isDocked;
      /* el color sale del fondo real que hay detrás de su centro */
      const now = performance.now();
      if (now - last > 120) {
        last = now;
        const r = el.getBoundingClientRect();
        const cx = clamp(r.left + r.width / 2, 1, vw - 1), cy = clamp(r.top + r.height / 2, 1, vh - 1);
        setDark(isDark(backgroundAt(cx, cy, el)));
      }
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
    ask();
    const tick = setInterval(ask, 250); // vuelve a mirar el fondo mientras se desplaza de lado
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    const mo = new MutationObserver(ask);
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-section'] });
    return () => { clearInterval(tick); window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); mo.disconnect(); cancelAnimationFrame(raf); };
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

  const band = pal.band || COBALT;
  const col = dark ? { fg: '#FFFFFF', cut: band } : { fg: band, cut: '#FFFFFF' };
  const mode = override || (greet && section === 'inicio' ? 'saludar' : (SECTIONS[section] || SECTIONS.inicio).mode);
  return (
    <button type="button" ref={box} className="companion" style={{ width: BASE, height: BASE }}
      onClick={() => mood('risa', 1600)} aria-label="8, el agente de Priv8. Haz clic: tiene cosquillas.">
      <Eight className="companion-eight" mode={mode} fg={col.fg} cut={col.cut} label="8" />
    </button>
  );
}
