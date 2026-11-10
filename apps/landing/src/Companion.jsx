import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { mood, useCompanion } from './companion.js';

/* 8 recorre la web saltando de un punto de anclaje a otro (elementos con data-anchor8).
   Cada escena le pone un sitio, una cara (data-mode) y una frase (data-say).
   Los anclajes .spot-gutter no tienen sitio propio: 8 se queda en el margen lateral.
   Su color sale del fondo real que tiene detrás. */
const BASE = 1100; // se dibuja grande y se reduce: así no se pixela al crecer
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
    const host = el.closest('section, footer') || el;
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
  const [stage, setStage] = useState(intro ? 'wake' : 'done');
  const [bg, setBg] = useState(null);
  const [spot, setSpot] = useState({ mode: 'mirar', say: '', id: '' });
  const [bubble, setBubble] = useState({ text: '', show: false });
  const box = useRef(null);
  const lastSpot = useRef(null);
  const changeT = useRef(0);
  const bubbleT = useRef(0);
  const phase = useRef(intro ? 'intro' : 'live');

  /* arranque: 8 ya está despierto, saluda en su bocadillo y vuela a su sitio en la portada */
  useEffect(() => {
    if (stage !== 'wake') return undefined;
    const h = setTimeout(() => setBubble({ text: '¡Hola, soy 8!', show: true, big: true, side: 'left' }), 350);
    const f = setTimeout(() => { setBubble((b) => ({ ...b, show: false })); setStage('fly'); }, 1950);
    const b = setTimeout(() => setStage('done'), 3050);
    return () => { clearTimeout(h); clearTimeout(f); clearTimeout(b); };
  }, []);

  useEffect(() => {
    let raf = 0, lastC = 0, snapUntil = 0;
    const frame = () => {
      raf = 0;
      const el = box.current; if (!el) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const heroA = document.getElementById('hero-anchor');
      const now0 = performance.now();
      const snapping = now0 < snapUntil;
      /* mientras cambia el zoom o el tamaño, 8 no cambia de sitio: se queda en el que tenía y se recoloca sin animación */
      let anchor = phase.current === 'live' ? ((snapping && lastSpot.current && lastSpot.current.isConnected) ? lastSpot.current : pickAnchor()) : heroA;
      let target = null;
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        const D = r.width, S = D * 64 / 46;
        /* 8 vive en su sitio de la página: si el sitio sube, 8 sube con él; nunca se queda flotando encima del contenido */
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        target = { left: cx - S / 2, top: cy - S / 2, S, D };
      }
      if (!target) return;
      if (phase.current === 'intro') {
        /* bienvenida: 8 grande en el centro, con los ojos abiertos, saluda desde su bocadillo a la izquierda */
        const D = Math.min(vw * 0.4, vh * 0.5 * 46 / 32, 520), S = D * 64 / 46;
        el.style.transition = el.dataset.placed && !snapping ? 'transform .9s cubic-bezier(.34, 1.4, .64, 1)' : 'none';
        el.dataset.placed = '1';
        el.style.transform = `translate3d(${vw / 2 - S / 2}px, ${vh * 0.5 - S / 2}px, 0) scale(${S / BASE})`;
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
      el.style.transition = snapping ? 'none' : phase.current === 'flying' ? 'transform 1.1s cubic-bezier(.34, 1.56, .64, 1)' : (moving ? 'transform .9s cubic-bezier(.2, .8, .2, 1)' : 'none');
      el.style.transform = `translate3d(${target.left}px, ${target.top}px, 0) scale(${target.S / BASE})`;
      const now = performance.now();
      if (now - lastC > 140) {
        lastC = now;
        const c = backgroundAt(clamp(target.left + target.S / 2, 1, vw - 1), clamp(target.top + target.S / 2, 1, vh - 1), el);
        const hex = toHex(c);
        setBg((p) => (p === hex ? p : hex));
      }
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const snap = () => { snapUntil = performance.now() + 600; if (box.current) box.current.style.transition = 'none'; ask(); };
    ask();
    const tick = setInterval(ask, 200);
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', snap);
    /* zoom del navegador: cambia el tamaño visible y la densidad de píxeles */
    const vv = window.visualViewport; if (vv) vv.addEventListener('resize', snap);
    let mq = null; const watchDpr = () => { if (mq) mq.removeEventListener('change', onDpr); mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`); mq.addEventListener('change', onDpr); };
    function onDpr() { snap(); watchDpr(); }
    watchDpr();
    return () => { clearInterval(tick); window.removeEventListener('scroll', ask); window.removeEventListener('resize', snap); if (vv) vv.removeEventListener('resize', snap); if (mq) mq.removeEventListener('change', onDpr); cancelAnimationFrame(raf); };
  }, []);

  /* al despertar, crece hasta su sitio en la portada */
  useEffect(() => {
    if (stage === 'done') { phase.current = 'live'; window.dispatchEvent(new Event('scroll')); return undefined; }
    if (stage !== 'fly' || phase.current !== 'intro') return undefined;
    phase.current = 'flying';
    window.dispatchEvent(new Event('scroll'));
    return undefined;
  }, [stage]);

  /* bocadillo: cada vez que cambia de sitio o de frase */
  const say = (text) => {
    clearTimeout(bubbleT.current);
    if (!text) { setBubble((b) => ({ ...b, show: false })); return; }
    setBubble({ text, show: true, big: false, side: '' });
    bubbleT.current = setTimeout(() => setBubble((b) => ({ ...b, show: false })), 4200);
  };
  useEffect(() => {
    if (stage !== 'done') return undefined;
    setBubble((b) => ({ ...b, show: false, big: false, side: '' }));
    const t = setTimeout(() => say(spot.say), 650);
    return () => clearTimeout(t);
  }, [spot.id, stage]);

  const band = pal.band || '#2D45D6';
  const under = bg || band;
  const rgb = [1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16));
  const light = lum(rgb) > 0.55;
  const col = { fg: light ? band : '#FFFFFF', cut: under };
  /* en la bienvenida, ojos bien abiertos todo el rato: nada de párpados entornados */
  const mode = override || (stage === 'wake' || stage === 'fly' ? 'mirar' : spot.mode);
  return (
    <>
      <button type="button" ref={box} className="companion" style={{ width: BASE, height: BASE }}
        onClick={() => { mood('risa', 1600); say('Eso hace cosquillas.'); }} onMouseEnter={() => say(spot.say || 'Hola.')}
        aria-label="8, el agente de Priv8. Haz clic: tiene cosquillas.">
        <Eight className="companion-eight" mode={mode} fg={col.fg} cut={col.cut} label="8" />
      </button>
      <Bubble text={bubble.text} show={bubble.show} big={bubble.big} side={bubble.side} eight={box} />
    </>
  );
}

/* Bocadillo de 8. Se coloca en cada fotograma a partir de dónde está 8 de verdad en pantalla, así que se mueve con él
   y nunca lo toca: a su lado y por encima de los ojos; si no cabe a ningún lado, encima de 8; si arriba está la barra,
   por debajo. El bocadillo y su cola son un solo trazado SVG, sin juntas, con la base recta hasta la punta. */
function bubblePath(W, H, R, th) {
  const k = th / 18, T = 14 * k, y0 = H - th;
  const p = (x, y) => `${(x * k).toFixed(2)} ${(y0 + y * k).toFixed(2)}`;
  return `M${T + R} 0 H${T + W - R} A${R} ${R} 0 0 1 ${T + W} ${R} V${H - R} A${R} ${R} 0 0 1 ${T + W - R} ${H} H${(3.2 * k).toFixed(2)} `
    + `C${p(1, 18)} ${p(0.6, 16.4)} ${p(3.4, 15.4)} C${p(11, 12.6)} ${p(14, 7)} ${p(14, 0)} V${R} A${R} ${R} 0 0 1 ${T + R} 0 Z`;
}

function Bubble({ text, show, big, side, eight }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [geo, setGeo] = useState({ left: true, below: false });
  useEffect(() => {
    setN(0);
    if (!show) return undefined;
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 20);
    return () => clearInterval(t);
  }, [text, show]);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const measure = () => { const w = el.offsetWidth, h = el.offsetHeight; setSize((o) => (o.w === w && o.h === h ? o : { w, h })); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let raf = 0;
    const place = () => {
      raf = requestAnimationFrame(place);
      const el = ref.current, e8 = eight.current; if (!el || !e8) return;
      const r = e8.getBoundingClientRect();
      const D = r.width * 46 / 64, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const vw = window.innerWidth, vh = window.innerHeight, m = 12;
      const gap = Math.max(14, D * 0.08), T = big ? 23 : 14;
      const navB = (document.querySelector('.nav')?.getBoundingClientRect().bottom || 0) + 10;
      const L = cx - D / 2, R = cx + D / 2, top8 = cy - D * 0.36, bot8 = cy + D * 0.36, eye = cy - D * 0.06;
      const roomR = vw - m - (R + gap + T), roomL = (L - gap - T) - m;
      el.style.maxWidth = (big ? 'none' : `${Math.max(150, Math.min(260, Math.max(roomR, roomL, vw - 2 * m - T)))}px`);
      const w = el.offsetWidth, h = el.offsetHeight;
      let left, top, onRight = true, below = false, room = true;
      if (side === 'left' && roomL >= w) { left = L - gap - T - w; onRight = false; }
      else if (roomR >= w) { left = R + gap + T; onRight = true; }
      else if (roomL >= w) { left = L - gap - T - w; onRight = false; }
      else {
        /* no cabe al lado: encima de 8, con la cola hacia él */
        left = clamp(cx + D * 0.12, m + T, vw - m - w); onRight = true;
        top = top8 - gap - h;
      }
      if (top === undefined) top = eye - gap - h;
      /* el bocadillo nunca va debajo: ahí está el titular. Si arriba no cabe (la barra, una pantalla muy baja), no sale. */
      if (top < navB) { if (big) { top = bot8 + gap; below = true; } else room = false; }
      /* si 8 se ha ido de la pantalla, su bocadillo se va con él */
      el.style.visibility = !room || bot8 < navB || top8 > vh ? 'hidden' : '';
      el.style.left = `${left}px`; el.style.top = `${top}px`;
      setGeo((g) => (g.left === onRight && g.below === below ? g : { left: onRight, below }));
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [show, big, text, side]);
  const cls = 'bubble8' + (show ? ' on' : '') + (geo.left ? ' l' : '') + (geo.below ? ' below' : '') + (big ? ' big' : '');
  const R = big ? 28 : 20, th = big ? 30 : 18, T = 14 * th / 18;
  const flip = `scale(${geo.left ? 1 : -1}, ${geo.below ? -1 : 1})`;
  return (
    <div ref={ref} className={cls} role="status" aria-live="polite">
      {size.w > 0 && (
        <svg className="shape" width={size.w + T} height={size.h} viewBox={`0 0 ${size.w + T} ${size.h}`}
          style={{ [geo.left ? 'left' : 'right']: -T, transform: flip }} aria-hidden="true">
          <path d={bubblePath(size.w, size.h, Math.min(R, size.h / 2), th)} />
        </svg>
      )}
      <span>{text.slice(0, n)}</span><span className="ghost" aria-hidden="true">{text.slice(n)}</span>
    </div>
  );
}
