import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { SLIDES, SlideCtx } from './Slides.jsx';
import { Blend } from '../Field.jsx';

/* Pase de diapositivas: teclado, clic y deslizar; contador, crono y pantalla completa (f).
   Cada diapositiva mide 16:9 y se ajusta a la ventana. La transición es la de la landing al hacer scroll: la
   siguiente sube desde abajo con el borde de píxeles (Blend) por delante, en su color, y la anterior se va un poco
   hacia arriba. Hacia atrás, al revés. Solo transform, con la curva de la landing. */
const PASO_MS = 950;

const MAIN = SLIDES.filter((s) => !s.annex).length;
const TONE_VAR = { band: '--band', paper: '--paper' };

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
  if (s.annex) return `Anexo ${i - MAIN + 1}`;
  return `${i + 1} / ${MAIN}`;
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Deck() {
  const [idx, setIdx] = useState(fromHash);
  const [move, setMove] = useState(null);
  /* después del primer paso, ninguna diapositiva repite la entrada escalonada */
  const [quietas, setQuietas] = useState(false);
  const [printing, setPrinting] = useState(() => document.documentElement.classList.contains('printing'));
  const [t0, setT0] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [idle, setIdle] = useState(false);
  const busy = useRef(false);
  const idxRef = useRef(idx);
  idxRef.current = idx;

  const go = useCallback((n) => {
    const to = Math.max(0, Math.min(SLIDES.length - 1, n));
    const from = idxRef.current;
    if (to === from || busy.current) return;
    setT0((v) => v ?? Date.now());
    history.replaceState(null, '', `#${to + 1}`);
    if (still()) { setIdx(to); return; }
    busy.current = true;
    setQuietas(true);
    setMove({ from, to, dir: to > from ? 1 : -1 });
    setIdx(to);
    setTimeout(() => { setMove(null); busy.current = false; }, PASO_MS);
  }, []);
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
    const onHash = () => setIdx(fromHash());
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
    if (!d || e.target.closest('a, button')) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && e.pointerType === 'mouse') {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.3) prev(); else next();
    }
  };

  const el = t0 ? now - t0 : 0;
  const tone = SLIDES[idx].tone;

  return (
    <div className={`deck tone-${tone}${idle ? ' idle' : ''}`}>
      <div className="stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} role="region" aria-roledescription="presentación" aria-label="Presentación de Priv8">
        {SLIDES.map((S, i) => {
          const on = i === idx;
          const sale = move && i === move.from;
          const entra = move && i === move.to;
          const paso = move ? (move.dir > 0 ? ' adelante' : ' atras') : '';
          return (
            <SlideCtx.Provider key={S.id} value={{ live: on || printing || !!sale, active: on && !printing, printing, n: label(i), annex: !!S.annex }}>
              <section className={`slide s-${S.tone}${on ? ' on' : ''}${quietas && !printing ? ' quieta' : ''}${S.annex ? ' annex' : ''}${sale ? ' sale' + paso : ''}${entra ? ' entra' + paso : ''}`} aria-hidden={!on && !printing} aria-roledescription="diapositiva" aria-label={label(i)} id={`d-${S.id}`}>
                {entra && (
                  <div className={`borde${move.dir > 0 ? '' : ' abajo'}`} aria-hidden="true" style={{ background: `var(${TONE_VAR[SLIDES[move.from].tone]})` }}>
                    <Blend from={TONE_VAR[SLIDES[move.from].tone]} to={TONE_VAR[S.tone]} seed={i + 3} overlay />
                  </div>
                )}
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
