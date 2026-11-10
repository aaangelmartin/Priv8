import { Spot } from './Story.jsx';
import { useSeen } from './Sections.jsx';

const Tok = ({ children, never }) => <span className={'tok' + (never ? ' tok-never' : '')}>{children}</span>;

/* ---------------------------------------------------------------- cómo funciona: dónde vive cada dato */
/* Dos zonas y una frontera. A la izquierda tu máquina, donde están los datos y la tabla de tokens. A la derecha el
   proveedor del modelo, que solo ve tokens. Los tokens cruzan la frontera; los datos reales se quedan. */
export function HowArch() {
  const [ref, seen] = useSeen(0.35);
  return (
    <section id="como" className={'block block-paper arch' + (seen ? ' seen' : '')} aria-labelledby="h-arch" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="nove" say="Los datos se quedan contigo." />
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="h-arch">Los datos no cruzan. <span className="soft">Los tokens, sí.</span></h2>
          <p className="lead">Todo lo sensible se resuelve en tu máquina. Al modelo solo llegan la interfaz y tokens.</p>
        </div>
        <div className="arch-map">
          <div className="zone zone-local">
            <p className="zone-t">Tu máquina · entorno de confianza</p>
            <div className="an" style={{ '--d': 0 }}><b>1 · Pantalla</b><span>La web o la app, leída por dentro: DOM o árbol de accesibilidad.</span></div>
            <div className="an" style={{ '--d': 1 }}><b>2 · Detector</b><span>Reglas por sitio, IBAN con mod-97, DNI con su letra, tarjetas con Luhn, nombres.</span></div>
            <div className="an vault" style={{ '--d': 2 }}><b>Bóveda</b><span className="vrow"><Tok>‹IBAN_1›</Tok>ES43 9100 …</span><span className="vrow"><Tok>‹IMPORTE_1›</Tok>3.412,58 €</span></div>
            <div className="an" style={{ '--d': 5 }}><b>4 · Ejecutor y oráculo</b><span>Escribe el valor real en la pantalla. Responde «sí» o «no» sin dar la cifra.</span></div>
            <div className="an" style={{ '--d': 6 }}><b>5 · Confirmación y registro</b><span>Lo irreversible espera a una persona. Todo queda firmado.</span></div>
          </div>
          <div className="border-line" aria-hidden="true">
            <span className="gate" style={{ '--d': 3 }}>bloqueo final</span>
            <span className="pk out"><Tok>‹IBAN_1›</Tok></span>
            <span className="pk back"><Tok>escribe ‹IBAN_2›</Tok></span>
            <span className="pk stop">ES43 9100 …</span>
          </div>
          <div className="zone zone-cloud">
            <p className="zone-t">Proveedor del modelo</p>
            <div className="an model" style={{ '--d': 4 }}>
              <b>3 · El modelo razona con tokens</b>
              <pre>{'campo "Saldo"  ‹IMPORTE_1›\ncampo "Cuenta" ‹IBAN_1›\ncampo "Clave"  nunca sale\n\n→ act(transferir, ‹IBAN_2›, 200 €)'}</pre>
              <span>Entiende qué es cada cosa y decide qué hacer. Nunca ve el valor.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- garantías: las piezas del protocolo */
const PIECES = [
  { h: 'Tokens con tipo', t: 'Cada dato se cambia por un token estable en toda la sesión, con su tipo y una pista útil.', v: <><Tok>‹IBAN_1·propio›</Tok><Tok>‹IMPORTE_3·positivo›</Tok></> },
  { h: 'Tres clases de dato', t: 'Claves, PIN y códigos nunca salen. IBAN, nombres e importes se tokenizan. La interfaz va libre.', v: <><Tok never>nunca sale</Tok><Tok>se tokeniza</Tok><span className="free">libre</span></> },
  { h: 'Oráculo con límite', t: 'Compara sin revelar, con un número máximo de preguntas y respuestas por tramos.', v: <span className="oq">¿cubre 200 €? <b>sí</b> · quedan 4</span> },
  { h: 'Ejecutor local', t: 'El modelo escribe tokens; el valor real lo pone tu máquina justo antes de pulsar.', v: <span className="oq"><Tok>‹IBAN_2›</Tok> → ES08 9300 …</span> },
  { h: 'Procedencia', t: 'Un dato que llega por correo o por chat no puede entrar en un campo de pago.', v: <span className="oq">correo → campo de pago: <b>no</b></span> },
  { h: 'Tu «sí»', t: 'Transferir, invertir, firmar o enviar espera a una persona. La autenticación del banco la hace siempre ella.', v: <span className="btns"><i>Cancelar</i><i className="yes">Confirmar</i></span> },
  { h: 'Bloqueo final', t: 'Si un IBAN, un DNI o una tarjeta se escapa sin tokenizar, la petición no sale.', v: <span className="oq">petición retenida: IBAN válido</span> },
  { h: 'Registro firmado', t: 'Qué recibió el modelo, qué se bloqueó y quién aprobó, encadenado y firmado.', v: <span className="oq">09:12:31 aprobado · firmado</span> },
];
export function Guarantees() {
  const [ref, seen] = useSeen(0.25);
  return (
    <section id="garantias" className={'block block-paper guar' + (seen ? ' seen' : '')} aria-labelledby="h-guar" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="esperar" say="Ocho reglas. Ninguna se salta." />
          <p className="eyebrow">Garantías</p>
          <h2 id="h-guar">Ocho piezas. <span className="soft">Ninguna depende de que el modelo obedezca.</span></h2>
        </div>
        <div className="guar-grid">
          {PIECES.map((p, i) => (
            <article className="gp" key={p.h} style={{ '--d': i }}>
              <div className="gp-v">{p.v}</div>
              <h3>{p.h}</h3>
              <p>{p.t}</p>
            </article>
          ))}
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
const Mark = ({ v }) => (v === 1 ? <span className="mk yes" aria-label="sí">✓</span> : v === 0 ? <span className="mk no" aria-label="no">✕</span> : <span className="mk half" aria-label="en parte">en parte</span>);
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

