import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { mood, useCompanion } from './companion.js';

/* 8 recorre la web saltando de un punto de anclaje a otro (elementos con data-anchor8).
   Cada escena le pone un sitio, una cara (data-mode) y una frase (data-say).
   Los anclajes .spot-gutter no tienen sitio propio: 8 se queda en el margen lateral.
   Su color sale del fondo real que tiene detrás. */
const BASE = 360;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
  return [45, 69, 214];
}
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const toHex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/* elige el anclaje más centrado de los que se ven */
function pickAnchor() {
  const vh = window.innerHeight;
  let best = null, bestD = Infinity;
  document.querySelectorAll('[data-anchor8]').forEach((el) => {
    const host = el.closest('section') || el;
    const r = host.getBoundingClientRect();
    if (r.bottom < vh * 0.25 || r.top > vh * 0.75) return;
    const a = el.getBoundingClientRect();
    const cy = el.classList.contains('spot-gutter') ? clamp(vh / 2, r.top, r.bottom) : a.top + a.height / 2;
    const d = Math.abs(cy - vh / 2);
    if (d < bestD) { bestD = d; best = el; }
  });
  return best;
}

export default function Companion({ pal, intro }) {
  const { override } = useCompanion();
  const [stage, setStage] = useState(intro ? 'sleep' : 'done');
  const [bg, setBg] = useState(null);
  const [spot, setSpot] = useState({ mode: 'mirar', say: '', id: '' });
  const [bubble, setBubble] = useState({ text: '', show: false });
  const box = useRef(null);
  const pos = useRef({ x: 0, y: 0, size: 0, left: false });
  const lastSpot = useRef(null);
  const changeT = useRef(0);
  const bubbleT = useRef(0);
  const phase = useRef(intro ? 'intro' : 'live');

  /* arranque: 8 duerme, despierta y saluda */
  useEffect(() => {
    if (stage !== 'sleep') return undefined;
    const a = setTimeout(() => setStage('wake'), 900);
    const b = setTimeout(() => setStage('done'), 3600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  useEffect(() => {
    let raf = 0, lastC = 0;
    const frame = () => {
      raf = 0;
      const el = box.current; if (!el) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const heroA = document.getElementById('hero-anchor');
      let target = null, anchor = phase.current === 'live' ? pickAnchor() : heroA;
      if (anchor) {
        if (anchor.classList.contains('spot-gutter')) {
          const gutter = Math.max(0, (vw - 1240) / 2) + Math.min(56, Math.max(20, vw * 0.04));
          const small = gutter < 150;
          const D = small ? 96 : Math.min(190, gutter - 36);
          const S = D * 64 / 46;
          const x = small ? vw - D - 12 : Math.max(8, (gutter - D) / 2 - 10);
          const y = small ? vh - D * 0.7 - 12 : vh * 0.5 - D * 0.35;
          target = { left: x + D / 2 - S / 2, top: y + D * 0.35 - S / 2, S, D, gx: x, gy: y };
        } else {
          const r = anchor.getBoundingClientRect();
          const S = r.width * 64 / 46;
          target = { left: r.left + r.width / 2 - S / 2, top: r.top + r.height / 2 - S / 2, S, D: r.width, gx: r.left, gy: r.top + r.height / 2 - r.width * 0.35 };
        }
      }
      if (!target) return;
      if (phase.current === 'intro') {
        const S = target.S * 0.62;
        el.style.transition = 'none';
        el.style.transform = `translate3d(${target.left + (target.S - S) / 2}px, ${target.top + (target.S - S) / 2 + 30}px, 0) scale(${S / BASE})`;
        return;
      }
      const changed = anchor !== lastSpot.current;
      if (changed) {
        lastSpot.current = anchor;
        setSpot({ mode: anchor.dataset.mode || 'mirar', say: anchor.dataset.say || '', id: Math.random().toString(36) });
      } else if (anchor && (anchor.dataset.mode !== spot.mode || anchor.dataset.say !== spot.say)) {
        setSpot((s) => (s.mode === anchor.dataset.mode && s.say === anchor.dataset.say ? s : { mode: anchor.dataset.mode || 'mirar', say: anchor.dataset.say || '', id: Math.random().toString(36) }));
      }
      if (changed) changeT.current = performance.now();
      const moving = performance.now() - changeT.current < 950;
      el.style.transition = phase.current === 'flying' ? 'transform 1.1s cubic-bezier(.34, 1.56, .64, 1)' : (moving ? 'transform .9s cubic-bezier(.2, .8, .2, 1)' : 'none');
      el.style.transform = `translate3d(${target.left}px, ${target.top}px, 0) scale(${target.S / BASE})`;
      pos.current = { x: target.gx, y: target.gy, size: target.D, left: target.gx + target.D / 2 < vw / 2 };
      const now = performance.now();
      if (now - lastC > 140) {
        lastC = now;
        const c = backgroundAt(clamp(target.left + target.S / 2, 1, vw - 1), clamp(target.top + target.S / 2, 1, vh - 1), el);
        const hex = toHex(c);
        setBg((p) => (p === hex ? p : hex));
      }
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
    ask();
    const tick = setInterval(ask, 200);
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    return () => { clearInterval(tick); window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); cancelAnimationFrame(raf); };
  }, []);

  /* al despertar, crece hasta su sitio en la portada */
  useEffect(() => {
    if (stage === 'sleep' || phase.current !== 'intro') return undefined;
    phase.current = 'flying';
    window.dispatchEvent(new Event('scroll'));
    const t = setTimeout(() => { phase.current = 'live'; window.dispatchEvent(new Event('scroll')); }, 1200);
    return () => clearTimeout(t);
  }, [stage]);

  /* bocadillo: cada vez que cambia de sitio o de frase */
  const say = (text) => {
    clearTimeout(bubbleT.current);
    if (!text) { setBubble((b) => ({ ...b, show: false })); return; }
    setBubble({ text, show: true });
    bubbleT.current = setTimeout(() => setBubble((b) => ({ ...b, show: false })), 4200);
  };
  useEffect(() => {
    if (stage !== 'done') return undefined;
    setBubble((b) => ({ ...b, show: false }));
    const t = setTimeout(() => say(spot.say), 650);
    return () => clearTimeout(t);
  }, [spot.id, stage]);

  const band = pal.band || '#2D45D6';
  const under = bg || band;
  const rgb = [1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16));
  const light = lum(rgb) > 0.55;
  const col = { fg: light ? band : '#FFFFFF', cut: under };
  const mode = override || (stage === 'sleep' ? 'dormir' : stage === 'wake' ? 'saludar' : spot.mode);
  return (
    <>
      <button type="button" ref={box} className="companion" style={{ width: BASE, height: BASE }}
        onClick={() => { mood('risa', 1600); say('Eso hace cosquillas.'); }} onMouseEnter={() => say(spot.say || 'Hola.')}
        aria-label="8, el agente de Priv8. Haz clic: tiene cosquillas.">
        <Eight className="companion-eight" mode={mode} fg={col.fg} cut={col.cut} label="8" />
      </button>
      <Bubble text={bubble.text} show={bubble.show} pos={pos.current} />
    </>
  );
}

/* Bocadillo de 8: se escribe letra a letra encima de él. */
function Bubble({ text, show, pos }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!show) return undefined;
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 26);
    return () => clearInterval(t);
  }, [text, show]);
  /* al lado de 8, nunca encima del texto: a su derecha si 8 está a la izquierda, y al revés */
  const top = Math.max(80, pos.y + pos.size * 0.05);
  const style = pos.left
    ? { left: pos.x + pos.size + 14, top }
    : { right: Math.max(12, window.innerWidth - pos.x + 14), top };
  return (
    <div className={'bubble8' + (show ? ' on' : '') + (pos.left ? ' l' : '')} style={style} role="status" aria-live="polite">
      <span>{text.slice(0, n)}</span><span className="ghost" aria-hidden="true">{text.slice(n)}</span>
    </div>
  );
}
