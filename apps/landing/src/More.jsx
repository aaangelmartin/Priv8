import { useEffect, useRef, useState } from 'react';
import { Spot } from './Story.jsx';
import { useSeen } from './Sections.jsx';

const Tok = ({ children, never }) => <span className={'tok' + (never ? ' tok-never' : '')}>{children}</span>;

/* ---------------------------------------------------------------- cómo funciona: el mapa y las ocho piezas */
/* Un mapa con dos zonas y una frontera: tu máquina, donde viven los datos, y el proveedor del modelo, que solo ve
   tokens. Las ocho piezas del protocolo están en su sitio del mapa; se iluminan una a una (solas o al pulsarlas)
   y al lado se explica cada una con su ejemplo. */
const PIECES = [
  { k: 'detector', h: 'Tres clases de dato', t: 'Al leer la pantalla, cada dato se clasifica. Claves, PIN y códigos nunca salen. IBAN, nombres e importes se tokenizan. La interfaz va libre.', v: <><Tok never>nunca sale</Tok><Tok>se tokeniza</Tok><span className="free">libre</span></> },
  { k: 'vault', h: 'Tokens con tipo', t: 'Cada dato se cambia por un token estable en toda la sesión, con su tipo y una pista útil. La tabla token → valor vive solo en tu máquina.', v: <><Tok>‹IBAN_1·propio›</Tok><Tok>‹IMPORTE_3·positivo›</Tok></> },
  { k: 'gate', h: 'Bloqueo final', t: 'Antes de salir, cada petición se revisa. Si un IBAN, un DNI o una tarjeta se escapa sin tokenizar, la petición no sale.', v: <span className="oq">petición retenida: IBAN válido detectado</span> },
  { k: 'oracle', h: 'Oráculo con límite', t: 'El modelo puede preguntar «¿cubre 200 €?» y recibir «sí» o «no», sin la cifra. Con un máximo de preguntas para que no la adivine.', v: <span className="oq">¿cubre 200 €? <b>sí</b> · quedan 4</span> },
  { k: 'exec', h: 'Ejecutor local', t: 'El modelo escribe tokens. El ejecutor, en tu máquina, pone el valor real en la pantalla justo antes de pulsar.', v: <span className="oq"><Tok>‹IBAN_2›</Tok> → ES08 9300 …</span> },
  { k: 'prov', h: 'Procedencia', t: 'Cada dato recuerda de dónde viene. Uno que llega por correo o por chat no puede entrar en un campo de pago.', v: <span className="oq">dato del correo → campo de pago: <b>no</b></span> },
  { k: 'yes', h: 'Tu «sí»', t: 'Transferir, invertir, firmar o enviar espera a una persona. La autenticación del banco la hace siempre ella.', v: <span className="btns"><i>Cancelar</i><i className="yes">Confirmar</i></span> },
  { k: 'log', h: 'Registro firmado', t: 'Qué recibió el modelo, qué se bloqueó y quién aprobó, encadenado y firmado para auditoría.', v: <span className="oq">09:12:31 aprobado por una persona · firmado</span> },
];
const MODELS = ['Claude', 'ChatGPT', 'Gemini', 'Mistral', 'Llama'];

export function HowArch() {
  const [ref, seen] = useSeen(0.35);
  const [cur, setCur] = useState(0);
  const hold = useRef(0);
  useEffect(() => {
    if (!seen) return undefined;
    const t = setInterval(() => { if (performance.now() > hold.current) setCur((c) => (c + 1) % PIECES.length); }, 3400);
    return () => clearInterval(t);
  }, [seen]);
  const pick = (i) => { setCur(i); hold.current = performance.now() + 10000; };
  const on = (k) => (PIECES[cur].k === k ? ' on' : '');
  const N = ({ k, children, cls = '' }) => {
    const i = PIECES.findIndex((p) => p.k === k);
    return <button type="button" className={'mn ' + cls + on(k)} onClick={() => pick(i)}><span className="mn-n">{i + 1}</span>{children}</button>;
  };
  const p = PIECES[cur];
  return (
    <section id="como" className={'block block-cobalt arch2' + (seen ? ' seen' : '')} aria-labelledby="h-arch" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="nove" say="Los datos se quedan contigo." />
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="h-arch">Los datos no cruzan. <span className="soft">Los tokens, sí.</span></h2>
        </div>
        <div className="arch2-grid">
          <div className="map">
            <div className="mz local">
              <p className="mz-t">Tu máquina · entorno de confianza</p>
              <div className="mrow"><span className="mn plain">Pantalla<small>web o app, leída por dentro</small></span></div>
              <div className="mrow two"><N k="detector">Detector</N><N k="vault">Bóveda de tokens</N></div>
              <div className="mrow two"><N k="oracle">Oráculo</N><N k="exec">Ejecutor</N></div>
              <div className="mrow two"><N k="prov">Procedencia</N><N k="yes">Tu «sí»</N></div>
              <div className="mrow"><N k="log">Registro firmado</N></div>
            </div>
            <div className="mfront">
              <span className="pk out"><Tok>‹IBAN_1›</Tok></span>
              <span className="pk back"><Tok>‹IBAN_2›</Tok></span>
              <N k="gate" cls="gate2">Bloqueo final</N>
              <span className="pk stop">ES43 9100 …</span>
            </div>
            <div className="mz cloud">
              <p className="mz-t">Proveedor del modelo</p>
              <div className="models">{MODELS.map((m) => <span key={m}>{m}</span>)}</div>
              <pre>{'Saldo   ‹IMPORTE_1›\nCuenta  ‹IBAN_1›\nClave   nunca sale\n\n→ transferir a ‹IBAN_2›'}</pre>
              <p className="mz-n">Razona con tokens. Nunca ve un valor.</p>
            </div>
          </div>
          <div className="detail" aria-live="polite">
            <p className="d-n">{cur + 1} de {PIECES.length}</p>
            <h3 key={'h' + cur} className="swap">{p.h}</h3>
            <p key={'t' + cur} className="swap">{p.t}</p>
            <div key={'v' + cur} className="d-v swap">{p.v}</div>
            <div className="d-dots">{PIECES.map((x, i) => <button key={x.k} type="button" aria-label={x.h} className={i === cur ? 'on' : ''} onClick={() => pick(i)} />)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- para quien lo integra */
export function Developers() {
  return (
    <section id="integrar" className="block block-paper dev" aria-labelledby="h-dev">
      <div className="wrap dev-grid">
        <div className="dev-copy">
          <Spot className="spot-inline" mode="pensar" say="Tres herramientas. Nada más." />
          <p className="eyebrow">Para quien lo integra</p>
          <h2 id="h-dev">Tres herramientas. <span className="soft">Ninguna puerta trasera.</span></h2>
          <p className="lead">El agente solo puede observar, actuar y preguntar al oráculo. Sin ejecutar código, sin acceso directo al navegador ni al sistema.</p>
          <ul className="points">
            <li>Servidor MCP: cualquier agente compatible lo usa tal cual.</li>
            <li>Librería Python en el mismo proceso: nada de datos viajando entre servicios.</li>
            <li>Adaptadores para web (Playwright) y Android (accesibilidad).</li>
            <li>Funciona con Claude o con el modelo que elijas.</li>
          </ul>
        </div>
        <div className="code" aria-label="Ejemplo de llamada">
          <div className="code-bar"><i /><i /><i /><span>observe → act</span></div>
          <pre>{`> observe()
{
  "pantalla": "Banca Alcor · transferir",
  "campos": [
    { "etiqueta": "Destino", "valor": "‹IBAN_2›" },
    { "etiqueta": "Importe", "valor": "‹IMPORTE_7›" },
    { "etiqueta": "Clave",   "valor": "nunca sale" }
  ]
}

> oracle("‹IMPORTE_1› >= 200")
{ "respuesta": "sí", "quedan": 4 }

> act("transferir", { "destino": "‹IBAN_2›" })
{ "estado": "espera confirmación humana" }`}</pre>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- frente a lo que ya existe */
const COLS = ['Protege lo que el agente ve en pantalla', 'Bloquea datos inyectados por correo', 'Retiene los pagos hasta tu «sí»', 'Funciona sin integrar nada'];
const ROWS = [
  ['Un agente normal', [0, 0, 0, 1]],
  ['Pagos para agentes · Visa, Google', [0, 0, 1, 0]],
  ['Bóvedas de datos para IA', [0.5, 0, 0, 0]],
  ['Priv8', [1, 1, 1, 1]],
];
const Mark = ({ v }) => (v === 1 ? <span className="mk yes" aria-label="sí">✓</span> : v === 0 ? <span className="mk no" aria-label="no">✕</span> : <span className="mk half" aria-label="en parte">/</span>);
export function Compare() {
  return (
    <section id="comparar" className="block block-cobalt compare" aria-labelledby="h-cmp">
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="curiosidad" say="Faltaba esta pieza." />
          <p className="eyebrow">Frente a lo que ya existe</p>
          <h2 id="h-cmp">Visa y Google resolvieron cómo paga un agente. <span className="soft">Priv8 resuelve qué ve mientras trabaja.</span></h2>
        </div>
        <div className="cmp" role="table" aria-label="Comparativa">
          <div className="cmp-r cmp-h" role="row"><span role="columnheader" />{COLS.map((c) => <span role="columnheader" key={c}>{c}</span>)}</div>
          {ROWS.map(([name, vals]) => (
            <div className={'cmp-r' + (name === 'Priv8' ? ' me' : '')} role="row" key={name}>
              <span role="rowheader">{name}</span>
              {vals.map((v, i) => <span role="cell" key={i}><Mark v={v} /></span>)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- cumplimiento, con peso */
const LAWS = [
  ['RGPD', 'Minimización y seudonimización', 'Al proveedor del modelo solo le llegan tokens. Los datos personales no salen de tu entorno.'],
  ['PSD2', 'Autenticación reforzada', 'La clave, la huella y los códigos los pone siempre la persona. 8 no los ve ni los guarda.'],
  ['MiFID II', 'Sin asesoramiento', '8 ejecuta lo que decides; no recomienda productos de inversión.'],
  ['AI Act', 'Supervisión humana y trazabilidad', 'Lo irreversible espera a una persona y cada paso queda en un registro firmado.'],
];
export function Compliance() {
  return (
    <section id="cumplimiento" className="block block-cobalt laws" aria-labelledby="h-laws">
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="leer" say="Hecho para pasar auditoría." />
          <p className="eyebrow">Cumplimiento</p>
          <h2 id="h-laws">La IA entra en procesos con datos. <span className="soft">Tu cumplimiento, intacto.</span></h2>
          <p className="lead">Priv8 está diseñado para que tu equipo legal pueda decir que sí.</p>
        </div>
        <div className="laws-grid">
          {LAWS.map(([k, sub, t]) => (<article key={k} className="law"><h3>{k}</h3><p className="law-sub">{sub}</p><p>{t}</p></article>))}
        </div>
      </div>
    </section>
  );
}

