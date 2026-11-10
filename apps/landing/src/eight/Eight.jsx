import { useEffect, useRef } from 'react';
import { createEngine } from './engine.js';

let engine = null;
let fontsReady = null;
function getEngine() {
  if (!engine) engine = createEngine();
  return engine;
}
function waitFonts() {
  if (!fontsReady) {
    fontsReady = new Promise((resolve) => {
      const done = () => resolve();
      try {
        if (document.fonts && document.fonts.load) {
          Promise.all([document.fonts.load('700 300px Sora'), document.fonts.load('600 20px "IBM Plex Mono"')]).then(done, done);
          setTimeout(done, 2500);
        } else done();
      } catch (e) { done(); }
    });
  }
  return fontsReady;
}

/* 8 vivo. mode: estado del juego cerrado (mirar, ve, nove, nuncasale, apartar, hablar, …).
   fg: color de los ojos; cut: color del fondo que hay detrás. */
export default function Eight({ mode = 'mirar', fg, cut, className, label = '8, el agente de Priv8', onClick }) {
  const ref = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    let alive = true;
    waitFonts().then(() => {
      if (!alive || !ref.current) return;
      inst.current = getEngine().mount(ref.current, { mode, col: { fg, cut } });
      const svg = ref.current.querySelector('svg');
      if (svg) svg.setAttribute('aria-label', label);
    });
    return () => {
      alive = false;
      if (inst.current) getEngine().unmount(inst.current);
      inst.current = null;
      if (ref.current) ref.current.innerHTML = '';
    };
    // se vuelve a montar si cambian los colores (cambio de tema)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fg, cut]);

  useEffect(() => {
    if (inst.current && inst.current.mode !== mode) inst.current.setMode(mode);
  }, [mode]);

  return <div ref={ref} className={className} onClick={onClick} />;
}
