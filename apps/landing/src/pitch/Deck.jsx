import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { SLIDES, SlideCtx } from './Slides.jsx';
import { Blend } from '../Field.jsx';

/* Pase de diapositivas: teclado, clic y deslizar; contador, crono y pantalla completa (f).

   La transición es el scroll de priv8.es: las dos diapositivas son la misma página. Van pegadas, se mueven a la vez
   y, si cambian de color, entre ellas va el borde de píxeles de la landing (Blend), con el mismo fondo de datos que
   la diapositiva cobalto, continuo. El movimiento lo lleva JavaScript y se redondea a píxeles enteros, igual para las
   dos: nunca queda una raya ni asoma el fondo de detrás. El escenario mide un número entero de píxeles por lo mismo.

   Cada diapositiva tiene su animación de llegada, que empieza cuando el scroll ha terminado y solo una vez
   (fase pre, anima y final). Con menos movimiento o al imprimir, todo está ya en su estado final. */
const PASO_MS = 950;
const MAIN = SLIDES.filter((s) => !s.annex).length;
const TONE_VAR = { band: '--band', paper: '--paper' };
const MANUAL = /[?&]manual\b/.test(location.search);

function still() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function fromHash() {
  const n = parseInt((location.hash || '').replace('#', ''), 10);
  return Number.isFinite(n) && n >= 1 && n <= SLIDES.length ? n - 1 : 0;
}
export function label(i) {
  const s = SLIDES[i];
  if (!s) return '';
  if (s.annex) return i === MAIN ? 'Anexo' : `Anexo ${i - MAIN}`;
  return `${i + 1} / ${MAIN}`;
}
function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* la curva del scroll: cubic-bezier(.65, 0, .2, 1) */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6) break; if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1;
    if (Math.abs(sx(t) - x) > 1e-5) { t = x; for (let i = 0; i < 30; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return sy(t);
  };
}
const EASE = bezier(0.65, 0, 0.2, 1);

/* alto del borde de píxeles: la misma fórmula que Blend en la landing */
const edgeH = (w) => Math.round(Math.max(30, Math.min(56, w * 0.04))) || 52;

/* tamaño del escenario en píxeles enteros, 16:9 */
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vw < vh && vw <= 820;
  let w = Math.floor(portrait ? vw : Math.min(vw, (vh * 16) / 9));
  let h = Math.round((w * 9) / 16);
  if (h > vh && !portrait) { h = Math.floor(vh); w = Math.round((h * 16) / 9); }
  return { w, h };
}

export default function Deck() {
  const [idx, setIdx] = useState(fromHash);
  const [move, setMove] = useState(null);
  /* después del primer paso, ninguna diapositiva repite la entrada escalonada */
  const [quietas, setQuietas] = useState(false);
  const [printing, setPrinting] = useState(() => document.documentElement.classList.contains('printing'));
  const [size, setSize] = useState(fit);
  const [t0, setT0] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [idle, setIdle] = useState(false);
  /* fase de la animación de llegada de cada diapositiva: 0 aún no, 1 en marcha (esta visita), 2 ya vista */
  const [played, setPlayed] = useState(() => SLIDES.map(() => 0));
  /* posición de cada diapositiva en la «página» (px), para que el fondo de datos siga continuo de una a otra */
  const pageY = useRef(SLIDES.map(() => 0));
  const els = useRef([]);
  const busy = useRef(false);
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const on = () => setSize(fit());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  /* la primera diapositiva llega al abrir: su animación empieza cuando ha terminado la entrada escalonada */
  useEffect(() => {
    const t = setTimeout(() => setPlayed((p) => p.map((v, i) => (i === idxRef.current && v === 0 ? 1 : v))), still() ? 0 : 900);
    return () => clearTimeout(t);
  }, []);

  const arrive = useCallback((from, to) => {
    setPlayed((p) => p.map((v, i) => (i === to && v === 0 ? 1 : i === from && v === 1 ? 2 : v)));
  }, []);

  const go = useCallback((n) => {
    const to = Math.max(0, Math.min(SLIDES.length - 1, n));
    const from = idxRef.current;
    if (to === from || busy.current) return;
    setT0((v) => v ?? Date.now());
    history.replaceState(null, '', `#${to + 1}`);
    if (still()) { setIdx(to); arrive(from, to); return; }
    const dir = to > from ? 1 : -1;
    const { w, h } = sizeRef.current;
    const E = SLIDES[from].tone !== SLIDES[to].tone ? edgeH(w) : 0;
    const D = h + E;
    pageY.current[to] = pageY.current[from] + dir * D;
    const upper = dir > 0 ? from : to, lower = dir > 0 ? to : from;
    busy.current = true;
    setQuietas(true);
    setMove({ from, to, dir, E, D, upper, lower });
    setIdx(to);
  }, [arrive]);

  /* el movimiento: antes de pintar se colocan las dos; luego, a cada fotograma, la misma distancia entera para las dos */
  useLayoutEffect(() => {
    if (!move) return undefined;
    const a = els.current[move.from], b = els.current[move.to];
    if (!a || !b) return undefined;
    const put = (d) => {
      a.style.transform = `translate3d(0, ${-move.dir * d}px, 0)`;
      b.style.transform = `translate3d(0, ${move.dir * (move.D - d)}px, 0)`;
    };
    put(0);
    let raf = 0, start = 0, alive = true;
    const frame = (t) => {
      if (!alive) return;
      if (!start) start = t >= 1e12 ? t - PASO_MS : t;
      const k = Math.min(1, (t - start) / PASO_MS);
      put(Math.round(EASE(k) * move.D));
      if (k < 1) { raf = requestAnimationFrame(frame); return; }
      a.style.transform = ''; b.style.transform = '';
      busy.current = false;
      setMove(null);
      arrive(move.from, move.to);
    };
    /* ?manual: para medir la transición fotograma a fotograma desde un navegador sin ventana (scripts/pitch_frames.py) */
    if (MANUAL) {
      window.__p8seek = (k) => put(Math.round(EASE(k) * move.D));
      window.__p8end = () => { put(move.D); frame(1e12); };
      return () => { alive = false; delete window.__p8seek; delete window.__p8end; };
    }
    /* dos fotogramas de margen: el borde mide su ancho y 8 se monta antes de que nada se mueva */
    raf = requestAnimationFrame(() => { raf = requestAnimationFrame(frame); });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [move, arrive]);

  const next = useCallback(() => go(idxRef.current + 1), [go]);
  const prev = useCallback(() => go(idxRef.current - 1), [go]);

  const full = useCallback(() => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch (e) { /* sin pantalla completa */ }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
      else if (k === 'Home') go(0);
      else if (k === 'End') go(MAIN - 1);
      else if (k === 'f' || k === 'F') full();
      else if (k === 't' || k === 'T') setT0(Date.now());
    };
    const onHash = () => { const n = fromHash(); if (n !== idxRef.current) go(n); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', onHash); };
  }, [next, prev, go, full]);

  /* imprimir desde el navegador: todas las diapositivas, una por página, en su estado final */
  useEffect(() => {
    const before = () => { flushSync(() => setPrinting(true)); document.documentElement.classList.add('printing'); };
    const after = () => { if (!/[?&]pdf\b/.test(location.search)) { document.documentElement.classList.remove('printing'); setPrinting(false); } };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  useEffect(() => {
    if (!t0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [t0]);

  /* los mandos se apagan si no se mueve el ratón */
  useEffect(() => {
    let t = 0;
    const on = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2600); };
    on();
    window.addEventListener('pointermove', on, { passive: true });
    window.addEventListener('pointerdown', on, { passive: true });
    window.addEventListener('keydown', on);
    return () => { clearTimeout(t); window.removeEventListener('pointermove', on); window.removeEventListener('pointerdown', on); window.removeEventListener('keydown', on); };
  }, []);

  /* deslizar en el móvil, y clic: a la derecha avanza, en el tercio izquierdo vuelve */
  const down = useRef(null);
  const onPointerDown = (e) => { down.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onPointerUp = (e) => {
    const d = down.current; down.current = null;
    if (!d || e.target.closest('a, button, video')) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && e.pointerType === 'mouse') {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.3) prev(); else next();
    }
  };

  const el = t0 ? now - t0 : 0;
  const tone = SLIDES[idx].tone;
  const reduced = still();

  /* el borde de píxeles entre las dos, con el fondo de datos en la posición que le toca en la «página» */
  const strip = (i) => {
    if (!move || i !== move.to || !move.E) return null;
    const up = SLIDES[move.upper], lo = SLIDES[move.lower];
    const band = up.tone === 'band' ? up : lo;
    const y = move.dir > 0 ? pageY.current[move.to] - move.E : pageY.current[move.to] + size.h;
    return (
      <div className={`borde${move.dir > 0 ? '' : ' abajo'}${band.field ? ' campo' : ''}`} aria-hidden="true" style={{ height: move.E, '--ty': `${-y}px` }}>
        <Blend from={TONE_VAR[up.tone]} to={TONE_VAR[lo.tone]} seed={Math.min(move.from, move.to) + 3} />
      </div>
    );
  };

  return (
    <div className={`deck tone-${tone}${idle ? ' idle' : ''}`}>
      <div className="stage" style={printing ? undefined : { width: size.w, height: size.h }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} role="region" aria-roledescription="presentación" aria-label="Presentación de Priv8">
        {SLIDES.map((S, i) => {
          const on = i === idx;
          const sale = !!move && i === move.from;
          const entra = !!move && i === move.to;
          const near = Math.abs(i - idx) <= 1;
          const phase = printing || reduced ? 'final' : ['pre', 'anima', 'final'][played[i]];
          const cls = ['slide', `s-${S.tone}`, on && 'on', quietas && !printing && 'quieta', S.annex && 'annex', sale && 'sale', entra && 'entra', `f-${phase}`].filter(Boolean).join(' ');
          return (
            <SlideCtx.Provider key={S.id} value={{ live: on || near || printing || sale, active: on && !printing, moving: !!move && (sale || entra), phase, printing, n: label(i), annex: !!S.annex }}>
              <section ref={(n) => { els.current[i] = n; }} className={cls} style={{ '--ty': `${-pageY.current[i]}px` }} aria-hidden={!on && !printing} aria-roledescription="diapositiva" aria-label={label(i)} id={`d-${S.id}`}>
                {strip(i)}
                <S.C />
              </section>
            </SlideCtx.Provider>
          );
        })}
        <div className="progress" aria-hidden="true"><i style={{ width: `${(Math.min(idx + 1, MAIN) / MAIN) * 100}%` }} /></div>
      </div>
      <nav className="controls" aria-label="Mandos de la presentación">
        <button type="button" onClick={prev} aria-label="Anterior" disabled={idx === 0}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
        <span className="count" aria-live="polite">{label(idx)}</span>
        <button type="button" onClick={next} aria-label="Siguiente" disabled={idx === SLIDES.length - 1}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
        <button type="button" className={`timer${el > 7 * 60000 ? ' over' : el > 6 * 60000 ? ' near' : ''}`} onClick={() => setT0(Date.now())} title="Crono de 7 minutos. t lo pone a cero.">{fmt(el)}<small> / 7:00</small></button>
        <button type="button" onClick={full} aria-label="Pantalla completa (f)" title="Pantalla completa (f)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg></button>
      </nav>
      <p className="turn" aria-hidden="true">Gira el móvil para verla más grande</p>
    </div>
  );
}
