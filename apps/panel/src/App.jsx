import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Field, { Blend } from './Field.jsx';
import byLaaabs from './by-laaabs.svg';

/* Panel de la demo en directo (#169). Lo sirve scripts/panel.py en 127.0.0.1:5170 y lo abre
   «Demo Priv8.command» con doble clic. Un botón prepara B2B y otro B2C; el servidor arranca cada pieza
   y esta página pregunta su estado cada segundo. Mismo sistema que la landing y mcp.priv8.es. */

const DEMOS = {
  b2b: {
    title: 'B2B',
    sub: 'Priv8 para empresas',
    text: 'Alba Core con la sesión abierta, el correo con la factura y 8 esperando el encargo en la consola.',
    piezas: [['alba', 'Alba Core'], ['correo', 'Correo'], ['consola', 'Consola'], ['agente', '8']],
    botones: [['consola', 'Abrir la consola'], ['pantallas', 'Ver las pantallas']],
    pedidos: ['Registra la factura de Suministros Lumen que ha llegado por correo'],
    donde: 'La consola en una pantalla y Chromium, a pantalla completa, en la otra. Pídeselo a 8 en la consola.',
  },
  b2c: {
    title: 'B2C',
    sub: '8 en tu móvil',
    text: 'El emulador con la app Priv8 y los tres bancos, los puertos abiertos y 8 escuchando en el móvil.',
    piezas: [['emulador', 'Emulador'], ['puente', 'Puente'], ['consola', 'Consola'], ['agente', '8']],
    botones: [['movil', 'Ver el móvil']],
    pedidos: [],
    donde: 'Háblale o escríbele a 8 en la app Priv8 del emulador.',
  },
};

async function api(path, method = 'GET') {
  const r = await fetch(`/api/${path}`, { method, cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function useEstado() {
  const [estado, setEstado] = useState(null);
  const [caido, setCaido] = useState(false);
  useEffect(() => {
    let alive = true, t = 0;
    const tick = async () => {
      try { const e = await api('estado'); if (alive) { setEstado(e); setCaido(false); } } catch (e) { if (alive) setCaido(true); }
      if (alive) t = setTimeout(tick, 1000);
    };
    tick();
    return () => { alive = false; clearTimeout(t); };
  }, []);
  return [estado, caido, setEstado];
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

function Pedido({ text }) {
  const [ok, setOk] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button type="button" className={`pedido${ok ? ' pedido-ok' : ''}`} onClick={async () => {
      if (await copy(text)) { setOk(true); clearTimeout(t.current); t.current = setTimeout(() => setOk(false), 1600); }
    }} aria-label={`Copiar: ${text}`}>
      <span>{text}</span><i>{ok ? 'Copiado' : 'Copiar'}</i>
    </button>
  );
}

const FASE = { parado: 'Parada', preparando: 'Preparando', listo: 'Lista', error: 'No ha arrancado' };
const OJOS = { parado: 'mirar', preparando: 'cargando', listo: 'alegria', error: 'disculpa' };

function Demo({ id, estado, onAccion, busy }) {
  const d = DEMOS[id];
  // modos: las dos encendidas a la vez, solo para la imagen del README (scripts/banners.py)
  const activo = estado && (estado.modo === id || (estado.modos || []).includes(id));
  const fase = activo ? estado.fase : 'parado';
  const piezas = (activo && estado.piezas) || {};
  const otro = estado && estado.modo && estado.modo !== id;
  return (
    <li className={`demo demo-${fase}`}>
      <div className="demo-top">
        <div>
          <span className="demo-n">{d.title}</span>
          <p className="demo-sub">{d.sub}</p>
        </div>
        <Eight className="demo-eight" mode={OJOS[fase]} fg="#2D45D6" cut="#F4F6FD" label="8" />
      </div>
      <p className="demo-text">{d.text}</p>
      <ul className="piezas" aria-label="Piezas">
        {d.piezas.map(([k, nombre]) => (
          <li key={k} className={piezas[k] ? 'on' : ''}><span className="dot" aria-hidden="true" />{nombre}<span className="sr">{piezas[k] ? ' en marcha' : ' parada'}</span></li>
        ))}
      </ul>
      <div className="demo-actions">
        {activo && fase !== 'parado'
          ? <button type="button" className="btn btn-stop" disabled={busy} onClick={() => onAccion('parar')}>Parar</button>
          : <button type="button" className="btn btn-band" disabled={busy} onClick={() => onAccion(id)}>
              {otro ? `Cambiar a ${d.title}` : `Preparar ${d.title}`}
            </button>}
        <span className="fase" role="status" aria-live="polite">{FASE[fase]}</span>
      </div>
      {activo && fase === 'listo' && (
        <div className="listo">
          <div className="links">
            {d.botones.map(([a, t], i) => <button key={a} type="button" className={i === 0 ? 'btn btn-band' : 'btn btn-line'} onClick={() => onAccion(a)}>{t}</button>)}
          </div>
          <p className="donde">{d.donde}</p>
          {d.pedidos.length > 0 && <div className="pedidos">{d.pedidos.map((p) => <Pedido key={p} text={p} />)}</div>}
        </div>
      )}
      {activo && fase === 'error' && estado.motivo && <p className="motivo">{estado.motivo}</p>}
    </li>
  );
}

function Registro({ estado }) {
  const ref = useRef(null);
  const lineas = (estado && estado.log) || [];
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lineas.length]);
  if (!lineas.length) return null;
  return (
    <details className="registro">
      <summary>Lo que va pasando</summary>
      <pre ref={ref}>{lineas.join('\n')}</pre>
    </details>
  );
}

function Nav() {
  return (
    <nav className="nav" aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8, panel de la demo">
        <Eight className="nav-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
        <span className="word">Priv8</span>
        <span className="badge">DEMO</span>
      </a>
    </nav>
  );
}

export default function App() {
  const [estado, caido, setEstado] = useEstado();
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState('');
  const accion = async (a) => {
    setBusy(true); setAviso('');
    try { setEstado(await api(a, 'POST')); } catch (e) { setAviso(String(e.message || e)); }
    setBusy(false);
  };
  const ocupado = estado && estado.ocupado;
  return (
    <>
      <Nav />
      <main>
        <section id="inicio" className="hero hero-panel" aria-labelledby="h-hero">
          <Field />
          <div className="wrap hero-stage">
            <div id="hero-anchor" className="hero-anchor" aria-hidden="true">
              <Eight className="e8" mode={estado && estado.fase === 'listo' ? 'alegria' : 'mirar'} fg="#FFFFFF" cut="#2D45D6" label="8" />
            </div>
            <h1 id="h-hero"><span className="line">La demo,</span><span className="soft line">en directo.</span></h1>
            <p className="hero-sub">Un botón prepara cada parte. Cuando esté lista, abre la consola y pídele algo a 8.</p>
          </div>
        </section>
        <Blend from="--band" to="--paper" seed={1} overlay />
        <section className="block block-paper block-demos" aria-label="Demos">
          <div className="wrap">
            {caido && <p className="alerta">El panel no responde. Vuelve a abrir «Demo Priv8.command».</p>}
            {ocupado && <p className="alerta">Hay otro agente usando el puerto 8700 ({ocupado}). <button type="button" className="link" onClick={() => accion('liberar')} disabled={busy}>Pararlo</button></p>}
            {estado && !estado.clave && <p className="alerta">Falta ANTHROPIC_API_KEY en .env: 8 no podrá pensar. Copia .env.example a .env y pon la clave.</p>}
            {aviso && <p className="alerta">{aviso}</p>}
            <ol className="demos">
              <Demo id="b2b" estado={estado} onAccion={accion} busy={busy} />
              <Demo id="b2c" estado={estado} onAccion={accion} busy={busy} />
            </ol>
            <p className="nota">B2B y B2C usan el mismo 8: al preparar una, la otra se para.</p>
            <Registro estado={estado} />
          </div>
        </section>
      </main>
      <footer className="foot foot-small">
        <div className="wrap">
          <div className="foot-by-row">
            <a className="foot-by" href="https://laaabs.com" target="_blank" rel="noopener" aria-label="by laaabs" style={{ '--by': `url(${byLaaabs})` }} />
          </div>
          <div className="foot-word">
            <div className="spot-foot" aria-hidden="true"><Eight className="foot-word-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" /></div>
            <span>Priv8</span>
          </div>
        </div>
      </footer>
    </>
  );
}
