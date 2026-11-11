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
  light: { band: '#2D45D6', night: '#0B1B33', paper: '#FFFFFF', mist: '#EEF2FB', accent: '#2D45D6', ink: '#05101F', bg: '#FFFFFF', bg2: '#F4F6FD', ok: '#1F8A5B', warn: '#A86400', bad: '#C23A2E' },
  dark: { band: '#2238C4', night: '#050B1C', paper: '#0B1430', mist: '#0F1B3E', accent: '#8FA2FF', ink: '#02060F', bg: '#0B1430', bg2: '#13205A', ok: '#4CC38A', warn: '#E3A447', bad: '#F07A6E' },
};
