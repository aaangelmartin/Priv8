import { LOGOS } from './logos.js';
import { useEffect, useRef, useState } from 'react';
import { Spot } from './Story.jsx';
import { useSeen, V } from './Sections.jsx';

const Tok = ({ children, never }) => <span className={'tok' + (never ? ' tok-never' : '')}>{children}</span>;

/* ---------------------------------------------------------------- cómo funciona: el mapa y las ocho piezas */
/* Un mapa con dos zonas y una frontera: tu máquina, donde viven los datos, y el proveedor del modelo, que solo ve
   tokens. Las ocho piezas del protocolo están en su sitio del mapa; se iluminan una a una (solas o al pulsarlas)
   y al lado se explica cada una con su ejemplo. */
/* Cada pieza enseña lo que hace con una escena corta propia, cuando su tarjeta entra en pantalla. */
function useLater(on, ms) {
  const [v, setV] = useState(false);
  useEffect(() => { if (!on) return undefined; const t = setTimeout(() => setV(true), ms); return () => clearTimeout(t); }, [on, ms]);
  return v;
}
const PIECES = [
  { k: 'detector', h: 'Tres clases de dato', t: 'Al leer la pantalla, cada dato se clasifica. Claves, PIN y códigos nunca salen. IBAN, nombres e importes se tokenizan. La interfaz va libre.',
    v: (go) => <><Tok never><V real="PIN 4821" tok="nunca sale" on={go} /></Tok><Tok><V real="ES43 9100 …" tok="se tokeniza" on={go} i={6} /></Tok><span className="free"><V real="Transferir" tok="libre" on={go} i={12} /></span></> },
  { k: 'vault', h: 'Tokens con tipo', t: 'Cada dato se cambia por un token estable en toda la sesión, con su tipo y una pista útil. La tabla token → valor vive solo en tu máquina.',
    v: (go) => <><Tok><V real="ES43 9100 0001 57…" tok="‹IBAN_1·propio›" on={go} /></Tok><Tok><V real="3.412,58 €" tok="‹IMPORTE_3·positivo›" on={go} i={8} /></Tok></> },
  { k: 'gate', h: 'Bloqueo final', t: 'Antes de salir, cada petición se revisa. Si un IBAN, un DNI o una tarjeta se escapa sin tokenizar, la petición no sale.',
    v: (go) => <span className={'oq gate-v' + (go ? ' hit' : '')}><span className="gate-req">petición → ES71 9400 0007 …</span><b className="gate-stamp">retenida</b></span> },
  { k: 'oracle', h: 'Oráculo con límite', t: 'El modelo puede preguntar «¿cubre 200 €?» y recibir «sí» o «no», sin la cifra. Con un máximo de preguntas para que no la adivine.',
    v: (go) => <span className={'oq oracle-v' + (go ? ' hit' : '')}>¿cubre 200 €? <b className="ans">sí</b> · quedan <V real="5" tok="4" on={go} /></span> },
  { k: 'exec', h: 'Ejecutor local', t: 'El modelo escribe tokens. El ejecutor, en tu máquina, pone el valor real en la pantalla justo antes de pulsar.',
    v: (go) => <span className="oq">campo destino: <b><V real="‹IBAN_2›" tok="ES08 9300 …" on={go} /></b></span> },
  { k: 'prov', h: 'Procedencia', t: 'Cada dato recuerda de dónde viene. Uno que llega por correo o por chat no puede entrar en un campo de pago.',
    v: (go) => <span className={'oq prov-v' + (go ? ' hit' : '')}>dato del correo → campo de pago: <b className="prov-no">no</b></span> },
  { k: 'yes', h: 'Tu «sí»', t: 'Transferir, invertir, firmar o enviar espera a una persona. La autenticación del banco la hace siempre ella.',
    v: (go) => <span className={'btns yes-v' + (go ? ' hit' : '')}><i>Cancelar</i><i className="yes"><span className="y0">Confirmar</span><span className="y1">Confirmado</span></i></span> },
  { k: 'log', h: 'Registro firmado', t: 'Qué recibió el modelo, qué se bloqueó y quién aprobó, encadenado y firmado para auditoría.',
    v: (go) => <span className={'oq log-v' + (go ? ' hit' : '')}>09:12:31 aprobado · <V real="········" tok="3f9a·c2e1" on={go} /> <b className="signed">firmado</b></span> },
];
function Piece({ p, k }) {
  const [ref, seen] = useSeen(0.6);
  const go = useLater(seen, 350 + (k % 4) * 140);
  return (
    <article className={'gp' + (seen ? ' in' : '')} ref={ref} style={{ '--d': k }}>
      <div className="gp-v">{p.v(go)}</div>
      <h3>{p.h}</h3>
      <p>{p.t}</p>
    </article>
  );
}
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
          {PIECES.map((p, k) => <Piece key={p.k} p={p} k={k} />)}
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
        <Terminal />
      </div>
    </section>
  );
}

/* La sesión con el agente se escribe sola al entrar en pantalla: las órdenes letra a letra, las respuestas de golpe.
   Todas las líneas ocupan su sitio desde el principio, así nada salta. */
const SESSION = `> observe()
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
{ "estado": "espera confirmación humana" }`.split('\n');
function Terminal() {
  const [ref, seen] = useSeen(0.4);
  const [pos, setPos] = useState({ line: 0, ch: 0 });
  useEffect(() => {
    if (!seen) return undefined;
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* nada */ }
    if (still) { setPos({ line: SESSION.length, ch: 0 }); return undefined; }
    let line = 0, ch = 0, t = 0;
    const tick = () => {
      const l = SESSION[line];
      if (l === undefined) return;
      if (l.startsWith('>') && ch < l.length) { ch += 1; setPos({ line, ch }); t = setTimeout(tick, 26); return; }
      line += 1; ch = 0; setPos({ line, ch });
      const next = SESSION[line];
      t = setTimeout(tick, next && next.startsWith('>') ? 520 : next === '' ? 80 : 70);
    };
    t = setTimeout(tick, 300);
    return () => clearTimeout(t);
  }, [seen]);
  return (
    <div className="code" aria-label="Ejemplo de llamada" ref={ref}>
      <div className="code-bar"><i /><i /><i /><span>observe → act</span></div>
      <pre>{SESSION.map((l, k) => {
        const shown = k < pos.line ? l : k === pos.line ? l.slice(0, pos.ch) : '';
        return (
          <span key={k} className="cl">
            <span className="cl-ghost" aria-hidden="true">{l || ' '}</span>
            <span className="cl-on">{shown}{k === pos.line && pos.line < SESSION.length ? <i className="caret" /> : null}</span>
          </span>
        );
      })}</pre>
    </div>
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
  const [ref, seen] = useSeen(0.35);
  return (
    <section id="comparar" className={'block block-cobalt compare' + (seen ? ' seen' : '')} aria-labelledby="h-cmp" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="curiosidad" say="Faltaba esta pieza." />
          <p className="eyebrow">Frente a lo que ya existe</p>
          <h2 id="h-cmp">Visa y Google resolvieron cómo paga un agente. <span className="soft">Priv8 resuelve qué ve mientras trabaja.</span></h2>
        </div>
        <div className="cmp" role="table" aria-label="Comparativa">
          <div className="cmp-r cmp-h" role="row"><span role="columnheader" />{COLS.map((c) => <span role="columnheader" key={c}>{c}</span>)}</div>
          {ROWS.map(([name, vals], r) => (
            <div className={'cmp-r' + (name === 'Priv8' ? ' me' : '')} role="row" key={name} style={{ '--r': r }}>
              <span role="rowheader">{name}</span>
              {vals.map((v, i) => <span role="cell" key={i} data-label={COLS[i]} style={{ '--c': i }}><Mark v={v} /></span>)}
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
  const [ref, seen] = useSeen(0.3);
  return (
    <section id="cumplimiento" className={'block block-cobalt laws' + (seen ? ' seen' : '')} aria-labelledby="h-laws" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="leer" say="Hecho para pasar auditoría." />
          <p className="eyebrow">Cumplimiento</p>
          <h2 id="h-laws">La IA entra en procesos con datos. <span className="soft">Tu cumplimiento, intacto.</span></h2>
          <p className="lead">Priv8 está diseñado para que tu equipo legal pueda decir que sí.</p>
        </div>
        <div className="laws-grid">
          {LAWS.map(([k, sub, t], i) => (<article key={k} className="law" style={{ '--d': i }}><h3><span className="seal">{k}</span></h3><p className="law-sub">{sub}</p><p>{t}</p><p className="law-ok" aria-hidden="true">revisado · en el registro</p></article>))}
        </div>
        <p className="more-row"><a className="more" href="cumplimiento/">Cumplimiento en detalle</a></p>
      </div>
    </section>
  );
}

