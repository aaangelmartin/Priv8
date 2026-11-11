import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/* «Pruébalo en tu …» con el asistente que va cambiando, cada uno con su icono a la izquierda.
   Priv8 es un servidor MCP local: vale para cualquier asistente que hable MCP en tu ordenador.
   Iconos: Simple Icons (CC0) y LobeHub Icons (MIT) para Grok. */
const icono = (n) => new URL(`./ia/${n}.svg`, import.meta.url).href;

export const ASISTENTES = [
  ['Claude Code', 'claude'],
  ['Codex', 'openai'],
  ['Gemini CLI', 'googlegemini'],
  ['Grok CLI', 'grok'],
  ['Cursor', 'cursor'],
  ['opencode', 'opencode'],
].map(([nombre, n]) => ({ nombre, icono: icono(n) }));

/* Un solo reloj para la página: el titular del hero y los botones cambian en el mismo instante. */
export const PASO_MS = 2200;
let tick = 0;
const subs = new Set();
let reloj = null;
function suscribe(fn) {
  // el primero que se suscribe arranca el reloj desde cero: la página empieza siempre en Claude Code
  if (!reloj) { tick = 0; subs.forEach((f) => f(0)); }
  subs.add(fn);
  fn(tick);
  if (!reloj) {
    // con la bienvenida de la landing (html.intro, 2,65 s) el reloj espera a que termine: el primer cambio
    // llega un paso después de que se vea el hero, y se ve Claude Code entero
    const espera = document.documentElement.classList.contains('intro') ? 2650 : 0;
    const arranca = () => { reloj = setInterval(() => { tick += 1; subs.forEach((f) => f(tick)); }, PASO_MS); };
    reloj = setTimeout(arranca, espera);
  }
  return () => { subs.delete(fn); if (!subs.size) { clearTimeout(reloj); clearInterval(reloj); reloj = null; } };
}
export function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    if (still) return undefined;
    return suscribe(setT);
  }, []);
  return t;
}
export function useAsistente() {
  return useTick() % ASISTENTES.length;
}

/* El hueco mide lo que el asistente que se ve: el botón crece y encoge con él, como el titular del hero. */
export function RotaAsistente() {
  const i = useAsistente();
  const box = useRef(null);
  const mide = () => {
    const el = box.current;
    const item = el && el.children[i];
    if (item) el.style.width = `${item.scrollWidth}px`;
  };
  useLayoutEffect(mide, [i]);
  useEffect(() => {
    window.addEventListener('resize', mide);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(mide);
    return () => window.removeEventListener('resize', mide);
  });
  return (
    <span className="ia-rot" ref={box} aria-hidden="true">
      {ASISTENTES.map((a, k) => (
        <span key={a.nombre} className={'ia' + (k === i ? ' on' : '')}>
          <i style={{ '--ico': `url(${a.icono})` }} />{'\u00a0'}{a.nombre}
        </span>
      ))}
    </span>
  );
}

export default function Pruebalo({ className = 'btn btn-ghost', href = 'https://mcp.priv8.es' }) {
  return (
    <a className={className + ' pruebalo'} href={href} target="_blank" rel="noopener"
       aria-label="Pruébalo en tu asistente: Claude Code, Codex, Gemini CLI, Grok CLI, Cursor u opencode">
      <span aria-hidden="true">Pruébalo en tu{'\u00a0'}</span>
      <RotaAsistente />
    </a>
  );
}
