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

/* Lo que dice 8 al llegar a cada sección. Primera persona, frases cortas. */
const LINES = {
  inicio: 'Hola. Soy 8.',
  problema: 'Sin Priv8 lo vería todo. Prefiero no mirar.',
  coste: 'Yo pago al IBAN de siempre. El del correo, no.',
  como: 'Tres herramientas. No necesito más.',
  demo: 'Quítame la protección y verás qué pasa.',
  producto: 'En tu oficina o en tu móvil, trabajo igual.',
  confianza: 'Si llamo a alguien, digo que soy una IA.',
  faq: 'Pregunta. No me ofendo.',
  contacto: '¿Me enseñas tu proceso?',
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
  const [stage, setStage] = useState(intro ? 'sleep' : 'done');
  const [bubble, setBubble] = useState({ text: '', show: false, side: 'right', x: 0, y: 0 });
  const bubbleT = useRef(0);
  const pos = useRef({ x: 0, y: 0, size: 0, side: 'right', small: false, docked: false });
  const [bg, setBg] = useState(null);
  const box = useRef(null);
  const docked = useRef(null);
  const phase = useRef(intro ? 'intro' : 'live');

  /* arranque: 8 duerme, despierta, saluda */
  useEffect(() => {
    if (stage !== 'sleep') return undefined;
    const a = setTimeout(() => setStage('wake'), 900);
    const b = setTimeout(() => setStage('done'), 3600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

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
        /* dormido en el centro, algo más pequeño; al despertar crece hasta su sitio */
        const S = a.width * 0.62;
        el.style.transition = 'none';
        el.style.transform = `translate3d(${a.left + (a.width - S) / 2}px, ${a.top + (a.height - S) / 2 + 30}px, 0) scale(${S / BASE})`;
        return;
      }
      if (phase.current === 'flying') {
        el.style.transition = 'transform 1.1s cubic-bezier(.34, 1.56, .64, 1)';
        el.style.transform = `translate3d(${a.left}px, ${a.top}px, 0) scale(${a.width / BASE})`;
        return;
      }
      /* va en el margen lateral, sin tapar el contenido; si no cabe, abajo a la derecha */
      const gutter = Math.max(0, (vw - 1240) / 2) + Math.min(56, Math.max(20, vw * 0.04));
      const small = gutter < 140;
      const D = small ? 104 : Math.min(200, gutter - 12), m = small ? 10 : (gutter - D) / 2;
      const side = (SECTIONS[document.body.dataset.section] || SECTIONS.inicio).side;
      const dx = small || side === 'right' ? vw - D - m : m;
      const dy = small ? vh - D * 0.62 - m : vh * 0.56 - D / 2;
      const hero = document.getElementById('inicio');
      const p = clamp(window.scrollY / ((hero ? hero.offsetHeight : vh) * 0.7), 0, 1);
      const k = ease(p);
      const size = a.width + (D - a.width) * k;
      const x = a.left + (dx - a.left) * k, y = a.top + (dy - a.top) * k;
      const isDocked = p >= 1;
      el.style.transition = isDocked && docked.current ? 'transform 1s cubic-bezier(.2,.8,.2,1)' : 'none';
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${size / BASE})`;
      docked.current = isDocked;
      pos.current = { x: dx, y: dy, size: D, side: small ? 'right' : side, small, docked: isDocked };
      /* el color sale del fondo real que hay detrás de su centro */
      const now = performance.now();
      if (now - last > 120) {
        last = now;
        const r = el.getBoundingClientRect();
        const cx = clamp(r.left + r.width / 2, 1, vw - 1), cy = clamp(r.top + r.height / 2, 1, vh - 1);
        const c = backgroundAt(cx, cy, el);
        const hex = '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        setBg((prev) => (prev === hex ? prev : hex));
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

  /* bocadillo: aparece al llegar a una sección y se va solo */
  const say = (text) => {
    clearTimeout(bubbleT.current);
    setBubble({ text, show: true });
    bubbleT.current = setTimeout(() => setBubble((b) => ({ ...b, show: false })), 4200);
  };
  useEffect(() => {
    if (stage !== 'done') return undefined;
    const t = setTimeout(() => say(LINES[section] || ''), section === 'inicio' ? 200 : 700);
    return () => clearTimeout(t);
  }, [section, stage]);

  /* al terminar la bienvenida, 8 vuela del centro a su sitio en la portada */
  useEffect(() => {
    if (stage === 'sleep' || phase.current !== 'intro') return undefined;
    phase.current = 'flying';
    window.dispatchEvent(new Event('scroll'));
    const t = setTimeout(() => { phase.current = 'live'; window.dispatchEvent(new Event('scroll')); }, 1200);
    return () => clearTimeout(t);
  }, [stage]);

  const band = pal.band || COBALT;
  /* el cuerpo es blanco sobre fondo oscuro y cobalto sobre claro; el fondo de los ojos es el color que tiene detrás */
  const under = bg || band;
  const dark = isDark([1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16)));
  const col = { fg: dark ? '#FFFFFF' : band, cut: under };
  const mode = override || (stage === 'sleep' ? 'dormir' : stage === 'wake' ? 'saludar' : (SECTIONS[section] || SECTIONS.inicio).mode);
  return (
    <>
      <button type="button" ref={box} className="companion" style={{ width: BASE, height: BASE }}
        onClick={() => { mood('risa', 1600); say('Eso hace cosquillas.'); }} onMouseEnter={() => say(LINES[section] || 'Hola.')}
        aria-label="8, el agente de Priv8. Haz clic: tiene cosquillas.">
        <Eight className="companion-eight" mode={mode} fg={col.fg} cut={col.cut} label="8" />
      </button>
      <Bubble text={bubble.text} show={bubble.show && pos.current.docked} pos={pos.current} />
    </>
  );
}

/* Bocadillo de 8: se escribe letra a letra junto a él, hacia el lado del contenido. */
function Bubble({ text, show, pos }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!show) return undefined;
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 28);
    return () => clearInterval(t);
  }, [text, show]);
  const left = pos.side === 'left';
  const style = pos.small
    ? { right: 12, bottom: pos.size * 0.62 + 22 }
    : left ? { left: Math.max(12, pos.x + pos.size * 0.15), top: pos.y - 64 } : { right: Math.max(12, window.innerWidth - pos.x - pos.size * 0.85), top: pos.y - 64 };
  return (
    <div className={'bubble8' + (show ? ' on' : '') + (left ? ' l' : '')} style={style} role="status" aria-live="polite">
      <span>{text.slice(0, n)}</span><span className="ghost" aria-hidden="true">{text.slice(n)}</span>
    </div>
  );
}
