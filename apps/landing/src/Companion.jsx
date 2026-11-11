import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { useCompanion } from './companion.js';

/* 8 recorre la web saltando de un punto de anclaje a otro (elementos con data-anchor8).
   Cada escena le pone un sitio, una cara (data-mode) y una frase (data-say).
   Los anclajes .spot-gutter no tienen sitio propio: 8 se queda en el margen lateral.
   Su color sale del fondo real que tiene detrás. */
const BASE = 1100; // se dibuja grande y se reduce: así no se pixela al crecer
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function backgroundAt(x, y, self) {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    /* lo que cuenta es el fondo de la sección, no la barra ni el bocadillo que pasen por encima */
    if (self.contains(el) || el.closest('.nav, .bubble8, .layer8')) continue;
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
  const vh = document.documentElement.clientHeight;
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

/* pasa de un color a otro en 220 ms */
function useTweenColor(target) {
  const [c, setC] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const a = from.current; if (a === target) return undefined;
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
    const t0 = performance.now(); let raf = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 220), e = 1 - Math.pow(1 - k, 3);
      const hex = '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * e).toString(16).padStart(2, '0')).join('');
      from.current = hex; setC(hex);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return c;
}

export default function Companion({ pal, intro }) {
  const { override } = useCompanion();
  const [stage, setStage] = useState(intro ? 'wake' : 'done');
  const [bg, setBg] = useState(null);
  const [spot, setSpot] = useState({ mode: 'mirar', say: '', id: '' });
  const [bubble, setBubble] = useState({ text: '', show: false });
  const [look, setLook] = useState(null);
  const box = useRef(null);
  const flyReq = useRef(false);
  const lastSpot = useRef(null);
  const changeT = useRef(0);
  const bubbleT = useRef(0);
  const phase = useRef(intro ? 'intro' : 'live');

  /* arranque: 8 ya está despierto, saluda en su bocadillo y vuela a su sitio en la portada */
  useEffect(() => {
    if (stage !== 'wake') return undefined;
    const h = setTimeout(() => setBubble({ text: '¡Hola, soy 8!', show: true, big: true, side: 'left' }), 350);
    /* mira a un lado y al otro: lo que mira se censura solo y vuelve a verse cuando aparta la vista (el campo escucha «p8look») */
    const glance = (side, to) => () => { setLook(to); window.dispatchEvent(new CustomEvent('p8look', { detail: side })); };
    const g1 = setTimeout(glance(-1, [-0.95, 0.05, -6]), 800);
    const g2 = setTimeout(glance(1, [0.95, 0.05, 6]), 1550);
    const g3 = setTimeout(glance(0, null), 2250);
    const f = setTimeout(() => { setBubble((b) => ({ ...b, show: false })); setStage('fly'); }, 2550);
    const b = setTimeout(() => setStage('done'), 3650);
    return () => { [h, g1, g2, g3, f, b].forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    let raf = 0, snapUntil = 0;
    let cur = null, tween = null, cand = null, candT = 0;
    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    /* color de 8 según la zona de su sitio: sobre blanco, cobalto; sobre cobalto, blanco. Solo cambia al llegar a otra zona */
    const zoneColor = (a, el) => {
      const r = a.getBoundingClientRect();
      const c = backgroundAt(clamp(r.left + r.width / 2, 1, document.documentElement.clientWidth - 1), clamp(r.top + r.height / 2, 1, document.documentElement.clientHeight - 1), el);
      return toHex(c);
    };
    const frame = () => {
      raf = 0;
      const el = box.current; if (!el) return;
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      const heroA = document.getElementById('hero-anchor');
      const now0 = performance.now();
      const snapping = now0 < snapUntil;
      /* 8 va en la página (absoluto) y se mueve con el scroll de forma nativa, sin saltos. Solo cuando su sitio está en
         una escena fijada que está quieta en pantalla, 8 pasa a fijo, para quedarse igual de quieto. Con zoom de dos
         dedos se queda como está. */
      const sx = window.scrollX, sy = window.scrollY;
      const vz = window.visualViewport;
      if (vz && vz.scale > 1.01 && cur) return;
      const place = (p, fixed) => {
        el.style.position = fixed ? 'fixed' : 'absolute';
        el.style.transform = `translate3d(${p.left + (fixed ? 0 : sx)}px, ${p.top + (fixed ? 0 : sy)}px, 0) scale(${p.S / BASE})`;
      };
      if (phase.current === 'intro') {
        /* bienvenida: 8 grande en el centro, con los ojos abiertos, saluda desde su bocadillo a la izquierda */
        const D = Math.min(vw * 0.4, vh * 0.5 * 46 / 32, 520), S = D * 64 / 46;
        el.style.transition = 'none';
        cur = { left: vw / 2 - S / 2, top: vh * 0.5 - S / 2, S };
        place(cur, true);
        lastSpot.current = heroA;
        return;
      }
      if (flyReq.current) {
        /* de la bienvenida a la portada: el mismo viaje en curva, algo más largo */
        flyReq.current = false;
        tween = cur ? { from: { ...cur }, t0: now0, dur: 1000 } : null;
      }
      /* 8 cambia de sitio solo cuando el nuevo lleva un momento siendo el más centrado: así no va y viene entre dos */
      const picked = phase.current === 'live' ? pickAnchor() : heroA;
      if (!lastSpot.current || !lastSpot.current.isConnected) { lastSpot.current = picked; tween = null; if (picked) setBg(zoneColor(picked, el)); }
      else if (phase.current === 'live' && picked && picked !== lastSpot.current) {
        if (cand !== picked) { cand = picked; candT = now0; }
        if (now0 - candT > 120 || snapping) {
          lastSpot.current = picked; cand = null;
          tween = snapping || !cur ? null : { from: { ...cur }, t0: now0, dur: 620 };
          setSpot({ mode: picked.dataset.mode || 'mirar', say: picked.dataset.say || '', side: picked.dataset.side || '', id: Math.random().toString(36) });
        } else ask();
      } else cand = null;
      const anchor = lastSpot.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const S0 = r.width * 64 / 46;
      const target = { left: r.left + r.width / 2 - S0 / 2, top: r.top + r.height / 2 - S0 / 2, S: S0 };
      const stg = anchor.closest('.stage');
      const pinned = !!stg && Math.abs(stg.getBoundingClientRect().top) < 1;
      if (phase.current === 'live' && (anchor.dataset.mode !== spot.mode || anchor.dataset.say !== spot.say)) {
        setSpot((sp) => (sp.mode === anchor.dataset.mode && sp.say === anchor.dataset.say ? sp : { mode: anchor.dataset.mode || 'mirar', say: anchor.dataset.say || '', side: anchor.dataset.side || '', id: Math.random().toString(36) }));
      }
      /* viaje entre sitios: una curva suave hacia donde está ahora su sitio (se recalcula en cada fotograma), con un
         arco leve hacia un lado y un pequeño encogerse a mitad de camino. Llega justo, sin pasarse. */
      let pos = target;
      if (tween) {
        const k = Math.min(1, (now0 - tween.t0) / tween.dur), e = ease(k);
        const fx = tween.from.left + tween.from.S / 2, fy = tween.from.top + tween.from.S / 2;
        const tx = target.left + target.S / 2, ty = target.top + target.S / 2;
        const dx = tx - fx, dy = ty - fy, dist = Math.hypot(dx, dy) || 1;
        const bow = Math.min(160, dist * 0.18) * Math.sin(Math.PI * e);
        const cx = fx + dx * e + (-dy / dist) * bow, cy = fy + dy * e + (dx / dist) * bow;
        const S = (tween.from.S + (target.S - tween.from.S) * e) * (1 - 0.08 * Math.sin(Math.PI * e));
        pos = { left: cx - S / 2, top: cy - S / 2, S };
        if (k < 1) ask(); else tween = null;
      }
      el.style.transition = 'none';
      place(pos, pinned || (!!tween && phase.current !== 'live'));
      cur = { left: pos.left, top: pos.top, S: pos.S };
      /* color según lo que tiene detrás (la transición rápida del color va aparte) */
      const bgNow = toHex(backgroundAt(clamp(pos.left + pos.S / 2, 1, vw - 1), clamp(pos.top + pos.S / 2, 1, vh - 1), el));
      setBg((p) => (p === bgNow ? p : bgNow));
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const snap = () => { snapUntil = performance.now() + 600; if (box.current) box.current.style.transition = 'none'; ask(); };

    ask();
    const tick = setInterval(ask, 200);
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', snap);
    /* zoom del navegador: cambia el tamaño visible y la densidad de píxeles */
    const vv = window.visualViewport; const onVv = () => { ask(); }; if (vv) { vv.addEventListener('resize', onVv); vv.addEventListener('scroll', onVv); }
    let mq = null; const watchDpr = () => { if (mq) mq.removeEventListener('change', onDpr); mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`); mq.addEventListener('change', onDpr); };
    function onDpr() { snap(); watchDpr(); }
    watchDpr();
    return () => { clearInterval(tick); window.removeEventListener('scroll', ask); window.removeEventListener('resize', snap); if (vv) { vv.removeEventListener('resize', onVv); vv.removeEventListener('scroll', onVv); } if (mq) mq.removeEventListener('change', onDpr); cancelAnimationFrame(raf); };
  }, []);

  /* al despertar, crece hasta su sitio en la portada */
  useEffect(() => {
    if (stage === 'done') { phase.current = 'live'; window.dispatchEvent(new Event('scroll')); return undefined; }
    if (stage !== 'fly' || phase.current !== 'intro') return undefined;
    phase.current = 'flying';
    flyReq.current = true;
    window.dispatchEvent(new Event('scroll'));
    return undefined;
  }, [stage]);

  /* bocadillo: cada vez que cambia de sitio o de frase */
  const say = (text, side = '') => {
    clearTimeout(bubbleT.current);
    if (!text) { setBubble((b) => ({ ...b, show: false })); return; }
    setBubble({ text, show: true, big: false, side });
    bubbleT.current = setTimeout(() => setBubble((b) => ({ ...b, show: false })), 4200);
  };
  useEffect(() => {
    if (stage !== 'done') return undefined;
    setBubble((b) => ({ ...b, show: false, big: false, side: '' }));
    const t = setTimeout(() => say(spot.say, spot.side), 650);
    return () => clearTimeout(t);
  }, [spot.id, stage]);

  const band = pal.band || '#2D45D6';
  const under = bg || band;
  const rgb = [1, 3, 5].map((i) => parseInt(under.slice(i, i + 2), 16));
  const light = lum(rgb) > 0.55;
  /* el color cambia con una transición corta, no de golpe */
  const fgA = useTweenColor(light ? band : '#FFFFFF');
  const cutA = useTweenColor(under);
  const col = { fg: fgA, cut: cutA };
  /* en la bienvenida, ojos bien abiertos todo el rato: nada de párpados entornados */
  const mode = override || (stage === 'wake' || stage === 'fly' ? 'mirar' : spot.mode);
  return (
    <div className="layer8">
      <div ref={box} className="companion" style={{ width: BASE, height: BASE }} onMouseEnter={() => { if (stage === 'done' && spot.say) say(spot.say, spot.side); }} role="img" aria-label="8, el agente de Priv8">
        <Eight className="companion-eight" mode={mode} look={look} fg={col.fg} cut={col.cut} label="8" />
      </div>
      <Bubble text={bubble.text} show={bubble.show} big={bubble.big} side={bubble.side} eight={box} />
    </div>
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

/* Bocadillo encima de 8: el pico sale de la base, hacia abajo, apuntando a 8. tx es la punta, en px desde la izquierda. */
function bubblePathDown(W, H, R, tx, th) {
  const a = Math.max(R + 2, tx - 2), b = Math.min(W - R - 2, tx + 16);
  return `M${R} 0 H${W - R} A${R} ${R} 0 0 1 ${W} ${R} V${H - R} A${R} ${R} 0 0 1 ${W - R} ${H} H${b} `
    + `C${b - 6} ${H} ${tx + 2} ${H + th * 0.4} ${tx} ${H + th} C${tx - 0.6} ${H + th * 0.45} ${a + 1} ${H + 1.5} ${a - 4} ${H} `
    + `H${R} A${R} ${R} 0 0 1 0 ${H - R} V${R} A${R} ${R} 0 0 1 ${R} 0 Z`;
}

function Bubble({ text, show, big, side, eight }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [geo, setGeo] = useState({ left: true, below: false, up: false, tip: 0 });
  useEffect(() => {
    /* al ocultarse no se borra el texto: el bocadillo se va con su frase, no vacío */
    if (!show) return undefined;
    setN(0);
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
      const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, m = 12;
      const gap = Math.max(14, D * 0.08), T = big ? 23 : 14;
      const navB = (document.querySelector('.nav')?.getBoundingClientRect().bottom || 0) + 10;
      const L = cx - D / 2, R = cx + D / 2, top8 = cy - D * 0.36, bot8 = cy + D * 0.36, eye = cy - D * 0.06;
      const roomR = vw - m - (R + gap + T), roomL = (L - gap - T) - m;
      el.style.maxWidth = (big ? 'none' : `${Math.max(150, Math.min(260, Math.max(roomR, roomL, vw - 2 * m - T)))}px`);
      const w = el.offsetWidth, h = el.offsetHeight;
      let left, top, onRight = true, below = false, room = true, up = false;
      if (side === 'left' && roomL >= w) { left = L - gap - T - w; onRight = false; }
      else if (roomR >= w) { left = R + gap + T; onRight = true; }
      else if (roomL >= w) { left = L - gap - T - w; onRight = false; }
      else {
        /* no cabe al lado: encima de 8, con la cola hacia él */
        left = clamp(cx - w * 0.3, m, vw - m - w); onRight = true; up = true;
        top = top8 - gap - h;
      }
      if (top === undefined) top = eye - gap - h;
      /* el bocadillo nunca va debajo: ahí está el titular. Si arriba no cabe (la barra, una pantalla muy baja), no sale. */
      if (top < navB) { if (big) { top = bot8 + gap; below = true; } else room = false; }
      /* si 8 se ha ido de la pantalla, su bocadillo se va con él */
      el.style.visibility = !room || bot8 < navB || top8 > vh ? 'hidden' : '';
      const fx = e8.style.position === 'fixed';
      el.style.position = fx ? 'fixed' : 'absolute';
      el.style.left = `${left + (fx ? 0 : window.scrollX)}px`; el.style.top = `${top + (fx ? 0 : window.scrollY)}px`;
      const tip = Math.round(clamp(cx - left, 26, w - 30));
      setGeo((g) => (g.left === onRight && g.below === below && g.up === up && g.tip === tip ? g : { left: onRight, below, up, tip }));
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [show, big, text, side]);
  const cls = 'bubble8' + (show ? ' on' : '') + (geo.up ? ' up' : geo.left ? ' l' : '') + (geo.below ? ' below' : '') + (big ? ' big' : '');
  const R = big ? 28 : 20, th = big ? 30 : 18, T = 14 * th / 18;
  const flip = `scale(${geo.left ? 1 : -1}, ${geo.below ? -1 : 1})`;
  return (
    <div ref={ref} className={cls} role="status" aria-live="polite" style={geo.up ? { transformOrigin: `${geo.tip}px 100%` } : undefined}>
      {size.w > 0 && geo.up && (
        <svg className="shape" width={size.w} height={size.h + th} viewBox={`0 0 ${size.w} ${size.h + th}`}
          style={{ left: 0, height: size.h + th }} aria-hidden="true">
          <path d={bubblePathDown(size.w, size.h, Math.min(R, size.h / 2), geo.tip, th)} />
        </svg>
      )}
      {size.w > 0 && !geo.up && (
        <svg className="shape" width={size.w + T} height={size.h} viewBox={`0 0 ${size.w + T} ${size.h}`}
          style={{ [geo.left ? 'left' : 'right']: -T, transform: flip }} aria-hidden="true">
          <path d={bubblePath(size.w, size.h, Math.min(R, size.h / 2), th)} />
        </svg>
      )}
      <span>{text.slice(0, n)}</span><span className="ghost" aria-hidden="true">{text.slice(n)}</span>
    </div>
  );
}
