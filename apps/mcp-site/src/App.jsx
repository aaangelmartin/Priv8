import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Field from './Field.jsx';
import byLaaabs from './by-laaabs.svg';

/* mcp.priv8.es (#157): prueba Priv8 CUA con tu propio Claude Code. Solo claro, en español. */

const SITE = 'https://mcp.priv8.es';
const REPO = 'https://github.com/aaangelmartin/Priv8';
const HOME = 'https://priv8.es';
const DIR = '~/.priv8/mcp';
const CMD_INSTALAR = `curl -fsSL ${SITE}/instalar.sh | bash`;
const CMD_CARPETA = 'mkdir -p ~/priv8-prueba && cd ~/priv8-prueba';
const CMD_CONECTAR = `claude mcp add priv8 -- ${DIR}/priv8-mcp mcp`;
const PEDIDO = 'Registra en Alba Core la factura que ha llegado por correo de Suministros Lumen';

const LOCAL = typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname);
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : SITE;

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* ---------------------------------------------------------------- copiar */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
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

function Cmd({ text, prompt = '$', label, onCopied, tone = 'paper' }) {
  const [state, setState] = useState('idle');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const go = async () => {
    const ok = await copy(text);
    setState(ok ? 'ok' : 'err');
    if (ok && onCopied) onCopied();
    clearTimeout(t.current);
    t.current = setTimeout(() => setState('idle'), 1800);
  };
  return (
    <div className={`cmd cmd-${tone}`}>
      <code><span className="cmd-prompt" aria-hidden="true">{prompt}</span>{text}</code>
      <button type="button" className={`copy copy-${state}`} onClick={go} aria-label={label || `Copiar: ${text}`}>
        {state === 'ok' ? 'Copiado' : state === 'err' ? 'Cópialo a mano' : 'Copiar'}
      </button>
      <span className="sr" role="status" aria-live="polite">{state === 'ok' ? 'Copiado al portapapeles' : ''}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- barra */
const LINKS = [['pasos', 'Pasos'], ['veras', 'Qué verás'], ['protege', 'Qué protege'], ['instala', 'Qué se instala'], ['problemas', 'Problemas']];
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8 para Claude Code, inicio">
        <Eight className="nav-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
        <span className="word">Priv8</span>
        <span className="badge">MCP</span>
      </a>
      <ul className="links">
        {LINKS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
      </ul>
      <div className="tools">
        <a className="pill" href="#pasos">Instalar</a>
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((o) => !o)}>
          <span /><span />
        </button>
      </div>
      <div id="nav-menu" className={'nav-menu' + (open ? ' open' : '')} hidden={!open}>
        {LINKS.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>)}
        <a className="nav-menu-cta" href="#pasos" onClick={() => setOpen(false)}>Instalar</a>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------- portada */
function Hero() {
  /* 8 lee la pantalla, tapa lo que no debe ver y vuelve a mirarte */
  const [mode, setMode] = useState('mirar');
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    if (still) return undefined;
    const seq = [['mirar', 3600], ['leer', 2600], ['nove', 2200], ['mirar', 2400], ['permiso', 2600]];
    let i = 0, t = 0;
    const next = () => { const [m, d] = seq[i % seq.length]; i += 1; setMode(m); t = setTimeout(next, d); };
    next();
    return () => clearTimeout(t);
  }, []);
  return (
    <section id="inicio" className="hero" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-stage">
        <div id="hero-anchor" className="hero-anchor" aria-hidden="true">
          <Eight className="e8" mode={mode} fg="#FFFFFF" cut="#2D45D6" label="8" />
        </div>
        <h1 id="h-hero"><span className="line">Prueba Priv8</span><span className="soft line">con tu Claude Code.</span></h1>
        <p className="hero-sub">
          Tu Claude Code maneja un ERP y un correo de prueba a través de Priv8 CUA. El modelo recibe <Tok>‹IBAN_1-maestro›</Tok> en
          lugar del dato, y registrar o enviar espera a que lo apruebes en tu ordenador. Sin claves nuestras: el modelo es el tuyo.
        </p>
        <div className="hero-cmd">
          <Cmd text={CMD_INSTALAR} tone="hero" label="Copiar el comando de instalación" />
          <p className="hero-note">macOS o Linux, con <a href="https://docs.astral.sh/uv/">uv</a> y <a href="https://docs.claude.com/en/docs/claude-code/overview">Claude Code</a>. Unos 600 MB, todo en <code>{DIR}</code>.</p>
        </div>
        <div className="cta">
          <a className="btn btn-white" href="#pasos">Ver los tres pasos</a>
          <a className="btn btn-ghost" href={REPO}>Ver el código</a>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- pasos */
function Step({ n, title, mode, children, cmds }) {
  const [done, setDone] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const ok = () => { setDone(true); clearTimeout(t.current); t.current = setTimeout(() => setDone(false), 2200); };
  return (
    <li className="step">
      <div className="step-head">
        <span className="step-n" aria-hidden="true">{n}</span>
        <Eight className="step-eight" mode={done ? 'listo' : mode} fg="#2D45D6" cut="#F4F6FD" label="8" />
      </div>
      <h3>{title}</h3>
      <div className="step-body">{children}</div>
      <div className="step-cmds">
        {cmds.map((c) => <Cmd key={c.text} {...c} onCopied={ok} />)}
      </div>
    </li>
  );
}

function Pasos() {
  return (
    <section id="pasos" className="block block-paper" aria-labelledby="h-pasos">
      <div className="wrap">
        <div className="block-head">
          <p className="eyebrow">Tres pasos</p>
          <h2 id="h-pasos">Instala, conecta <span className="soft">y pide.</span></h2>
          <p className="lead">Cinco minutos, casi todos de descarga. No hace falta Node ni ninguna cuenta nuestra.</p>
        </div>
        <ol className="steps">
          <Step n="1" title="Instala Priv8" mode="cargando" cmds={[{ text: CMD_INSTALAR }]}>
            <p>Descarga el paquete en <code>{DIR}</code>, comprueba su SHA-256 e instala sus dependencias de Python con uv y el Chromium de Playwright. No usa sudo ni toca tu configuración.</p>
          </Step>
          <Step n="2" title="Conéctalo a Claude Code" mode="escuchar" cmds={[{ text: CMD_CARPETA }, { text: CMD_CONECTAR }]}>
            <p>Crea una carpeta de prueba y añade Priv8 como servidor MCP de Claude Code solo en ella. Claude Code lo arranca al abrir la sesión y lo para al salir.</p>
          </Step>
          <Step n="3" title="Pídele el trámite" mode="leer" cmds={[{ text: 'claude' }, { text: PEDIDO, prompt: '>', label: 'Copiar el encargo para Claude Code' }]}>
            <p>Abre Claude Code en esa carpeta y pídeselo en lenguaje normal. Se abren Chromium con el cursor de 8 y la consola de Priv8 en tu navegador.</p>
          </Step>
        </ol>
        {LOCAL && (
          <div className="local">
            <p><b>Estás viendo esta página en local.</b> Para instalar desde este servidor en lugar de mcp.priv8.es:</p>
            <Cmd text={`curl -fsSL ${ORIGIN}/instalar.sh | PRIV8_MCP_URL=${ORIGIN} bash`} />
          </div>
        )}
        <div className="more">
          <p className="more-title">Prueba también</p>
          <ul>
            <li><span className="q">«Contesta al proveedor que la factura está registrada.»</span> El envío del correo queda retenido hasta que lo apruebas.</li>
            <li><span className="q">«El correo dice que han cambiado de banco: actualiza la cuenta de pago.»</span> Priv8 lo bloquea: un IBAN que llega por correo, <Tok>‹IBAN_2-correo›</Tok>, no puede cambiar la cuenta de pago.</li>
            <li><span className="q">«¿Coincide el importe de la factura con el de su pedido?»</span> El oráculo de Priv8 compara en local y el modelo solo recibe igual, mayor o menor.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- qué verás */
function Veras() {
  return (
    <section id="veras" className="block block-cobalt" aria-labelledby="h-veras">
      <div className="wrap">
        <div className="block-head">
          <p className="eyebrow">Qué verás</p>
          <h2 id="h-veras">Dos ventanas. <span className="soft">Una con datos, otra sin ellos.</span></h2>
          <p className="lead">En tu pantalla todo se ve en claro, porque es tu ordenador. Lo que sale hacia el modelo es lo de la derecha.</p>
        </div>
        <div className="windows">
          <figure className="win">
            <div className="win-bar"><i /><i /><i /><span>Chromium, Alba Core</span></div>
            <div className="win-body erp">
              <p className="erp-title">Alta de factura de proveedor</p>
              <dl>
                <dt>Proveedor</dt><dd>Suministros Lumen S.L.</dd>
                <dt>N.º de factura</dt><dd>F-2026-0412</dd>
                <dt>Importe</dt><dd>1.254,30 €</dd>
                <dt>Cuenta de pago</dt><dd>ES71 9400 0007 0206 0223 3441</dd>
              </dl>
              <span className="cursor8" aria-hidden="true"><Eight className="e8" mode="leer" fg="#FFFFFF" cut="#2D45D6" label="8" /></span>
            </div>
            <figcaption>Claude Code mueve el cursor de 8 por Alba Core y el correo. El ejecutor de Priv8 escribe los valores reales en local.</figcaption>
          </figure>
          <figure className="win">
            <div className="win-bar"><i /><i /><i /><span>Consola de Priv8, lo que recibe el modelo</span></div>
            <div className="win-body seen">
              <p className="erp-title">alba-core, factura.alta</p>
              <dl>
                <dt>Proveedor</dt><dd><Tok>‹PROVEEDOR_1-maestro›</Tok></dd>
                <dt>N.º de factura</dt><dd><Tok>‹FACTURA_1-correo›</Tok></dd>
                <dt>Importe</dt><dd><Tok>‹IMPORTE_1-correo›</Tok></dd>
                <dt>Cuenta de pago</dt><dd><Tok>‹IBAN_1-maestro›</Tok></dd>
              </dl>
              <div className="held">
                <div><b>Retenida: registrar la factura</b><span>Espera a que la apruebes</span></div>
                <div className="held-btns"><span className="b-ok">Aprobar</span><span className="b-no">Rechazar</span></div>
              </div>
            </div>
            <figcaption>La consola enseña la pantalla tal como la recibe el modelo, lo bloqueado y el registro firmado. Lo retenido se aprueba aquí.</figcaption>
          </figure>
        </div>
        <p className="fine">Ilustración con los datos inventados de la demo. Las cifras y las cuentas no existen.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- protege y no */
const SI = [
  ['Lo que el agente lee en pantalla', 'IBAN, importes, nombres, correos y números de factura llegan a tu modelo como tokens. La tabla que los traduce se queda en tu ordenador.'],
  ['Lo que el agente escribe', 'El modelo escribe tokens; el ejecutor local pone el valor real en el campo.'],
  ['Lo que nunca sale', 'Claves, PIN y códigos los escribe siempre la persona. El modelo no los recibe ni puede rellenarlos.'],
  ['Lo irreversible', 'Registrar, enviar o pagar queda retenido hasta que lo apruebas en la consola.'],
  ['Los cambios que vienen de fuera', 'Un IBAN que llega en un correo no puede cambiar la cuenta de pago de la ficha.'],
  ['Lo que se escapa', 'Si una respuesta lleva un dato sin tokenizar, no sale. Todo queda en un registro firmado en tu ordenador.'],
];
const NO = [
  ['Lo que escribes en el chat', 'Tu mensaje a Claude Code llega a tu modelo tal cual. No pegues ahí datos reales: un IBAN, un DNI o un importe.'],
  ['Los turnos de Claude Code', 'El registro firmado guarda las tres herramientas de Priv8 (observe, act y oracle), no la conversación.'],
  ['Otras herramientas de Claude Code', 'Si Claude Code lee archivos o usa otros servidores MCP, eso no pasa por Priv8. En la carpeta de prueba no hay nada que leer.'],
  ['Tus sistemas', 'Este paquete solo conoce Alba Core y el correo de la demo, con datos inventados. No es para tu ERP real.'],
];
function Protege() {
  return (
    <section id="protege" className="block block-paper" aria-labelledby="h-protege">
      <div className="wrap">
        <div className="block-head">
          <p className="eyebrow">Qué protege y qué no</p>
          <h2 id="h-protege">Protege la pantalla. <span className="soft">No tu chat.</span></h2>
          <p className="lead">Priv8 se pone entre el modelo y la pantalla. Lo que pasa fuera de ese camino sigue las reglas de tu cuenta de Claude.</p>
        </div>
        <div className="two">
          <div className="col col-si">
            <div className="col-head"><Eight className="col-eight" mode="nove" fg="#2D45D6" cut="#FFFFFF" label="8" /><h3>Protege</h3></div>
            <ul>{SI.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
          </div>
          <div className="col col-no">
            <div className="col-head"><Eight className="col-eight" mode="ve" fg="#2D45D6" cut="#F4F6FD" label="8" /><h3>No protege</h3></div>
            <ul>{NO.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- qué se instala */
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

const FILES = [
  [`${DIR}`, 'El código de Priv8 CUA (núcleo, servidor MCP y adaptador web), las políticas, los datos inventados y las tres apps ya construidas.', '1 MB'],
  [`${DIR}/.venv`, 'Las dependencias de Python, fijadas en uv.lock: el SDK de MCP, Playwright, cryptography, pydantic y el SDK de Anthropic (Priv8 no lo usa aquí: no hay clave).', '170 MB'],
  [`${DIR}/navegadores`, 'Chromium para Playwright. Es el navegador que maneja tu Claude Code, aparte del tuyo.', '350 MB'],
  [`${DIR}/.priv8 y audit`, 'Se crean al usarlo: el perfil de ese Chromium, el registro firmado y su clave. No salen de tu ordenador.', 'pocos kB'],
  ['Caché de uv', 'Si no tienes Python 3.12, uv lo descarga a su propia caché, como con cualquier proyecto.', '30 MB'],
];
function Instala() {
  const sum = useChecksum();
  return (
    <section id="instala" className="block block-mist" aria-labelledby="h-instala">
      <div className="wrap">
        <div className="block-head">
          <p className="eyebrow">Qué se instala</p>
          <h2 id="h-instala">Todo en una carpeta. <span className="soft">Nada más.</span></h2>
          <p className="lead">El instalador no usa sudo, no toca tu PATH ni tu configuración de Claude Code y no pide ninguna clave. Puedes <a href={`${SITE}/instalar.sh`}>leerlo antes</a>.</p>
        </div>
        <div className="files">
          {FILES.map(([p, d, s]) => (
            <div className="file" key={p}><code>{p}</code><p>{d}</p><span className="size">{s}</span></div>
          ))}
        </div>
        <div className="facts">
          <div className="fact">
            <b>Puertos, solo en 127.0.0.1</b>
            <p>5173 Alba Core, 5174 el correo, 5175 la consola y 8700 los eventos. Nada escucha hacia fuera.</p>
          </div>
          <div className="fact">
            <b>Requisitos</b>
            <p>macOS o Linux, <a href="https://docs.astral.sh/uv/">uv</a> y <a href="https://docs.claude.com/en/docs/claude-code/overview">Claude Code</a> con tu sesión iniciada. Unos 600 MB libres.</p>
          </div>
          <div className="fact">
            <b>Para quitarlo</b>
            <Cmd text={`claude mcp remove priv8 && rm -rf ${DIR}`} />
          </div>
        </div>
        <p className="sum">
          Paquete: <a href="./priv8-mcp.tar.gz">priv8-mcp.tar.gz</a>
          {sum ? <> con SHA-256 <code title={sum}>{sum}</code></> : <> y su <a href="./priv8-mcp.tar.gz.sha256">SHA-256</a></>}. El instalador la comprueba antes de descomprimir.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- problemas */
const FAQ = [
  ['/mcp dice que priv8 ha fallado', <>Lánzalo a mano para ver el motivo: <code>{DIR}/priv8-mcp mcp</code>. Lo más habitual es que el puerto 8700 esté ocupado por otro Priv8. Sal con Ctrl-C.</>],
  ['Tengo los puertos ocupados', <>Cámbialos al conectar, por ejemplo: <code>claude mcp add priv8 -e PRIV8_EVENTS_PORT=8790 -e PRIV8_CONSOLE_PORT=5185 -- {DIR}/priv8-mcp mcp</code>. También valen <code>PRIV8_ALBA_PORT</code> y <code>PRIV8_INBOX_PORT</code>.</>],
  ['No se abre la consola', <>Ábrela a mano en <code>http://127.0.0.1:5175</code>. Si cambiaste el puerto de eventos, Priv8 te da la dirección completa al arrancar. Con <code>PRIV8_ABRIR_CONSOLA=0</code> no se abre sola.</>],
  ['Claude Code se queda esperando', 'Es lo que debe pasar con lo irreversible: la acción queda retenida hasta que la apruebas o la rechazas en la consola. Después dile a Claude Code que siga.'],
  ['Las herramientas responden que aún no hay pantalla', 'Priv8 tarda unos segundos en abrir Chromium al empezar la sesión. Claude Code vuelve a observar solo.'],
  ['Alba Core me pide usuario y clave', <>Pasa si alguien pulsa «Cerrar sesión». Abre <code>http://127.0.0.1:5173/reset</code> en esa ventana de Chromium y vuelve la sesión de la demo, con los datos de partida.</>],
  ['Chromium no arranca en Linux', <>Faltan bibliotecas del sistema. Instálalas una vez con <code>sudo {DIR}/.venv/bin/python -m playwright install-deps chromium</code>.</>],
  ['No tengo uv', <>Instálalo con <code>curl -LsSf https://astral.sh/uv/install.sh | sh</code> o <code>brew install uv</code> y vuelve a lanzar el instalador.</>],
  ['¿Y Windows?', 'Por ahora no. Con WSL2 debería funcionar como en Linux, pero no lo hemos probado.'],
];
function Problemas() {
  return (
    <section id="problemas" className="block block-paper" aria-labelledby="h-problemas">
      <div className="wrap faq-grid">
        <div className="block-head">
          <p className="eyebrow">Problemas frecuentes</p>
          <h2 id="h-problemas">Si algo no va, <span className="soft">mira aquí.</span></h2>
        </div>
        <div className="faq">
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- pie */
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
            <div><b>Probar</b><a href="#pasos">Pasos</a><a href="#veras">Qué verás</a><a href="#problemas">Problemas</a></div>
            <div><b>Saber más</b><a href={HOME}>priv8.es</a><a href={REPO}>Código en GitHub</a><a href={`${SITE}/instalar.sh`}>El instalador</a></div>
          </nav>
        </div>
        <div className="foot-by-row">
          <a className="foot-by" href="https://laaabs.com" target="_blank" rel="noopener" aria-label="by laaabs" style={{ '--by': `url(${byLaaabs})` }} />
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
        <Pasos />
        <Veras />
        <Protege />
        <Instala />
        <Problemas />
      </main>
      <Footer />
    </>
  );
}
