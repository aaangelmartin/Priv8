import { LOGOS } from './logos.js';
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
const MODELS = ['Claude', 'ChatGPT', 'Grok', 'Gemini', 'Mistral', 'Llama'];

/* El recorrido de un dato: entra por la pantalla, se tokeniza, cruza la frontera como token, el modelo decide y la
   orden vuelve para que tu máquina la complete. Un paquete viaja de nodo en nodo y abajo se explica cada paso. */
const NODES = {
  screen: { x: 9, y: 26, h: 'Pantalla', s: 'web o app' },
  detect: { x: 27, y: 26, h: 'Detector', s: 'clasifica' },
  vault: { x: 45, y: 26, h: 'Bóveda', s: 'token ↔ valor' },
  gate: { x: 63, y: 50, h: 'Bloqueo final', s: 'frontera' },
  model: { x: 85, y: 50, h: 'Modelo', s: 'razona' },
  exec: { x: 45, y: 74, h: 'Ejecutor', s: 'pone el valor' },
  yes: { x: 27, y: 74, h: 'Tu «sí»', s: 'confirma' },
  log: { x: 9, y: 74, h: 'Registro', s: 'firmado' },
};
/* móvil: el mismo mapa en vertical. Tu máquina arriba (ida por la izquierda, vuelta por la derecha), la frontera
   en horizontal y el proveedor del modelo abajo. */
const NODES_M = {
  screen: { x: 27, y: 18 }, detect: { x: 27, y: 33 }, vault: { x: 27, y: 48 },
  gate: { x: 50, y: 63 }, model: { x: 50, y: 82 },
  exec: { x: 73, y: 48 }, yes: { x: 73, y: 33 }, log: { x: 73, y: 18 },
};
function useNarrow(q = '(max-width: 760px)') {
  const [on, setOn] = useState(() => { try { return window.matchMedia(q).matches; } catch (e) { return false; } });
  useEffect(() => {
    let m; try { m = window.matchMedia(q); } catch (e) { return undefined; }
    const f = () => setOn(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}
const TRIP = [
  { at: 'screen', pk: '3.412,58 €', real: true, h: 'La pantalla tiene datos reales', t: 'El saldo, el IBAN, el titular. Todo eso está en tu pantalla.' },
  { at: 'detect', pk: '3.412,58 € · importe', real: true, h: 'El detector los reconoce', t: 'Sabe que es un importe. Las claves y los códigos los marca para que nunca salgan.' },
  { at: 'vault', pk: '‹IMPORTE_1›', h: 'Se cambian por tokens', t: 'La tabla ‹IMPORTE_1› = 3.412,58 € se guarda en tu máquina.' },
  { at: 'gate', pk: '‹IMPORTE_1›', h: 'Solo cruzan tokens', t: 'El bloqueo final revisa cada petición. Si algo real se escapa, no sale.' },
  { at: 'model', pk: 'transferir a ‹IBAN_2›', h: 'El modelo decide con tokens', t: 'Entiende qué hay en la pantalla y qué hacer, sin ver un valor. Si necesita comparar, pregunta al oráculo.' },
  { at: 'gate', pk: 'transferir a ‹IBAN_2›', h: 'La orden vuelve en tokens', t: 'Lo que el modelo escribe también son tokens.' },
  { at: 'exec', pk: 'ES08 9300 0001 …', real: true, h: 'Tu máquina pone el valor real', t: 'El ejecutor sustituye el token justo antes de escribir en la pantalla.' },
  { at: 'yes', pk: 'Confirmar', h: 'Lo irreversible espera tu «sí»', t: 'Transferir, firmar o enviar no ocurre hasta que una persona lo confirma.' },
  { at: 'log', pk: 'firmado', h: 'Todo queda registrado', t: 'Qué recibió el modelo, qué se bloqueó y quién aprobó.' },
];

export function HowArch() {
  const [ref, seen] = useSeen(0.35);
  const [i, setI] = useState(0);
  const hold = useRef(0);
  useEffect(() => {
    if (!seen) return undefined;
    const t = setInterval(() => { if (performance.now() > hold.current) setI((v) => (v + 1) % TRIP.length); }, 2400);
    return () => clearInterval(t);
  }, [seen]);
  const narrow = useNarrow();
  const at = (k) => (narrow ? { ...NODES[k], ...NODES_M[k] } : NODES[k]);
  const st = TRIP[i], n = at(st.at);
  const pick = (k) => { setI(k); hold.current = performance.now() + 9000; };
  return (
    <section id="como" className={'block block-cobalt trip' + (seen ? ' seen' : '')} aria-labelledby="h-arch" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="nove" say="Los datos se quedan contigo." />
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="h-arch">Los datos no cruzan. <span className="soft">Los tokens, sí.</span></h2>
        </div>
        <div className={'tmap' + (narrow ? ' tmap-m' : '')}>
          <div className="tz tz-local"><span>Tu máquina · los datos reales viven aquí</span></div>
          <div className="tz tz-cloud"><span>Proveedor del modelo</span><div className="models" role="list" aria-label="Funciona con cualquier modelo">{MODELS.map((m) => <i key={m} role="listitem" title={m} aria-label={m}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={LOGOS[m]} fillRule={m === 'Mistral' || m === 'Grok' ? 'evenodd' : undefined} /></svg></i>)}</div></div>
          <div className="tline" aria-hidden="true" />
          <svg className="tpaths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {narrow
              ? <><path d="M27 18 V48 L50 63 V82" /><path d="M50 82 V63 L73 48 V18" /></>
              : <><path d="M9 26 H45 L63 50 L85 50" /><path d="M85 50 L63 50 L45 74 H9" /></>}
          </svg>
          {Object.keys(NODES).map((k) => [k, at(k)]).map(([k, v]) => (
            <div key={k} className={'tn tn-' + k + (st.at === k ? ' on' : '')} style={{ left: v.x + '%', top: v.y + '%' }} onClick={() => pick(TRIP.findIndex((x) => x.at === k))}>
              <b>{v.h}</b><small>{v.s}</small>
            </div>
          ))}
          <div className={'tpk' + (st.real ? ' real' : '')} style={{ left: n.x + '%', top: `calc(${n.y}% - ${narrow ? 46 : 52}px)` }}>{st.pk}</div>
        </div>
        <div className="tcap">
          <div className="tcap-tx" key={i}><p className="tcap-n">{i + 1} de {TRIP.length}</p><h3>{st.h}</h3><p>{st.t}</p></div>
          <div className="tcap-r">
            <a className="more" href="protocolo/">El protocolo en detalle</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- garantías: las ocho piezas, en azul */
export function Guarantees() {
  const [ref, seen] = useSeen(0.25);
  return (
    <section id="garantias" className={'block block-cobalt guar guar-b' + (seen ? ' seen' : '')} aria-labelledby="h-guar" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="esperar" say="Ocho reglas. Ninguna se salta." />
          <p className="eyebrow">Garantías</p>
          <h2 id="h-guar">Ocho piezas. <span className="soft">Ninguna depende de que el modelo obedezca.</span></h2>
        </div>
        <div className="guar-grid">
          {PIECES.map((p, k) => (
            <article className="gp" key={p.h} style={{ '--d': k }}>
              <div className="gp-v">{p.v}</div>
              <h3>{p.h}</h3>
              <p>{p.t}</p>
            </article>
          ))}
        </div>
        <p className="more-row"><a className="more" href="garantias/">Las ocho piezas en detalle</a></p>
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
          <a className="more" href="integracion/">Guía de integración</a>
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
  ['Bóvedas de datos para IA', [1, 0, 0, 0]],
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
              {vals.map((v, i) => <span role="cell" key={i} data-label={COLS[i]}><Mark v={v} /></span>)}
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
        <p className="more-row"><a className="more" href="cumplimiento/">Cumplimiento en detalle</a></p>
      </div>
    </section>
  );
}

