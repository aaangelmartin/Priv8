import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Field, { Blend } from './Field.jsx';
import byLaaabs from './by-laaabs.svg';
import catalogo from '../../../data/casos.json';

/* Panel de la demo en directo (#169). Lo sirve scripts/panel.py en 127.0.0.1:5170 y lo abre
   «Demo Priv8.command» con doble clic. Un botón prepara B2B y otro B2C; el servidor arranca cada pieza
   y esta página pregunta su estado cada segundo. Mismo sistema que la landing y mcp.priv8.es.
   Con la demo lista, los casos preparados (data/casos.json, #187) se le piden a 8 con un clic. */

const CONSOLA = 'http://127.0.0.1:5175';
const PEDIDOS = (v) => catalogo.casos.filter((c) => c.vertical === v && c.pedido);
const SIN_PEDIDO = (v) => catalogo.casos.filter((c) => c.vertical === v && !c.pedido && c.feed);

const DEMOS = {
  b2b: {
    title: 'B2B',
    sub: 'Priv8 para empresas',
    text: 'Alba Core con la sesión abierta, el correo con la factura y 8 esperando el encargo en la consola.',
    piezas: [['alba', 'Alba Core'], ['correo', 'Correo'], ['consola', 'Consola'], ['agente', '8']],
    botones: [['consola', 'Abrir la consola'], ['pantallas', 'Ver las pantallas']],
    donde: 'La consola en una pantalla y Chromium, a pantalla completa, en la otra. Pide un caso aquí o escríbeselo a 8 en la consola.',
  },
  b2c: {
    title: 'B2C',
    sub: '8 en tu móvil',
    text: 'El emulador con la app Priv8 y los tres bancos, los puertos abiertos y 8 escuchando en el móvil.',
    piezas: [['emulador', 'Emulador'], ['puente', 'Puente'], ['consola', 'Consola'], ['agente', '8']],
    botones: [['movil', 'Ver el móvil']],
    donde: 'Pide un caso aquí, o háblale o escríbele a 8 en la app Priv8 del emulador.',
  },
};

async function api(path, method = 'GET', body) {
  const r = await fetch(`/api/${path}`, {
    method, cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = t;
    try { msg = JSON.parse(t).error || t; } catch (e) { /* texto tal cual */ }
    throw new Error(msg);
  }
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

function useMarca() {
  const [on, setOn] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return [on, () => { setOn(true); clearTimeout(t.current); t.current = setTimeout(() => setOn(false), 1800); }];
}

function Caso({ caso, onPedir, busy }) {
  const [enviado, marcaEnviado] = useMarca();
  const [copiado, marcaCopiado] = useMarca();
  return (
    <li className={`caso${enviado ? ' caso-ok' : ''}`}>
      <div className="caso-body">
        <h3 className="caso-t">{caso.titulo}</h3>
        <p className="caso-pedido">«{caso.pedido}»</p>
        <p className="caso-que">{caso.que}</p>
        {caso.en_login && <p className="caso-nota">Antes, deja Banca Alcor en su pantalla de entrada.</p>}
      </div>
      <div className="caso-actions">
        <button type="button" className="btn btn-band btn-sm" disabled={busy} aria-label={`Pedir a 8: ${caso.pedido}`}
          onClick={async () => { if (await onPedir(caso.id)) marcaEnviado(); }}>
          {enviado ? 'Pedido enviado' : 'Pedir a 8'}
        </button>
        <button type="button" className="btn btn-line btn-sm" aria-label={`Copiar: ${caso.pedido}`}
          onClick={async () => { if (await copy(caso.pedido)) marcaCopiado(); }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </li>
  );
}

function Casos({ vertical, onPedir, busy }) {
  const lista = PEDIDOS(vertical);
  const aparte = SIN_PEDIDO(vertical);
  if (!lista.length) return null;
  return (
    <div className="casos-wrap">
      <p className="casos-h">Casos preparados</p>
      <ul className="casos">
        {lista.map((c) => <Caso key={c.id} caso={c} onPedir={onPedir} busy={busy} />)}
      </ul>
      {aparte.map((c) => (
        <p key={c.id} className="caso-aparte">
          <a href={`${CONSOLA}/?feed=${encodeURIComponent(c.feed)}`} target="_blank" rel="noopener">{c.titulo}</a>: {c.que}
        </p>
      ))}
    </div>
  );
}

const FASE = { parado: 'Parada', preparando: 'Preparando', listo: 'Lista', error: 'No ha arrancado' };
const OJOS = { parado: 'mirar', preparando: 'cargando', listo: 'alegria', error: 'disculpa' };

function Demo({ id, estado, onAccion, onPedir, busy }) {
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
          <Casos vertical={id} onPedir={onPedir} busy={busy} />
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
  const pedir = async (id) => {
    setBusy(true); setAviso('');
    let ok = false;
    try { setEstado(await api('caso', 'POST', { id })); ok = true; } catch (e) { setAviso(String(e.message || e)); }
    setBusy(false);
    return ok;
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
            <p className="hero-sub">Un botón prepara cada parte. Cuando esté lista, pídele a 8 uno de los casos preparados.</p>
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
              <Demo id="b2b" estado={estado} onAccion={accion} onPedir={pedir} busy={busy} />
              <Demo id="b2c" estado={estado} onAccion={accion} onPedir={pedir} busy={busy} />
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
