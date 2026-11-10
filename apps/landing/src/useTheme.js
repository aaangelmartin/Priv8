import { useEffect, useState } from 'react';

const KEY = 'priv8-theme';
function read() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
function systemDark() { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }

/* Tema elegido (system | light | dark) y tema efectivo (light | dark). */
export function useTheme() {
  const [choice, setChoice] = useState(read);
  const [sys, setSys] = useState(systemDark);
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return undefined; }
    const on = () => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', choice);
    try { localStorage.setItem(KEY, choice); } catch (e) { /* sin almacenamiento */ }
  }, [choice]);
  const effective = choice === 'system' ? (sys ? 'dark' : 'light') : choice;
  const cycle = () => setChoice(effective === 'dark' ? 'light' : 'dark');
  return { effective, cycle };
}

export const PALETTE = {
  light: { page: '#E9EDF8', bg: '#FFFFFF', bg2: '#F4F6FD', band: '#2D45D6', ink: '#0B1B33', accent: '#2D45D6', navLight: '#FFFFFF', ok: '#1F8A5B', warn: '#A86400', bad: '#C23A2E' },
  dark: { page: '#050B20', bg: '#0D1740', bg2: '#13205A', band: '#1F33B0', ink: '#020617', accent: '#8FA2FF', navLight: '#0D1740', ok: '#4CC38A', warn: '#E3A447', bad: '#F07A6E' },
};
