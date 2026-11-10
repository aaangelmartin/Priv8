import { useEffect, useState } from 'react';

/* Estado compartido del 8 que acompaña por la web.
   - section: la sección visible (la fija el observador de secciones).
   - override: una cara que pide una demo durante un rato (enfado al bloquear, asentir al confirmar…). */
const state = { section: 'inicio', override: null };
const subs = new Set();
let timer = null;

function emit() { subs.forEach((fn) => fn({ ...state })); }

export function setSection(id) {
  if (state.section === id) return;
  state.section = id;
  emit();
}

/* Pide una cara durante ms milisegundos (0 = hasta que se quite con clearMood). */
export function mood(mode, ms = 2200) {
  state.override = mode;
  emit();
  clearTimeout(timer);
  if (ms > 0) timer = setTimeout(() => { state.override = null; emit(); }, ms);
}
export function clearMood() { clearTimeout(timer); state.override = null; emit(); }

export function useCompanion() {
  const [s, set] = useState({ ...state });
  useEffect(() => { subs.add(set); return () => subs.delete(set); }, []);
  return s;
}
