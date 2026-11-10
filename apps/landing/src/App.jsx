import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Nav from './Nav.jsx';
import Companion from './Companion.jsx';
import Demos from './Demos.jsx';
import Field, { Dither } from './Field.jsx';
import { Empresas, Movil } from './Products.jsx';
import { mood } from './companion.js';
import { useTheme, PALETTE } from './useTheme.js';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* Titular que entra palabra a palabra cuando aparece en pantalla. Acepta texto y <span className>. */
function Words({ as: Tag = 'h2', id, children }) {
  let n = 0;
  const split = (text, key) => text.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : <span className="w" key={key + i}><span style={{ '--i': n++ }}>{w}</span></span>));
  const out = [].concat(children).map((c, k) => (typeof c === 'string' ? split(c, 'a' + k) : <span className={c.props.className} key={'b' + k}>{split(String(c.props.children), 'c' + k)}</span>));
  return <Tag id={id} className="words">{out}</Tag>;
}

/* Cifra que cuenta hasta su valor al aparecer. */
function Count({ to }) {
  const ref = useRef(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    if (still) return undefined;
    setV(0);
    const io = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), D = 1400;
      const step = (now) => { const k = Math.min(1, (now - t0) / D); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{v}</span>;
}

function Eyebrow({ children }) {
  return <p className="eyebrow"><i className="dot" />{children}</p>;
}

/* ---------------------------------------------------------------- portada */
function Hero() {
  return (
    <section id="inicio" className="band band-cobalt hero" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="kicker in-1">Priv8 · agentes de IA que usan pantallas</p>
          <h1 id="h-hero" className="in-2">La IA hace el trámite. <span className="soft">Tus datos no salen de casa.</span></h1>
          <p className="hero-sub in-3">
            Priv8 deja que un agente trabaje en tu ERP, tu correo o la app del banco cambiando cada dato sensible por un token.
            El modelo trabaja con <Tok>‹IBAN_1›</Tok>; el valor real solo existe en tu máquina.
          </p>
          <div className="cta in-4">
            <a className="btn btn-white" href="#contacto">Pide una demo</a>
            <a className="btn btn-ghost" href="#demo">Pruébalo en un minuto</a>
          </div>
          <ul className="proof in-5" aria-label="Sobre qué funciona">
            <li>Construido sobre Claude</li><li>Voz con ElevenLabs</li><li>Web y Android</li><li>Sin integrar tus sistemas</li>
          </ul>
        </div>
        <div id="hero-anchor" className="hero-anchor" aria-hidden="true" />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 01 problema */
function Lanes() {
  return (
    <div className="lanes" role="img" aria-label="Sin Priv8 el dato viaja tal cual al modelo; con Priv8 cruza convertido en token">
      <div className="lane bad">
        <span className="lane-label">Hoy</span>
        <div className="track">
          <span className="pkt real">ES43 9100 0001…</span>
          <span className="pkt real d2">3.412,58 €</span>
          <span className="pkt real d3">Lucía Ferrer</span>
          <span className="dest">Modelo</span>
        </div>
        <p className="lane-cap">La pantalla entera viaja al proveedor del modelo.</p>
      </div>
      <div className="lane good">
        <span className="lane-label">Con Priv8</span>
        <div className="track">
          <span className="gate">Priv8</span>
          <span className="pkt swap"><b>ES43 9100 0001…</b><i>‹IBAN_1›</i></span>
          <span className="pkt swap d2"><b>3.412,58 €</b><i>‹IMPORTE_1›</i></span>
          <span className="pkt swap d3"><b>Lucía Ferrer</b><i>‹NOMBRE_1›</i></span>
          <span className="dest">Modelo</span>
        </div>
        <p className="lane-cap">Cruza el token. El valor se queda contigo.</p>
      </div>
    </div>
  );
}

function Problem() {
  return (
    <section id="problema" className="band band-night" aria-labelledby="h-prob">
      <div className="wrap">
        <div className="head">
          <Eyebrow>El problema</Eyebrow>
          <Words id="h-prob">Lo que la IA ve, <span className="soft">ya no es solo tuyo.</span></Words>
          <p className="lead">Un agente que usa pantallas envía al modelo cada nombre, IBAN y saldo que aparece. Por eso las empresas siguen haciendo a mano justo los procesos que más tiempo les quitan.</p>
        </div>
        <Lanes />
        <div className="stats">
          <div className="stat">
            <svg className="donut" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" /><circle className="arc" cx="21" cy="21" r="15.9" fill="none" stroke="#8FA2FF" strokeWidth="5" strokeDasharray="52 48" strokeDashoffset="25" strokeLinecap="round" /></svg>
            <span className="n"><Count to={52} /><small>%</small></span>
            <p>de los directivos pone la seguridad, la privacidad o el cumplimiento como primer freno de los agentes de IA.</p>
            <a className="src" href="https://securitybrief.co.uk/story/security-fears-keep-half-of-agentic-ai-stuck-in-pilots" target="_blank" rel="noreferrer">Dynatrace, vía SecurityBrief</a>
          </div>
          <div className="stat">
            <div className="bars" aria-hidden="true"><div>Sin protección<i style={{ '--w': '97%', '--c': '#F07A6E' }} /></div><div>Con anonimización<i style={{ '--w': '19%', '--c': '#E3A447' }} /></div></div>
            <span className="n"><Count to={97} /><small>%</small></span>
            <p>de los datos sensibles de la pantalla llega al modelo cuando un agente trabaja sin protección.</p>
            <a className="src" href="https://arxiv.org/html/2602.10139v2" target="_blank" rel="noreferrer">Tsinghua, «Available but Invisible»</a>
          </div>
          <div className="stat">
            <div className="dotgrid" aria-hidden="true">{Array.from({ length: 120 }, (_, i) => <i key={i} className={i < 8 ? 'ok' : ''} />)}</div>
            <span className="n"><Count to={8} /><small>/120</small></span>
            <p>IBAN bien leídos por OCR a través de un escritorio remoto. Priv8 lee la estructura de la pantalla, no los píxeles.</p>
            <span className="src">Medición propia</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 02 lo que cuesta */
function Coste() {
  return (
    <section id="coste" className="band band-paper" aria-labelledby="h-coste">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Lo que cuesta</Eyebrow>
          <Words id="h-coste">No automatizar es lento. <span className="soft">Automatizar a ciegas sale caro.</span></Words>
          <p className="lead">Llega por correo una factura de 1.180 €. En el pie, alguien ha escrito «hemos cambiado de banco, pagad a este IBAN».</p>
        </div>
        <div className="three">
          <article className="opt">
            <span className="opt-k">A mano</span>
            <span className="opt-n">0 €</span>
            <p>No se pierde nada, pero alguien teclea cada factura. El proceso no escala.</p>
            <span className="opt-tag neutral">Lento</span>
          </article>
          <article className="opt">
            <span className="opt-k">IA a ciegas</span>
            <span className="opt-n bad">−1.180 €</span>
            <p>El agente obedece al pie del correo, cambia el IBAN y paga. Y el proveedor del modelo vio todos los datos.</p>
            <span className="opt-tag bad">Dinero y datos fuera</span>
          </article>
          <article className="opt best">
            <span className="opt-k">Con Priv8</span>
            <span className="opt-n good">1.180 €<small>a quien toca</small></span>
            <p>La factura se registra sola, el IBAN del correo no puede entrar en el pago y 8 llama al proveedor para comprobarlo.</p>
            <span className="opt-tag good">Automatizado y con prueba</span>
          </article>
        </div>
        <p className="note">Ejemplo ilustrativo con datos inventados.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 03 cómo funciona */
const PIECES = [
  ['Tokens', <>Cada dato se cambia por un token estable: <Tok>‹IBAN_1·propio›</Tok>. El modelo razona igual de bien.</>],
  ['Clases de dato', 'Verde se ve. Ámbar se tokeniza. Rojo (claves, PIN, códigos) nunca sale.'],
  ['Procedencia', 'Un dato que llega por correo no puede entrar en un campo de pago.'],
  ['Oráculo', '¿Cubre el saldo 200 €? «Sí». Sin dar la cifra, y con presupuesto de preguntas.'],
  ['Ejecutor', 'El modelo escribe tokens; el valor real se pone en pantalla, en local.'],
  ['Confirmación', 'Pagar, firmar o enviar espera a que una persona diga que sí.'],
  ['Auditoría firmada', 'Qué vio el modelo, qué se bloqueó y quién aprobó.'],
];

function Diagram() {
  return (
    <div className="diagram">
      <svg viewBox="0 0 960 300" role="img" aria-label="La pantalla pasa por el tokenizador en tu máquina; solo los tokens cruzan el bloqueo final hacia la nube; el ejecutor vuelve a poner los valores reales en local.">
        <rect className="trust" x="150" y="20" width="470" height="260" rx="22" />
        <text className="lbl" x="170" y="46">TU MÁQUINA O TU MÓVIL</text>
        <rect className="box" x="16" y="96" width="118" height="110" rx="16" />
        <text className="ttl" x="34" y="126">Pantalla</text>
        <rect className="real" x="30" y="142" width="90" height="22" rx="6" /><text className="real-t" x="38" y="157">ES43 9100…</text>
        <rect className="real" x="30" y="170" width="90" height="22" rx="6" /><text className="real-t" x="38" y="185">3.412,58 €</text>
        <rect className="box" x="186" y="72" width="170" height="70" rx="16" /><text className="ttl" x="204" y="104">Tokenizador</text><text className="lbl" x="204" y="126">detector · bóveda</text>
        <rect className="box" x="186" y="166" width="170" height="70" rx="16" /><text className="ttl" x="204" y="198">Ejecutor</text><text className="lbl" x="204" y="220">rehidrata en local</text>
        <rect className="box" x="392" y="72" width="200" height="70" rx="16" /><text className="ttl" x="410" y="104">Oráculo y procedencia</text><text className="lbl" x="410" y="126">calcula sin revelar</text>
        <rect className="box" x="392" y="166" width="200" height="70" rx="16" /><text className="ttl" x="410" y="198">Auditoría firmada</text><text className="lbl" x="410" y="220">qué vio, qué se bloqueó</text>
        <rect className="gate" x="636" y="20" width="44" height="260" rx="12" />
        <text className="gate-t" transform="translate(664 230) rotate(-90)">BLOQUEO FINAL</text>
        <rect className="cloud" x="712" y="60" width="232" height="180" rx="22" />
        <text className="lbl" x="732" y="88">NUBE</text>
        <text className="ttl" x="732" y="122">Claude</text>
        <rect className="chip" x="732" y="136" width="150" height="24" rx="6" /><text className="chip-t" x="742" y="152">‹IBAN_1·propio›</text>
        <text className="ttl" x="732" y="196">ElevenLabs</text>
        <text className="lbl" x="732" y="218">frases sin cifras</text>
        <path className="wire" id="w1" d="M134 130 C160 130 160 107 186 107" />
        <path className="wire" d="M356 107 L392 107" />
        <path className="wire" id="w2" d="M356 107 C500 40 620 40 636 100 L712 130" />
        <path className="wire" id="w3" d="M712 170 C620 260 400 250 356 201" />
        <path className="wire" d="M186 201 C160 201 160 180 134 180" />
        <circle className="pkt-real" r="6"><animateMotion dur="3s" repeatCount="indefinite"><mpath href="#w1" /></animateMotion></circle>
        <circle className="pkt-tok" r="6"><animateMotion dur="3s" begin="1s" repeatCount="indefinite"><mpath href="#w2" /></animateMotion></circle>
        <circle className="pkt-tok" r="6"><animateMotion dur="3.4s" begin="1.6s" repeatCount="indefinite"><mpath href="#w3" /></animateMotion></circle>
      </svg>
    </div>
  );
}

function Como() {
  return (
    <section id="como" className="band band-mist" aria-labelledby="h-como">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Cómo funciona</Eyebrow>
          <Words id="h-como">El agente trabaja libre. <span className="soft">Los datos, no.</span></Words>
          <p className="lead">El agente solo puede <code>observe</code>, <code>act</code> y <code>oracle</code>. Todo lo demás pasa por Priv8 CUA, el protocolo que corre en tu máquina.</p>
        </div>
        <Diagram />
        <div className="bento">
          {PIECES.map(([t, d], i) => (
            <article className={'piece b' + (i + 1)} key={t} onMouseEnter={() => mood(i === 2 ? 'enfado' : i === 3 ? 'pensar' : i === 5 ? 'esperar' : 'leer', 1600)}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
          <article className="piece block b8" onMouseEnter={() => mood('nuncasale', 1800)}>
            <span className="num">Siempre</span>
            <h3>Bloqueo final</h3>
            <p>Si un dato sensible se escapa sin tokenizar, la petición no sale.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 04 pruébalo */
function Prueba({ pal }) {
  return (
    <section id="demo" className="band band-night" aria-labelledby="h-demo">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Pruébalo</Eyebrow>
          <Words id="h-demo">No te lo creas. <span className="soft">Pruébalo.</span></Words>
          <p className="lead">Tres demos con datos inventados: qué recibe el modelo, un correo con trampa y un oráculo que responde sin dar cifras.</p>
        </div>
        <Demos pal={pal} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 05 productos */
function Producto({ pal }) {
  const [tab, setTab] = useState('empresas');
  return (
    <section id="producto" className="band band-paper" aria-labelledby="h-prod">
      <div className="wrap">
        <div className="head row-head">
          <div className="head-in">
            <Eyebrow>Productos</Eyebrow>
            <Words id="h-prod">En tu empresa <span className="soft">y en el bolsillo de tus clientes.</span></Words>
          </div>
          <div className="seg" role="tablist" aria-label="Productos">
            <button type="button" role="tab" aria-selected={tab === 'empresas'} onClick={() => setTab('empresas')}>Priv8 para empresas</button>
            <button type="button" role="tab" aria-selected={tab === 'movil'} onClick={() => setTab('movil')}>8 en tu móvil</button>
          </div>
        </div>
        <div role="tabpanel" key={tab} className="swap-in">{tab === 'empresas' ? <Empresas /> : <Movil pal={pal} />}</div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 06 confianza */
function Confianza() {
  return (
    <section id="confianza" className="band band-mist" aria-labelledby="h-conf">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Confianza</Eyebrow>
          <Words id="h-conf">Pensado para pasar <span className="soft">la revisión de seguridad.</span></Words>
        </div>
        <div className="trust">
          <article><div className="tviz" aria-hidden="true"><div className="line"><span className="tok">‹IBAN_1›</span><span className="arrow-r" /><span className="cloudbox">Claude</span></div></div><h3>El proveedor del modelo solo recibe tokens</h3>
            <p>El TJUE admitió en 2025 que unos datos seudonimizados pueden no ser personales para quien no puede reidentificarlos. Tu empresa sigue siendo responsable. <a href="https://cm.twobirds.com/en/insights/2025/eu-the-srb-decision-a-new-era-for-personal-data-and-data-processing-agreements" target="_blank" rel="noreferrer">C-413/23 P</a></p></article>
          <article><div className="tviz" aria-hidden="true"><span className="ok-btn">Confirmar 200,00 €</span></div><h3>Lo irreversible lo confirma una persona</h3><p>Pagar, firmar o enviar espera a una aprobación. La autenticación del banco la hace siempre el usuario.</p></article>
          <article><div className="tviz" aria-hidden="true"><div className="chain"><i>a3f</i><b /><i>9c1</i><b /><i>e07</i><b /><i>5bd</i></div></div><h3>Cada paso, firmado</h3><p>Un registro encadenado de qué vio el modelo, qué se bloqueó y quién aprobó. Evidencia para tus auditorías.</p></article>
          <article><div className="tviz" aria-hidden="true"><span className="say">Hola, soy 8, un asistente de IA.</span></div><h3>8 dice que es una IA</h3><p>Cuando llama a un proveedor o a un banco, se presenta como asistente de IA desde la primera frase.</p></article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 07 preguntas */
const FAQ = [
  ['¿Tengo que integrar algo en mis sistemas?', 'No. 8 trabaja sobre las pantallas que ya usas: el navegador para tu ERP o tu CRM y el móvil para las apps. Lee la estructura de la pantalla, no los píxeles.'],
  ['¿Qué recibe exactamente el proveedor del modelo?', 'Tokens como ‹IBAN_1·propio› y la interfaz. La tabla que traduce cada token a su valor real se queda en tu máquina o en el móvil.'],
  ['¿Y si un dato sensible se escapa sin tokenizar?', 'El bloqueo final revisa cada petición que sale hacia la nube. Si encuentra un patrón sensible, como un IBAN válido o un DNI, la petición no sale y queda registrado.'],
  ['¿Quién aprueba los pagos?', 'Siempre una persona. Pagar, firmar o enviar quedan retenidos hasta que alguien dice que sí, y la autenticación del banco la hace siempre el usuario.'],
  ['¿Puede 8 recomendar inversiones?', 'No. El asesoramiento financiero es una actividad regulada. 8 ejecuta lo que decides; si le pides consejo, te dice que no puede.'],
  ['¿En qué se diferencia de los asistentes que ya manejan el móvil?', 'También pueden abrir apps, pero su modelo ve la pantalla entera. Con 8, el modelo solo ve tokens y los datos se quedan en el teléfono.'],
];
function Faq() {
  return (
    <section id="faq" className="band band-paper" aria-labelledby="h-faq">
      <div className="wrap faq-grid">
        <div className="head sticky">
          <Eyebrow>Preguntas</Eyebrow>
          <Words id="h-faq">Lo que nos preguntan <span className="soft">antes de una demo.</span></Words>
        </div>
        <div className="faq">
          {FAQ.map(([q, a], i) => (
            <details key={q}><summary><span className="qn">{String(i + 1).padStart(2, '0')}</span>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 08 pide una demo */
const NEEDS = ['Facturas y pagos a proveedores', 'Atención al cliente y reclamaciones', 'Agentes para los clientes de mi banco', 'Otro proceso'];
function DemoForm({ compact = false }) {
  const [sent, setSent] = useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); mood('agradecer', 2600); };
  if (sent) return (<div className="sent" role="status"><b>Gracias.</b><p>Esta versión de la web todavía no envía el formulario. Lo conectamos en cuanto tengamos dirección de contacto.</p></div>);
  const p = compact ? 'g-' : 'f-';
  return (
    <form className={'lead-form' + (compact ? ' compact' : '')} onSubmit={submit}>
      {!compact && <label htmlFor={p + 'name'}>Nombre<input id={p + 'name'} name="name" autoComplete="name" required /></label>}
      {!compact && <label htmlFor={p + 'company'}>Empresa<input id={p + 'company'} name="company" autoComplete="organization" required /></label>}
      <label htmlFor={p + 'email'}>Correo del trabajo<input id={p + 'email'} name="email" type="email" autoComplete="email" required placeholder={compact ? 'tu@empresa.com' : undefined} /></label>
      {!compact && (
        <label htmlFor={p + 'need'}>Qué quieres automatizar
          <select id={p + 'need'} name="need" defaultValue={NEEDS[0]}>{NEEDS.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
      )}
      <button type="submit" className="btn btn-white">Pedir la demo</button>
    </form>
  );
}

function Cierre() {
  return (
    <section id="contacto" className="band band-cobalt close" aria-labelledby="h-close">
      <div className="wrap close-grid">
        <div className="head">
          <Eyebrow>Pide una demo</Eyebrow>
          <Words id="h-close">Enséñanos un proceso. <span className="soft">Te lo devolvemos hecho, sin que la IA vea un dato.</span></Words>
          <p className="lead">Treinta minutos con tus pantallas, o con las nuestras si todavía no quieres compartir nada.</p>
          <ul className="close-points">
            <li>Sin integrar nada: trabaja sobre lo que ya tienes.</li>
            <li>Al proveedor del modelo solo le llegan tokens.</li>
            <li>Lo irreversible lo confirma una persona.</li>
          </ul>
        </div>
        <DemoForm />
      </div>
    </section>
  );
}

function Footer({ pal }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-cta">
          <div>
            <p className="foot-kicker">¿Tienes un proceso que no te atreves a dar a la IA?</p>
            <p className="foot-claim">Enséñanoslo. <span className="soft">Lo hacemos sin que vea un dato.</span></p>
          </div>
          <a className="btn btn-white" href="#contacto">Pide una demo</a>
        </div>
        <div className="foot-mid">
          <div className="foot-brand">
            <a className="foot-logo" href="#inicio" aria-label="Priv8, volver arriba">
              <Eight className="foot-eight" mode="mirar" fg="#FFFFFF" cut={pal.band} label="8" />
              <span>Priv8</span>
            </a>
            <p>Privacidad para agentes de IA que usan pantallas. El modelo trabaja con tokens; los datos se quedan contigo.</p>
            <DemoForm compact />
          </div>
          <nav className="foot-cols" aria-label="Pie">
            <div><b>Producto</b><a href="#como">Cómo funciona</a><a href="#producto">Para empresas</a><a href="#producto">8 en el móvil</a><a href="#demo">Pruébalo</a></div>
            <div><b>Confianza</b><a href="#confianza">Datos y modelo</a><a href="#confianza">Registro firmado</a><a href="#faq">Preguntas</a></div>
            <div><b>Empezar</b><a href="#contacto">Pide una demo</a><a href="#coste">Lo que cuesta</a><a href="#problema">Por qué Priv8</a></div>
          </nav>
        </div>
        <div className="foot-word" aria-hidden="true">
          <span>Priv</span>
          <Eight className="foot-word-eight" mode="mirar" fg="#FFFFFF" cut={pal.band} label="8" />
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const { effective, cycle } = useTheme();
  const pal = PALETTE[effective];
  const [intro, setIntro] = useState(() => document.documentElement.classList.contains('intro'));
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    const root = document.documentElement;
    root.classList.add('js');
    if (still || !root.classList.contains('intro')) { root.classList.remove('intro'); setIntro(false); return undefined; }
    const end = () => { root.classList.remove('intro'); root.classList.add('landed'); setIntro(false); };
    const t = setTimeout(end, 2300);
    const skip = () => { clearTimeout(t); end(); };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });
    window.addEventListener('touchstart', skip, { once: true, passive: true });
    return () => { clearTimeout(t); window.removeEventListener('keydown', skip); window.removeEventListener('wheel', skip); window.removeEventListener('touchstart', skip); };
  }, []);
  /* aparición al entrar en pantalla */
  useEffect(() => {
    const els = document.querySelectorAll('.band .head, .stats, .three, .bento, .trust, .lanes, .diagram, .faq, .demos, .swap-in, .lead-form');
    els.forEach((el) => el.classList.add('rv'));
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <>
      <Nav dark={effective === 'dark'} onTheme={cycle} pal={pal} />
      <main>
        <Hero />
        <Dither from="--band" to="--night" seed={1} />
        <Problem />
        <Dither from="--night" to="--paper" seed={2} />
        <Coste />
        <Como />
        <Dither from="--mist" to="--night" seed={3} />
        <Prueba pal={pal} />
        <Dither from="--night" to="--paper" seed={4} />
        <Producto pal={pal} />
        <Confianza />
        <Faq />
        <Dither from="--paper" to="--band" seed={5} />
        <Cierre />
        <Dither from="--band" to="--ink-band" seed={6} />
      </main>
      <Footer pal={pal} />
      <Companion pal={pal} intro={intro} />
    </>
  );
}
