import { useEffect, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Nav from './Nav.jsx';
import Companion from './Companion.jsx';
import Demos from './Demos.jsx';
import { mood } from './companion.js';
import { useTheme, PALETTE } from './useTheme.js';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* Cada sección es una pantalla con su notch arriba, donde va el nombre. */
function Panel({ id, tab, tone = '', children, labelledby }) {
  return (
    <section id={id} className={'panel reveal ' + tone} aria-labelledby={labelledby}>
      {tab && <span className="tab">{tab}</span>}
      <div className="inner">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- portada */
function Hero() {
  return (
    <section id="inicio" className="panel hero" aria-labelledby="h-hero">
      <div className="inner hero-grid">
        <div className="hero-copy">
          <p className="eyebrow on-band in-1">Agentes de IA que usan pantallas, sin ver tus datos</p>
          <h1 id="h-hero" className="in-2">El agente hace el trámite. <span className="soft">Nunca ve tus datos.</span></h1>
          <p className="lead on-band in-3">
            Automatiza con IA tu back-office y deja que 8 maneje el móvil de tus clientes. Priv8 cambia cada dato sensible por un token antes de que llegue al modelo y solo lo devuelve a su valor real en tu máquina, al ejecutar.
          </p>
          <div className="cta in-4">
            <a className="btn white" href="#contacto">Pide una demo</a>
            <a className="btn line" href="#demo">Pruébalo ahora</a>
          </div>
          <ul className="proof in-5" aria-label="Sobre qué funciona">
            <li>Construido sobre Claude</li><li>Voz con ElevenLabs</li><li>Web y Android</li><li>Sin integrar tus sistemas</li>
          </ul>
          <div className="hero-tokens in-5" aria-hidden="true">
            <span className="real">ES43 9100 0001 5740 1234 5678</span>
            <span className="arrow">→</span>
            <span className="tok on-band-tok">‹IBAN_1·propio›</span>
          </div>
        </div>
        <div id="hero-anchor" className="hero-anchor" aria-hidden="true" />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- cinta de tokens */
const MARQ = [['Lucía Ferrer', '‹NOMBRE_1·propio›'], ['ES43 9100 0001 5740 1234 5678', '‹IBAN_1·propio›'], ['3.412,58 €', '‹IMPORTE_1·positivo›'], ['B12345674', '‹CIF_1·proveedor›'], ['1.180,00 €', '‹IMPORTE_2·factura›'], ['12345678Z', '‹DNI_1·propio›'], ['+34 600 000 000', '‹TELEFONO_1·ficha›']];
function Marquee() {
  const row = MARQ.map(([r, t]) => (
    <span className="mq" key={t}><span className="mq-real">{r}</span><span className="mq-arrow">→</span><span className="tok">{t}</span></span>
  ));
  return (
    <div className="marquee" aria-hidden="true"><div className="track">{row}{row}</div></div>
  );
}

/* ---------------------------------------------------------------- preguntas */
const FAQ = [
  ['¿Tengo que integrar algo en mis sistemas?', 'No. 8 trabaja sobre las pantallas que ya usas: el navegador para tu ERP o tu CRM y el móvil para las apps. Lee la estructura de la pantalla, no los píxeles.'],
  ['¿Qué recibe exactamente el proveedor del modelo?', 'Tokens como ‹IBAN_1·propio› y la interfaz. La tabla que traduce cada token a su valor real se queda en tu máquina o en el móvil.'],
  ['¿Y si un dato sensible se escapa sin tokenizar?', 'El bloqueo final revisa cada petición que sale hacia la nube. Si encuentra un patrón sensible, como un IBAN válido o un DNI, la petición no sale y queda registrado.'],
  ['¿Quién aprueba los pagos?', 'Siempre una persona. Transferir, firmar o enviar quedan retenidos hasta que alguien dice que sí, y la autenticación del banco la hace siempre el usuario.'],
  ['¿Puede 8 recomendar inversiones?', 'No. El asesoramiento financiero es una actividad regulada. 8 ejecuta lo que decides; si le pides consejo, te dice que no puede.'],
];
function Faq() {
  return (
    <Panel id="faq" tab="Preguntas" labelledby="h-faq">
      <div className="faq-grid">
        <div className="head"><h2 id="h-faq">Lo que nos preguntan antes de una demo</h2></div>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- problema */
function Problem() {
  return (
    <Panel id="problema" tab="El problema" labelledby="h-prob">
      <div className="head">
        <h2 id="h-prob">Los agentes ya saben usar pantallas. Nadie quiere enseñarles los datos.</h2>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="viz"><svg className="donut" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--line)" strokeWidth="6" /><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--accent)" strokeWidth="6" strokeDasharray="52 48" strokeDashoffset="25" strokeLinecap="round" /></svg></div>
          <span className="n">52<small>%</small></span>
          <p>de los directivos de grandes empresas pone la seguridad, la privacidad o el cumplimiento como primer freno de los agentes de IA.</p>
          <a className="src" href="https://securitybrief.co.uk/story/security-fears-keep-half-of-agentic-ai-stuck-in-pilots" target="_blank" rel="noreferrer">Dynatrace, vía SecurityBrief</a>
        </div>
        <div className="stat">
          <div className="viz"><div className="bars" aria-hidden="true">
            <div>Sin protección<i style={{ '--w': '97%', '--c': 'var(--bad)' }} /></div>
            <div>Con anonimización<i style={{ '--w': '19%', '--c': 'var(--warn)' }} /></div>
          </div></div>
          <span className="n">97<small>%</small></span>
          <p>de los datos sensibles de la pantalla llega al modelo cuando un agente trabaja sin protección.</p>
          <a className="src" href="https://arxiv.org/html/2602.10139v2" target="_blank" rel="noreferrer">Tsinghua, «Available but Invisible»</a>
        </div>
        <div className="stat">
          <div className="viz"><div className="dotgrid" aria-hidden="true">{Array.from({ length: 120 }, (_, i) => <i key={i} className={i < 8 ? 'ok' : ''} />)}</div></div>
          <span className="n">8<small>/120</small></span>
          <p>IBAN bien leídos por OCR a través de un escritorio remoto. Por eso Priv8 lee la estructura de la pantalla, no los píxeles.</p>
          <span className="src">Medición propia</span>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- protocolo */
const PIECES = [
  ['Tokens', <>Cada dato se cambia por un token tipado y estable en la sesión: <Tok>‹IBAN_1·propio›</Tok>.</>],
  ['Clases de dato', 'Verde se ve, ámbar se tokeniza y rojo (claves, PIN, códigos) nunca sale.'],
  ['Procedencia', 'Lo que llega por correo o de un tercero no puede entrar en un campo de pago ni cambiar la operación.'],
  ['Oráculo', 'Suma, compara y comprueba sin revelar cifras, con un presupuesto de preguntas.'],
  ['Ejecutor', 'El modelo escribe tokens y el ejecutor pone el valor real en pantalla, en local.'],
  ['Confirmación', 'Transferir, firmar o enviar espera a que tú digas que sí.'],
  ['Auditoría firmada', 'Queda registrado qué recibió el modelo, qué se bloqueó y qué aprobaste.'],
];

/* El recorrido del dato: la pantalla, la zona de confianza, el bloqueo final y la nube.
   Los paquetes ámbar (valor real) se convierten en paquetes cobalto (token) al cruzar el tokenizador. */
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

function Protocol() {
  return (
    <Panel id="protocolo" tab="Priv8 CUA" labelledby="h-proto">
      <div className="head">
        <h2 id="h-proto">Un protocolo que cualquier agente puede adoptar</h2>
        <p className="lead">El agente solo tiene tres herramientas cerradas: <code>observe</code>, <code>act</code> y <code>oracle</code>. Todo lo demás pasa por estas piezas.</p>
      </div>
      <Diagram />
      <div className="flow">
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
      <div className="boundary" role="group" aria-label="Qué se queda en tu máquina y qué sale a la nube">
        <div>
          <span className="zone">Tu máquina o tu móvil</span>
          <h3>Todo lo que tiene datos reales</h3>
          <ul><li>La tabla de tokens y valores</li><li>El ejecutor que escribe en pantalla</li><li>La voz local que lee cifras y nombres</li><li>El registro firmado</li></ul>
        </div>
        <div className="gate"><span>Bloqueo final</span></div>
        <div>
          <span className="zone">Nube</span>
          <h3>Solo tokens y frases sin datos</h3>
          <ul><li>Claude razona con tokens</li><li>ElevenLabs lee frases sin cifras ni nombres</li></ul>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- productos */
function Empresas() {
  return (
    <div className="vert">
      <div className="copy">
        <h3 className="h3big">Automatiza lo que la protección de datos te frenaba</h3>
        <p className="lead">8 trabaja en tu ERP o tu CRM de siempre, aunque no tenga API, y el proveedor del modelo solo recibe tokens.</p>
        <ul className="points">
          <li>Funciona sobre las pantallas que ya tienes, sin integrar nada.</li>
          <li>Un correo no puede cambiar un pago: la procedencia lo impide por diseño.</li>
          <li>Verifica por teléfono con el número que ya tenías, diciendo que es una IA.</li>
          <li>Cada paso queda firmado, listo para tus auditorías.</li>
        </ul>
      </div>
      <ol className="steps" aria-label="Ejemplo: una factura de proveedor">
        <li><b>Llega la factura de Suministros Lumen</b><span>8 la abre en la bandeja de siempre.</span></li>
        <li><b>La lee sin ver los datos</b><span>Al modelo le llegan <Tok>‹CIF_1›</Tok> e <Tok>‹IMPORTE_2›</Tok>.</span></li>
        <li><b>La registra en el ERP</b><span>El ejecutor escribe los valores reales en local.</span></li>
        <li className="trap"><b>El pie del correo pide pagar a un IBAN nuevo</b><span>Bloqueado: un dato que llega por correo no puede entrar en el campo de pago.</span></li>
        <li><b>Llama al proveedor al número de su ficha</b><span>Se presenta como IA y hace una pregunta de comprobación.</span></li>
        <li><b>Contesta el correo y firma el registro</b><span>Qué vio el modelo, qué se bloqueó y quién aprobó.</span></li>
      </ol>
    </div>
  );
}

const SCENES = [
  { id: 'cuanto', label: '¿Cuánto tengo?', mode: 'hablar', state: 'Habla' },
  { id: 'pasa', label: 'Pasa 200 € al bróker', mode: 'esperar', state: 'Espera tu sí' },
  { id: 'clave', label: 'Mientras pones tu clave', mode: 'apartar', state: 'Mira a otro lado' },
  { id: 'fondo', label: '¿En qué fondo lo meto?', mode: 'rechazar', state: 'No puedo' },
];

function Movil({ pal }) {
  const [scene, setScene] = useState('cuanto');
  const [answer, setAnswer] = useState(null);
  const sc = SCENES.find((s) => s.id === scene);
  const mode = scene === 'pasa' && answer ? (answer === 'si' ? 'listo' : 'negar') : sc.mode;
  const pick = (id) => { setScene(id); setAnswer(null); };
  return (
    <div className="vert">
      <div className="copy">
        <h3 className="h3big">8 maneja tu móvil por ti, sin ver tus cuentas</h3>
        <p className="lead">Le hablas y 8 abre tus apps de banca, lee, suma y prepara. Las cifras te las dice la voz del móvil; a la nube no llegan.</p>
        <div className="chips-row" role="group" aria-label="Escenas">
          {SCENES.map((s) => (
            <button key={s.id} type="button" aria-pressed={scene === s.id} onClick={() => pick(s.id)}>{s.label}</button>
          ))}
        </div>
        <ul className="points">
          <li>Tu clave, tu huella y los códigos los pones tú. 8 mira a otro lado.</li>
          <li>Nada se mueve sin tu «sí», por voz o con un botón.</li>
          <li>Ejecuta, no aconseja: no recomienda inversiones ni firma créditos.</li>
        </ul>
      </div>
      <div className="phone-wrap">
        <div className="phone" aria-label="Simulación de 8 en el móvil">
          <span className="island" aria-hidden="true" />
          <div className="scr">
            <div className="top">
              <Eight className="eye" mode={mode} fg="#FFFFFF" cut={pal.band} label="8 en el móvil" />
              <small>{scene === 'pasa' && answer ? (answer === 'si' ? 'Hecho' : 'Cancelado') : sc.state}</small>
            </div>
            <div className="chat" aria-live="polite">
              {scene === 'cuanto' && (<>
                <p className="bubble me">¿Cuánto tengo entre mis bancos?</p>
                <p className="bubble eight">Entre tus cuentas tienes 15.462,58 €.<span className="local">La cifra la dice la voz del móvil. Al modelo solo le llegó ‹SUMA_1›.</span></p>
              </>)}
              {scene === 'pasa' && (<>
                <p className="bubble me">Pasa 200 € al bróker.</p>
                <p className="bubble eight">Lo tengo preparado. Falta tu confirmación.</p>
                {answer === 'si' && <p className="bubble eight">Hecho. Te dejo el justificante.</p>}
                {answer === 'no' && <p className="bubble eight">Cancelado. No se ha movido nada.</p>}
              </>)}
              {scene === 'clave' && (<>
                <p className="bubble eight">Pon tu clave. No miro.</p>
                <p className="bubble me mono">••••••••</p>
                <p className="bubble eight">Gracias. Sigo.<span className="local">El agente no recibe nada mientras escribes.</span></p>
              </>)}
              {scene === 'fondo' && (<>
                <p className="bubble me">¿En qué fondo lo meto?</p>
                <p className="bubble eight">Eso sería asesorarte y no lo hago. Si eliges un fondo, lo preparo.</p>
              </>)}
            </div>
            {scene === 'pasa' && !answer && (
              <div className="confirm">
                <b>200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?</b>
                <div className="row2">
                  <button type="button" onClick={() => { setAnswer('no'); mood('negar', 1500); }}>Cancelar</button>
                  <button type="button" className="yes" onClick={() => { setAnswer('si'); mood('asentir', 1500); }}>Confirmar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Producto({ pal }) {
  const [tab, setTab] = useState('empresas');
  return (
    <Panel id="producto" tab="Un núcleo, dos productos" labelledby="h-prod">
      <div className="head row-head">
        <h2 id="h-prod">Para tu empresa y para tu móvil</h2>
        <div className="seg" role="tablist" aria-label="Productos">
          <button type="button" role="tab" aria-selected={tab === 'empresas'} onClick={() => setTab('empresas')}>Priv8 para empresas</button>
          <button type="button" role="tab" aria-selected={tab === 'movil'} onClick={() => setTab('movil')}>8 en tu móvil</button>
        </div>
      </div>
      <div role="tabpanel">{tab === 'empresas' ? <Empresas /> : <Movil pal={pal} />}</div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- para quién y confianza */
function Quien({ pal }) {
  return (
    <Panel id="quien" tab="Para quién" labelledby="h-quien">
      <div className="head"><h2 id="h-quien">Quien usa el agente, quien lo ofrece y quien lo construye</h2></div>
      <div className="who-grid">
        <article className="who-card"><div className="mini" aria-hidden="true"><div className="mbar"><i /><i /><i /></div><div className="mrow">Proveedor <span className="tok">‹NOMBRE_2›</span></div><div className="mrow">Importe <span className="tok">‹IMPORTE_2›</span></div><div className="mrow bad">IBAN del correo · bloqueado</div></div><span className="tag">Empresas</span><h3>Operaciones y finanzas</h3><p>Automatiza facturas, reclamaciones y altas en los programas de siempre sin enviar datos de clientes al modelo.</p></article>
        <article className="who-card"><div className="mini" aria-hidden="true"><div className="mbar"><i /><i /><i /></div><div className="mrow">Saldo <span className="tok">‹IMPORTE_1›</span></div><div className="mrow">Clave <span>nunca sale</span></div><div className="mrow ok">Confirmado por el cliente</div></div><span className="tag">Bancos y brókers</span><h3>Ofrece agentes a tus clientes</h3><p>Deja que 8 opere en tu app sin abrir tus sistemas ni exponer datos, con la confirmación siempre en manos del cliente.</p></article>
        <article className="who-card"><div className="mini phoneish" aria-hidden="true"><div className="mscr"><Eight className="eye" mode="hablar" fg="#FFFFFF" cut={pal.band} label="8" /><span>Tienes 15.462,58 €</span></div></div><span className="tag">Personas</span><h3>8 en el bolsillo</h3><p>Pregunta cuánto tienes, prepara una transferencia o pide que llame al banco. Tus datos se quedan en tu móvil.</p></article>
      </div>
    </Panel>
  );
}

function Confianza() {
  return (
    <Panel id="confianza" tab="Confianza" labelledby="h-conf">
      <div className="head"><h2 id="h-conf">Pensado para lo que pide un responsable de datos</h2></div>
      <div className="trust">
        <article><div className="tviz" aria-hidden="true"><div className="line"><span className="tok">‹IBAN_1›</span>→<span className="cloudbox">Claude</span></div></div><h3>El proveedor del modelo solo recibe tokens</h3>
          <p>El Tribunal de Justicia de la UE admitió en 2025 que unos datos seudonimizados pueden no ser datos personales para quien no puede reidentificarlos. Tu empresa sigue siendo responsable de sus datos. <a href="https://cm.twobirds.com/en/insights/2025/eu-the-srb-decision-a-new-era-for-personal-data-and-data-processing-agreements" target="_blank" rel="noreferrer">Sentencia C-413/23 P</a></p></article>
        <article><div className="tviz" aria-hidden="true"><span className="ok-btn">Confirmar 200,00 €</span></div><h3>Lo irreversible lo confirmas tú</h3><p>Transferir, firmar o enviar espera a tu aprobación, y la autenticación del banco la haces siempre tú.</p></article>
        <article><div className="tviz" aria-hidden="true"><div className="chain"><i>a3f</i><b /><i>9c1</i><b /><i>e07</i><b /><i>5bd</i></div></div><h3>Cada paso, firmado</h3><p>Un registro encadenado de qué vio el modelo, qué se bloqueó y quién aprobó, útil como evidencia en auditorías de seguridad.</p></article>
        <article><div className="tviz" aria-hidden="true"><span className="say">Hola, soy 8, un asistente de IA.</span></div><h3>8 dice que es una IA</h3><p>Cuando llama por ti a un proveedor o a tu banco, se presenta como asistente de IA desde el primer momento.</p></article>
      </div>
    </Panel>
  );
}

const NEEDS = ['Facturas y pagos a proveedores', 'Atención al cliente y reclamaciones', 'Agentes para los clientes de mi banco', 'Otro proceso'];

function Cierre() {
  const [sent, setSent] = useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); mood('agradecer', 2600); };
  return (
    <section id="contacto" className="panel hero close reveal" aria-labelledby="h-close">
      <span className="tab">Pide una demo</span>
      <div className="inner close-grid">
        <div>
          <h2 id="h-close">Enséñanos un proceso. <span className="soft">Te lo enseñamos hecho, sin que la IA vea un dato.</span></h2>
          <p className="lead on-band">Una sesión de 30 minutos con tus pantallas, o con las nuestras si aún no quieres compartir nada.</p>
          <ul className="close-points">
            <li>Sin integrar nada: trabaja sobre las pantallas que ya tienes.</li>
            <li>Al proveedor del modelo solo le llegan tokens.</li>
            <li>Todo lo irreversible lo confirma una persona.</li>
          </ul>
        </div>
        <form className="lead-form" onSubmit={submit}>
          {sent ? (
            <div className="sent" role="status">
              <b>Gracias.</b>
              <p>Esta versión de la web todavía no envía el formulario. Lo conectamos en cuanto tengamos dirección de contacto.</p>
            </div>
          ) : (<>
            <label htmlFor="f-name">Nombre<input id="f-name" name="name" autoComplete="name" required /></label>
            <label htmlFor="f-company">Empresa<input id="f-company" name="company" autoComplete="organization" required /></label>
            <label htmlFor="f-email">Correo del trabajo<input id="f-email" name="email" type="email" autoComplete="email" required /></label>
            <label htmlFor="f-need">Qué quieres automatizar
              <select id="f-need" name="need" defaultValue={NEEDS[0]}>{NEEDS.map((n) => <option key={n}>{n}</option>)}</select>
            </label>
            <button type="submit" className="btn white">Pedir la demo</button>
          </>)}
        </form>
      </div>
    </section>
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
  /* aparición suave de cada sección al entrar en pantalla */
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -4% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <>
      <Nav dark={effective === 'dark'} onTheme={cycle} pal={pal} />
      <main className="page">
        <Hero />
        <Marquee />
        <Producto pal={pal} />
        <Panel id="demo" tab="Pruébalo" labelledby="h-demo">
          <div className="head">
            <h2 id="h-demo">Mira qué recibe la IA. Y qué no.</h2>
            <p className="lead">Tres demos con datos inventados. 8 te acompaña y reacciona a lo que pasa.</p>
          </div>
          <Demos pal={pal} />
        </Panel>
        <Problem />
        <Protocol />
        <Quien pal={pal} />
        <Confianza />
        <Faq />
        <Cierre />
        <footer>
          <span>Priv8 · Privacidad para agentes de IA</span>
          <span>Los datos de las demos son inventados. Banca Alcor, Nimbo Bróker y Suministros Lumen son nombres de ejemplo.</span>
        </footer>
      </main>
      <Companion band={pal.band} accent={pal.accent} panel={pal.bg} intro={intro} />
    </>
  );
}
