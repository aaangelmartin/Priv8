import { useEffect, useRef, useState } from 'react';
import { ASISTENTES, useTick } from './Asistentes.jsx';
import { CONECTAR, RUTA } from './conectar.jsx';
import Eight from './eight/Eight.jsx';
import Field, { Blend } from './Field.jsx';
import byLaaabs from './by-laaabs.svg';

/* mcp.priv8.es (#157, #195): prueba Priv8 CUA con tu propio asistente (Claude Code, Codex, Gemini CLI...).
   Priv8 es un servidor MCP local por stdio: vale para cualquier asistente que hable MCP en tu ordenador.
   Las transiciones entre colores son las de la landing (Blend en píxeles, mismas semillas y orden). */

const SITE = 'https://mcp.priv8.es';
const REPO = 'https://github.com/aaangelmartin/Priv8';
const HOME = 'https://priv8.es';
const DIR = '~/.priv8/mcp';

const LOCAL = typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname);
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : SITE;
const INSTALAR = LOCAL ? `curl -fsSL ${ORIGIN}/instalar.sh | PRIV8_MCP_URL=${ORIGIN} bash` : `curl -fsSL ${SITE}/instalar.sh | bash`;

const PEDIDO = 'Registra en Alba Core la factura que ha llegado por correo de Suministros Lumen';
const INSTALA = { n: '1', title: 'Instala', text: 'Un comando: descarga Priv8, comprueba su suma, instala lo que necesita y lo registra en Claude Code, Codex y Gemini CLI si los tienes.', cmd: INSTALAR, mode: 'cargando' };
const PIDE = { n: '3', title: 'Pide', text: 'Abre tu asistente en cualquier carpeta y pídele esto. Lo que haya que aprobar te espera en la consola de Priv8.', cmd: PEDIDO, prompt: '>', mode: 'leer' };

const Tok = ({ children }) => <span className="tok">{children}</span>;

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(t);
      return ok;
    } catch (e2) { return false; }
  }
}

function useCopy(text) {
  const [state, setState] = useState('idle');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const go = async () => {
    const ok = await copy(text);
    setState(ok ? 'ok' : 'err');
    clearTimeout(t.current);
    t.current = setTimeout(() => setState('idle'), 2000);
  };
  return [state, go];
}
const copyLabel = (state) => (state === 'ok' ? 'Copiado' : state === 'err' ? 'Cópialo a mano' : 'Copiar');

/* el comando de instalación, grande, en la portada */
function HeroCmd() {
  const [state, go] = useCopy(INSTALAR);
  return (
    <div className="cmd cmd-hero">
      <code><span className="cmd-prompt" aria-hidden="true">$</span>{INSTALAR}</code>
      <button type="button" className={`copy copy-${state}`} onClick={go} aria-label="Copiar el comando de instalación">{copyLabel(state)}</button>
      <span className="sr" role="status" aria-live="polite">{state === 'ok' ? 'Copiado al portapapeles' : ''}</span>
    </div>
  );
}

function Step({ n, title, text, cmd, prompt = '$', mode }) {
  const [state, go] = useCopy(cmd);
  return (
    <li className="step step-row">
      <div className="step-top">
        <span className="step-n" aria-hidden="true">{n}</span>
        <Eight className="step-eight" mode={state === 'ok' ? 'listo' : mode} fg="#2D45D6" cut="#F4F6FD" label="8" />
      </div>
      <div className="step-body">
      <h3>{title}</h3>
      <p className="step-text">{text}</p>
      </div>
      <div className="cmd">
        <code><span className="cmd-prompt" aria-hidden="true">{prompt}</span>{cmd}</code>
        <button type="button" className={`copy copy-${state}`} onClick={go} aria-label={`Copiar el paso ${n}`}>
          {copyLabel(state)}
        </button>
        <span className="sr" role="status" aria-live="polite">{state === 'ok' ? 'Copiado al portapapeles' : ''}</span>
      </div>
    </li>
  );
}

function Nav() {
  return (
    <nav className="nav" aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8 MCP, inicio">
        <Eight className="nav-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
        <span className="word">Priv8</span>
        <span className="badge">MCP</span>
      </a>
      <a className="pill" href="#pasos">Instalar</a>
    </nav>
  );
}

/* «con tu ⟨icono⟩ Claude Code.»: el rotador del hero de la landing, letra a letra, con el icono a la izquierda.
   Mismo reloj que los botones «Pruébalo en tu» (useTick, 2200 ms). */
function Rotator() {
  const i = useTick() % ASISTENTES.length;
  const box = useRef(null);
  const mide = () => {
    const el = box.current;
    const item = el && el.querySelectorAll('.rot-item')[i];
    if (item) el.style.width = item.scrollWidth + 'px';
  };
  useEffect(mide, [i]);
  useEffect(() => {
    window.addEventListener('resize', mide);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(mide);
    return () => window.removeEventListener('resize', mide);
  });
  const n = ASISTENTES.length;
  return (
    <span className="rotator" ref={box}>
      {ASISTENTES.map((a, k) => (
        <span key={a.nombre} className={'rot-item' + (k === i ? ' on' : k === (i + n - 1) % n ? ' out' : '')} aria-hidden={k !== i}>
          <span className="ch rot-ico" style={{ '--j': 0 }}><i style={{ '--ico': `url("${a.icono}")` }} /></span><span className="ch" style={{ '--j': 0 }}>{'\u00a0'}</span>
          {Array.from(a.nombre + '.').map((ch, j) => <span key={j} className="ch" style={{ '--j': j + 1 }}>{ch === ' ' ? '\u00a0' : ch}</span>)}
        </span>
      ))}
    </span>
  );
}

function Hero() {
  /* 8 saluda al abrir (la intro de todo Priv8), y luego lee, tapa lo que no debe ver y vuelve a mirarte */
  const [mode, setMode] = useState('saludar');
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    if (still) { setMode('mirar'); return undefined; }
    const seq = [['mirar', 3600], ['leer', 2600], ['nove', 2200]];
    let i = 0, t = 0;
    const next = () => { const [m, d] = seq[i % seq.length]; i += 1; setMode(m); t = setTimeout(next, d); };
    t = setTimeout(next, 2400);
    return () => clearTimeout(t);
  }, []);
  return (
    <section id="inicio" className="hero" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-stage">
        <div id="hero-anchor" className="hero-anchor" aria-hidden="true">
          <Eight className="e8" mode={mode} fg="#FFFFFF" cut="#2D45D6" label="8" />
        </div>
        <h1 id="h-hero" aria-label={`Prueba Priv8 con tu asistente: ${ASISTENTES.map((a) => a.nombre).join(', ')}`}>
          <span className="line" aria-hidden="true">Prueba Priv8</span>
          <span className="soft line" aria-hidden="true">con tu <Rotator /></span>
        </h1>
        <p className="hero-sub">Tu asistente hace un trámite en un ERP y un correo de prueba sin ver los datos.</p>
        <div className="hero-cmd"><HeroCmd /></div>
        <Funciona />
      </div>
    </section>
  );
}

/* la fila de iconos: con qué asistentes funciona */
function Funciona() {
  return (
    <div className="works">
      <span className="works-h">Funciona con</span>
      <ul className="works-list">
        {ASISTENTES.map((a) => (
          <li key={a.nombre}><i style={{ '--ico': `url("${a.icono}")` }} aria-hidden="true" />{a.nombre}</li>
        ))}
        <li className="works-more">y cualquier asistente MCP</li>
      </ul>
    </div>
  );
}

/* paso 2: cómo conectar Priv8 a cada asistente, en pestañas con su icono */
function Conecta() {
  const [sel, setSel] = useState(0);
  const a = CONECTAR[sel];
  const [state, go] = useCopy(a.cmd);
  const tabs = useRef([]);
  const onKey = (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const k = (sel + d + CONECTAR.length) % CONECTAR.length;
    setSel(k);
    tabs.current[k] && tabs.current[k].focus();
  };
  return (
    <li className="step step-wide">
      <div className="step-top">
        <span className="step-n" aria-hidden="true">2</span>
        <Eight className="step-eight" mode={state === 'ok' ? 'listo' : 'escuchar'} fg="#2D45D6" cut="#F4F6FD" label="8" />
      </div>
      <h3>Conecta tu asistente</h3>
      <p className="step-text">Priv8 es un servidor MCP local: tu asistente lo arranca con <code>{RUTA} mcp</code>. Si usas Claude Code, Codex o Gemini CLI, el instalador ya lo ha hecho. Si no, elige el tuyo.</p>
      <div className="tabs" role="tablist" aria-label="Asistente" onKeyDown={onKey}>
        {CONECTAR.map((c, k) => (
          <button key={c.id} ref={(el) => { tabs.current[k] = el; }} type="button" role="tab" id={`tab-${c.id}`}
                  aria-selected={k === sel} aria-controls="panel-conecta" tabIndex={k === sel ? 0 : -1}
                  className={'tab' + (k === sel ? ' on' : '')} onClick={() => setSel(k)}>
            {c.icono ? <i style={{ '--ico': `url("${c.icono}")` }} aria-hidden="true" /> : <b className="tab-gen" aria-hidden="true">MCP</b>}
            {c.nombre}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id="panel-conecta" aria-labelledby={`tab-${a.id}`}>
        <p className="step-text">{a.texto}{a.auto && <span className="auto"> El instalador lo hace por ti si encuentra <code>{a.abre}</code>.</span>}</p>
        <div className="cmd">
          <code>{!a.json && <span className="cmd-prompt" aria-hidden="true">$</span>}{a.cmd}</code>
          <button type="button" className={`copy copy-${state}`} onClick={go} aria-label={`Copiar la configuración de ${a.nombre}`}>{copyLabel(state)}</button>
          <span className="sr" role="status" aria-live="polite">{state === 'ok' ? 'Copiado al portapapeles' : ''}</span>
        </div>
        <a className="doc" href={a.doc} target="_blank" rel="noopener">Documentación de {a.id === 'otro' ? 'MCP' : a.nombre}</a>
      </div>
    </li>
  );
}

function Pasos() {
  return (
    <section id="pasos" className="block block-paper" aria-labelledby="h-pasos">
      <div className="wrap">
        <div className="block-head">
          <h2 id="h-pasos">Tres pasos. <span className="soft">Cinco minutos.</span></h2>
          <p className="lead">macOS o Linux, con <a href="https://docs.astral.sh/uv/">uv</a> y un asistente que hable MCP. Sin claves nuestras: el modelo es el tuyo.</p>
        </div>
        <ol className="steps"><Step {...INSTALA} /><Conecta /><Step {...PIDE} /></ol>
        {LOCAL && <p className="local">Vista local: el comando instala desde este servidor en lugar de mcp.priv8.es.</p>}
      </div>
    </section>
  );
}

const SEE = [
  ['leer', 'Chromium hace el trámite', 'Se abre una ventana con el cursor de 8. Ahí ves los datos reales: es tu ordenador.'],
  ['nove', 'El modelo solo ve tokens', <>Le llega <Tok>‹FACTURA_1-correo›</Tok> en lugar del número. El valor lo escribe Priv8 en local.</>],
  ['permiso', 'Tú apruebas', 'Registrar o enviar espera en la consola de Priv8, en tu navegador, hasta que dices que sí.'],
];
function Veras() {
  return (
    <section id="veras" className="block block-cobalt" aria-labelledby="h-veras">
      <div className="wrap">
        <div className="block-head">
          <h2 id="h-veras">Qué vas a ver.</h2>
        </div>
        <ul className="see">
          {SEE.map(([m, t, d]) => (
            <li key={t}>
              <Eight className="see-eight" mode={m} fg="#2D45D6" cut="#FFFFFF" label="8" />
              <b>{t}</b><p>{d}</p>
            </li>
          ))}
        </ul>
        <p className="caveat">Priv8 protege lo que el agente lee y escribe en pantalla. Lo que tú escribes en el chat de tu asistente llega a tu modelo tal cual: no pegues ahí datos reales.</p>
      </div>
    </section>
  );
}

function useChecksum() {
  const [sum, setSum] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('./priv8-mcp.tar.gz.sha256', { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => { const s = t && t.trim().split(/\s+/)[0]; if (alive && s && /^[0-9a-f]{64}$/.test(s)) setSum(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return sum;
}

function Detalles() {
  const sum = useChecksum();
  return (
    <section id="detalles" className="block block-paper block-small" aria-labelledby="h-detalles">
      <div className="wrap faq-grid">
        <h2 id="h-detalles" className="small-h">Detalles</h2>
        <div className="faq">
          <details>
            <summary>Qué se instala y cómo quitarlo</summary>
            <ul className="mini">
              <li>Todo va en <code>{DIR}</code>: el código de Priv8 (1 MB), sus dependencias de Python con uv (unos 170 MB) y el Chromium de Playwright (unos 350 MB). Si no tienes Python 3.12, uv lo descarga a su caché.</li>
              <li>Si encuentra Claude Code, Codex o Gemini CLI, registra Priv8 en cada uno para tu usuario (<code>claude mcp add</code>, <code>codex mcp add</code>, <code>gemini mcp add</code>). Si ya tienes un servidor llamado priv8, no lo toca. Para el resto te dice cómo hacerlo.</li>
              <li>No usa sudo, no toca tu PATH y no pide ninguna clave. Puedes <a href={`${SITE}/instalar.sh`}>leer el instalador</a> y lanzarlo otra vez para actualizar.</li>
              <li>Solo escucha en 127.0.0.1: 5173, 5174 y 5175 para las apps de prueba y 8700 para la consola.</li>
              <li>Para quitarlo: quita priv8 de tu asistente (por ejemplo <code>claude mcp remove priv8 --scope user</code>, <code>codex mcp remove priv8</code> o <code>gemini mcp remove --scope user priv8</code>) y borra la carpeta, <code>rm -rf {DIR}</code></li>
              {sum && <li>SHA-256 del paquete: <code>{sum}</code></li>}
            </ul>
          </details>
          <details>
            <summary>Qué no protege</summary>
            <ul className="mini">
              <li>Lo que escribes en el chat de tu asistente, ni otras herramientas o servidores MCP que use.</li>
              <li>El registro firmado guarda las tres herramientas de Priv8, no la conversación.</li>
              <li>Es una demo con datos inventados: solo conoce Alba Core y el correo de prueba.</li>
            </ul>
          </details>
          <details>
            <summary>Si algo no va</summary>
            <ul className="mini">
              <li><b>Tu asistente dice que priv8 ha fallado</b> (en Claude Code, <code>/mcp</code>): lánzalo a mano para ver el motivo, <code>{DIR}/priv8-mcp mcp</code>. Suele ser el puerto 8700 ocupado.</li>
              <li><b>Puertos ocupados:</b> vuelve a registrarlo con las variables <code>PRIV8_EVENTS_PORT</code> y <code>PRIV8_CONSOLE_PORT</code>, por ejemplo en Claude Code <code>claude mcp remove priv8 --scope user && claude mcp add --scope user priv8 -e PRIV8_EVENTS_PORT=8790 -e PRIV8_CONSOLE_PORT=5185 -- {DIR}/priv8-mcp mcp</code></li>
              <li><b>No se abre la consola:</b> ábrela en <code>http://127.0.0.1:5175</code>.</li>
              <li><b>Tu asistente se queda esperando:</b> hay algo retenido. Apruébalo en la consola y dile que siga.</li>
              <li><b>Alba Core pide clave:</b> abre <code>http://127.0.0.1:5173/reset</code> en la ventana de Chromium.</li>
              <li><b>Linux sin Chromium:</b> <code>sudo {DIR}/.venv/bin/python -m playwright install-deps chromium</code></li>
              <li><b>Sin uv:</b> <code>curl -LsSf https://astral.sh/uv/install.sh | sh</code></li>
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}

/* cierre cobalto, como el de la landing: una línea y el mismo comando */
function Cierre() {
  return (
    <section id="cierre" className="block block-cobalt close" aria-labelledby="h-cierre">
      <div className="wrap close-in">
        <Eight className="close-eight" mode="alegria" fg="#FFFFFF" cut="#2D45D6" label="8" />
        <h2 id="h-cierre">Pruébalo ahora. <span className="soft">Es un comando.</span></h2>
        <div className="hero-cmd"><HeroCmd /></div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-mid">
          <div className="foot-brand">
            <a className="foot-logo" href="#inicio" aria-label="Priv8, volver arriba">
              <Eight className="foot-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
              <span>Priv8</span>
            </a>
            <p>Privacidad para agentes de IA que usan pantallas. El modelo trabaja con tokens; los datos se quedan contigo.</p>
          </div>
          <nav className="foot-cols" aria-label="Pie">
            <div><b>Probar</b><a href="#pasos">Pasos</a><a href="#pasos">Conectar tu asistente</a><a href="#veras">Qué vas a ver</a><a href="#detalles">Detalles</a></div>
            <div><b>Priv8</b><a href={HOME}>priv8.es</a><a href={REPO}>Código</a></div>
            <div><b>Instalar</b><a href={`${SITE}/instalar.sh`}>El instalador</a><a href="./priv8-mcp.tar.gz">El paquete</a></div>
          </nav>
        </div>
        {/* firma de quien lo hace, como en la landing: el vector de laaabs, centrado, encima del nombre grande */}
        <div className="foot-by-row">
          <a className="foot-by" href="https://laaabs.com" target="_blank" rel="noopener" aria-label="by laaabs" style={{ '--by': `url("${byLaaabs}")` }} />
        </div>
        <div className="foot-word">
          {/* el sitio de 8 es el .spot-foot de la landing; 8 va encima como el Companion al aterrizar */}
          <div className="spot-foot" aria-hidden="true"><Eight className="foot-word-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" /></div>
          <span>Priv8</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Blend from="--band" to="--paper" seed={1} overlay />
        <Pasos />
        <Blend from="--paper" to="--band" seed={3} />
        <Veras />
        <Blend from="--band" to="--paper" seed={5} />
        <Detalles />
        <Blend from="--paper" to="--band" seed={8} />
        <Cierre />
        <Blend from="--band" to="--paper" seed={9} />
      </main>
      <Footer />
    </>
  );
}
