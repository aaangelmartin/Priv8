import { createContext, useContext, useEffect, useState } from 'react';
import Eight from '../eight/Eight.jsx';
import Field from '../Field.jsx';
import correo from './img/correo.jpg';
import consola from './img/consola.jpg';
import alarma from './img/alarma.jpg';
import { QR } from './qr.js';
import './annex.css';
import './arch.css';
import pablo from './img/pablo.png';
import angel from './img/angel.png';
import alvaro from './img/alvaro.png';
import marco from './img/marco.png';

/* Las diapositivas del pitch: 15 y el anexo de preguntas del jurado. */
export const SlideCtx = createContext({ live: false, active: false, moving: false, phase: 'final', printing: false, n: '', annex: false });

const COL = { band: { fg: '#FFFFFF', cut: '#2D45D6' }, paper: { fg: '#2D45D6', cut: '#FFFFFF' }, bad: { fg: '#C23A2E', cut: '#FBE5E3' }, ok: { fg: '#1F8A5B', cut: '#FFFFFF' }, warn: { fg: '#A86400', cut: '#FFFFFF' }, badw: { fg: '#C23A2E', cut: '#FFFFFF' } };

/* 8 vivo; solo se monta en la diapositiva que se ve (y en todas al imprimir) */
function E({ mode = 'mirar', on = 'band', className = '', seq = null, id, look = null }) {
  const { live, active } = useContext(SlideCtx);
  const [m, setM] = useState(seq ? seq[0][0] : mode);
  useEffect(() => {
    if (!seq) { setM(mode); return undefined; }
    if (!active) { setM(seq[seq.length - 1][0]); return undefined; }
    let i = 0, t = 0;
    const step = () => { setM(seq[i][0]); const d = seq[i][1]; i += 1; if (i < seq.length && d) t = setTimeout(step, d); };
    step();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode]);
  return (
    <div id={id} className={'e8 ' + className} aria-hidden="true">
      {live && <Eight mode={m} look={look} fg={COL[on].fg} cut={COL[on].cut} label="8" />}
    </div>
  );
}

/* entrada escalonada: --d es el orden */
const R = ({ d = 0, as: T = 'div', className = '', children, ...p }) => <T className={'rv ' + className} style={{ '--d': d }} {...p}>{children}</T>;
const Tok = ({ children }) => <span className="tok">{children}</span>;

/* capturas reales de las grabaciones (media/*.jpg), si están en esta build */
const MEDIA = import.meta.glob('./media/*.jpg', { eager: true, query: '?url', import: 'default' });
const media = (n) => MEDIA[`./media/${n}`];
/* sin vídeos: enlaces a la demo en la web y a la demo local, que abre el panel */
function Links({ d }) {
  return (
    <R d={d} className="dlinks">
      <a className="dl web" href="https://demo.priv8.es" target="_blank" rel="noreferrer"><b>demo.priv8.es</b><span>Las grabaciones reales, desde cualquier navegador</span></a>
      <a className="dl loc" href="http://127.0.0.1:5170" target="_blank" rel="noreferrer"><b>Demo local - 127.0.0.1:5170</b><span>Doble clic en «Demo Priv8.command» o <code>make panel</code>: abre el panel en tu máquina</span></a>
    </R>
  );
}
const HAS = (n) => !!media(n + '.jpg');

function Foot() {
  const { n, annex } = useContext(SlideCtx);
  return (
    <footer className="sfoot" aria-hidden="true">
      <span className="brand">Priv8</span>
      <span>{n}</span>
    </footer>
  );
}

function Head({ eyebrow, children, d = 0, chip }) {
  return (
    <header className="shead">
      {eyebrow && <R d={d} as="p" className="eyebrow">{eyebrow}{chip && <span className="chip">{chip}</span>}</R>}
      <R d={d + 1} as="h2">{children}</R>
    </header>
  );
}

/* ---------------------------------------------------------------- 1 portada */
function Portada() {
  const { active, moving } = useContext(SlideCtx);
  const show = active || moving;
  return (
    <div className={'in portada' + (show ? ' live' : '')}>
      {show && <Field />}
      {show && <div className="clean" />}
      <div className="top"><span className="brand">Priv8</span><span>priv8.es</span></div>
      <div className="center">
        <E id={active ? 'hero-anchor' : undefined} className="e-hero rv" />
        <R d={1} as="h1"><span className="line">8 hace el trámite.</span><span className="line soft">Sin ver tus datos.</span></R>
        <R d={3} as="p" className="who">Ángel Martín, Álvaro Carpintero, Pablo Rojo y Marco Barroso</R>
        <R d={4} as="p" className="event">Hackfinance - Madrid Engineering Week - 12 nov 2026</R>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 2 problema B2B */
const LUMEN = [
  ['Proveedor', 'Suministros Lumen S.L.'],
  ['CIF', 'B12345674'],
  ['Factura', 'F-2026-0412'],
  ['Importe', '1.254,30 €'],
  ['IBAN', 'ES91 2100 0418 4502 0005 1332'],
];
function Stat({ n, t, s, d }) {
  return (
    <R d={d} className="stat">
      <b>{n}</b>
      <p>{t}</p>
      <small>{s}</small>
    </R>
  );
}
function ProblemaB2B() {
  return (
    <div className="in split">
      <div className="col">
        <Head eyebrow="El problema - empresas y bancos"><span className="nw">Procesos que la IA ya sabe hacer.</span> <span className="soft nw">No se automatizan.</span></Head>
        <R d={3} className="screen">
          <div className="screen-bar"><i /><i /><i /><b>Alba Core</b><span>lo que recibiría la IA</span></div>
          {LUMEN.map(([k, v], i) => (
            <div className="srow" key={k} style={{ '--i': i }}><span className="k">{k}</span><span className="real">{v}</span></div>
          ))}
          <div className="leak"><b>5</b><span>datos reales al proveedor del modelo</span><E mode="miedo" on="bad" className="e-leak" /></div>
        </R>
        <R d={4} className="laws"><span>RGPD</span><span>Secreto bancario</span><span>SOC 2</span><em>no sería conforme</em></R>
      </div>
      <div className="col stats">
        <Stat d={4} n="67 %" t="de los grandes bancos, frenados por la privacidad" s="EY-Parthenon, 2025" />
        <Stat d={5} n="52 %" t="de los directivos: seguridad, privacidad o cumplimiento, primer freno de los agentes" s="Dynatrace, 2026" />
        <Stat d={6} n="97 %" t="de los datos privados de la pantalla se filtra sin protección" s="Tsinghua, 2026, PrivScreen" />
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 3 problema B2C */
const BANKS = [
  ['Banca Alcor', 'clave y SMS', '#0F5A52'],
  ['Brezo Banco', 'clave y huella', '#6B2E5F'],
  ['Nimbo Bróker', 'clave y código', '#2F3B4C'],
];
function ProblemaB2C() {
  return (
    <div className="in split rev">
      <div className="col stats">
        <Stat d={4} n="57 %" t="tiene cuentas en varios bancos" s="Visa, Pecunpay y Ditrendia, 2025" />
        <Stat d={5} n="33,8 %" t="no tiene competencias digitales básicas: 12,6 M de personas" s="Comisión Europea, Década Digital 2025" />
        <Stat d={6} n="+600.000" t="firmas de «Soy mayor, no idiota»: muchas personas no saben hacer sus gestiones en la app" s="elDiario.es, 2022" />
      </div>
      <div className="col">
        <Head eyebrow="El problema - personas"><span className="nw">Gestionar el banco cuesta.</span> <span className="soft nw">Y ninguna IA lo hace sin verlo todo.</span></Head>
        <div className="phones3">
          {BANKS.map(([b, a, c], i) => (
            <R d={3 + i} key={b} className="mini" style={{ '--d': 3 + i, '--bk': c }}>
              <div className="mini-top"><b>{b}</b></div>
              <div className="mini-body"><i /><i /><i className="short" /></div>
              <span className="auth">{a}</span>
            </R>
          ))}
        </div>
        <R d={6} className="central"><E mode="miedo" on="bad" className="e-central" /><p><b>Un asistente para todos tus bancos</b><span>hoy recibiría los saldos, movimientos y claves de todos.</span></p></R>
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 4 qué podría hacer */
const CAN = [
  ['Empresas', 'Registrar facturas de proveedores en el ERP', '‹IMPORTE_1›'],
  ['Empresas', 'Conciliar el banco con la contabilidad', '‹IBAN_1-propio›'],
  ['Empresas', 'Dar de alta clientes y proveedores', '‹CIF_1›'],
  ['Personas', '«¿Cuánto tengo entre mis bancos?»', '‹SUMA_1›'],
  ['Personas', 'Pagar un recibo o pasar dinero entre cuentas', '‹IMPORTE_2›'],
  ['Personas', 'Ayudar a quien no sabe usar la app', '‹NOMBRE_1›'],
];
function Podria() {
  return (
    <div className="in can">
      <Head eyebrow="Para todos"><span className="nw">Si la IA pudiera actuar</span> <span className="soft nw">sin ver tus datos.</span></Head>
      <div className="cangrid">
        {CAN.map(([w, t, k], i) => (
          <R d={3 + i * 0.5} key={t} className={'cancard ' + (w === 'Personas' ? 'p' : 'b')}>
            <small>{w}</small>
            <b>{t}</b>
            <Tok>{k}</Tok>
          </R>
        ))}
      </div>
      <R d={7} as="p" className="can-note">Lo que hoy se hace a mano, o no se hace, por miedo a exponer datos.</R>
      <E mode="curiosidad" on="paper" className="e-qa rv" />
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 4 cómo funciona */
/* la misma pantalla, real y como la ve el modelo; clase y cómo se decide */
const SCREEN = [
  ['Titular', 'Lucía Gómez Ruiz', '‹NOMBRE_1-titular›', 'tk', 'nombre por contexto y bóveda'],
  ['DNI', '12345678Z', '‹DNI_1›', 'tk', 'patrón y letra de control'],
  ['IBAN', 'ES91 2100 0418 4502 0005 1332', '‹IBAN_1-propio›', 'tk', 'patrón y mod-97'],
  ['Saldo', '12.050,00 €', '‹IMPORTE_2-positivo›', 'tk', 'regla del sitio (selector)'],
  ['Clave', '••••••', null, 'no', 'campo de contraseña: siempre rojo'],
  ['Botón', 'Transferir', 'Transferir', 'ok', 'interfaz, la regla lo declara legible'],
];
const CLS = { ok: 'verde', tk: 'ámbar', no: 'rojo' };
function Como1() {
  return (
    <div className="in how">
      <Head eyebrow="Cómo funciona - 3 de 5 - Qué sale al modelo"><span className="nw">La misma pantalla, dos versiones.</span> <span className="soft nw">Solo una sale de tu máquina.</span></Head>
      <R d={3} className="twin">
        <div className="tw-h"><span>Campo</span><span>Tu pantalla (real, en local)</span><span /><span>Lo que recibe el modelo</span><span>Clase y cómo se decide</span></div>
        {SCREEN.map(([k, v, t, c, why], i) => (
          <div className="tw-r rv" key={k} style={{ '--d': 3.5 + i * 0.4 }}>
            <span className="k">{k}</span>
            <em className={c === 'ok' ? 'ui' : 'real'}>{v}</em>
            <i className="tw-a" />
            {c === 'no' ? <span className="never">null - nunca sale</span> : c === 'ok' ? <span className="ui">{t}</span> : <span className="tok">{t}</span>}
            <span className={'why ' + c}><b>{CLS[c]}</b>{why}</span>
          </div>
        ))}
      </R>
      <div className="clases row">
        <R d={6} className="clase ok"><E mode="mirar" on="ok" className="e-clase" /><b>Verde - se ve</b><span>Botones, etiquetas, títulos, menús. El modelo los necesita para moverse.</span></R>
        <R d={6.4} className="clase tk"><E mode="nove" on="warn" className="e-clase" /><b>Ámbar - se tokeniza</b><span>IBAN, DNI, NIE, CIF, nombres, importes, teléfonos, correos, movimientos. Hacen falta para el trámite, no su valor.</span></R>
        <R d={6.8} className="clase no"><E mode="nuncasale" on="badw" className="e-clase" /><b>Rojo - nunca sale</b><span>Contraseñas, PIN, usuario, OTP, tarjeta completa. Llegan como null y ni entran en la bóveda.</span></R>
      </div>
      <Foot />
    </div>
  );
}

const SURF = [
  { tag: 'Web - B2B', t: 'Playwright lee el DOM', steps: [
    ['Lee', 'El DOM de la app real (Alba Core, el correo). No píxeles.'],
    ['Clasifica', 'Cada elemento, por la regla del sitio (selector) y los detectores.'],
    ['Envía', 'Una instantánea con id, rol, etiqueta y tokens de cada elemento.'],
    ['Actúa', 'tap y type: el ejecutor local escribe el valor real.'],
  ], snap: ['e12 textbox «IBAN» ‹IBAN_1-maestro›', 'e14 textbox «Importe» ‹IMPORTE_1›', 'e19 button «Registrar factura»'], note: 'La vista de 8 de la consola es un espejo censurado del DOM: lo mismo que recibe el modelo, en su sitio.' },
  { tag: 'Android - B2C', t: 'Un servicio de accesibilidad', steps: [
    ['Lee', 'El AccessibilityService de la app Priv8 lee el árbol de accesibilidad de los bancos. Sin capturas.'],
    ['Puente', 'WebSocket local en 127.0.0.1:8765 (adb reverse) hasta el núcleo, que tokeniza.'],
    ['Actúa', 'Vuelven acciones de accesibilidad (click, setText) y se ejecutan en el móvil.'],
    ['Pausa', 'En PIN u OTP el núcleo se para y 8 mira a otro lado.'],
  ], snap: ['n4 text «Saldo» ‹IMPORTE_2-positivo›', 'n7 edit «Clave» null - nunca sale', 'n9 button «Transferir»'], note: 'Voz mixta: la voz local dice cifras y nombres; la de la nube, solo frases sin datos.' },
];
function Captura() {
  return (
    <div className="in how">
      <Head eyebrow="Cómo funciona - 1 de 5 - Cómo cogemos los datos"><span className="nw">Leemos la estructura, no la imagen.</span> <span className="soft nw">En la web y en el móvil.</span></Head>
      <div className="surf">
        {SURF.map((x, j) => (
          <R d={3 + j} key={x.tag} className="sf">
            <p className="pz-k">{x.tag}</p>
            <h3>{x.t}</h3>
            <ol>{x.steps.map(([k, d], i) => <li key={k}><b>{i + 1}</b><span><strong>{k}</strong>{d}</span></li>)}</ol>
            <div className="snap"><small>lo que recibe el modelo</small>{x.snap.map((l) => <code key={l}>{l}</code>)}</div>
            <p className="cap dark">{x.note}</p>
          </R>
        ))}
      </div>
      <R d={6} as="p" className="foot-note">En las dos superficies el modelo solo recibe resultados de <code>observe</code>, <code>act</code> y <code>oracle</code>, con tokens.</R>
      <Foot />
    </div>
  );
}

const PIPE = [
  ['Pantalla', 'DOM web o árbol de accesibilidad. Nunca píxeles.'],
  ['Regla del sitio', 'Política por pantalla: cada selector trae clase, tipo y origen.'],
  ['Detector', 'Patrones validados: IBAN mod-97, letra del DNI/NIE, control del CIF, Luhn.'],
  ['Bóveda', 'Valores ya vistos y nombres de personas. Mismo valor, mismo token.'],
  ['Bloqueo final', 'Revisa la petición entera. Si queda un valor real, no sale.'],
];
function Como2() {
  return (
    <div className="in how">
      <Head eyebrow="Cómo funciona - 2 de 5 - Cómo los filtramos"><span className="nw">Cada dato pasa cinco filtros.</span> <span className="soft nw">Lo que no tiene regla, no sale.</span></Head>
      <div className="pipe">
        {PIPE.map(([t, d], i) => (
          <R d={3 + i * 0.5} key={t} className={'pp' + (i === 4 ? ' last' : '')}><b>{i + 1}</b><h3>{t}</h3><p>{d}</p></R>
        ))}
        <R d={5.6} className="pp model"><E mode="leer" on="paper" className="e-pp" /><h3>Modelo</h3><p>Solo tokens e interfaz.</p></R>
      </div>
      <div className="how2b">
        <R d={6} className="anat">
          <p className="zone">Cómo es un token</p>
          <div className="big-tok"><span className="t1">‹</span><span className="a">IBAN</span><span className="t1">_</span><span className="b">1</span><span className="t1">-</span><span className="c">propio</span><span className="t1">›</span></div>
          <div className="anat-l"><span className="a"><b>Tipo</b>qué es: IBAN, DNI, IMPORTE, NOMBRE</span><span className="b"><b>Número</b>estable en la sesión: el mismo valor, siempre el mismo token</span><span className="c"><b>Etiqueta</b>lo justo para decidir: origen o signo</span></div>
        </R>
        <R d={6.6} className="vault">
          <p className="zone">La bóveda - solo en tu entorno</p>
          <table><tbody>
            <tr><td><Tok>‹IBAN_1-propio›</Tok></td><td>ES91 2100 0418 …</td><td>origen: ficha</td></tr>
            <tr><td><Tok>‹IBAN_2-correo›</Tok></td><td>ES76 0182 2370 …</td><td>origen: correo</td></tr>
            <tr><td><Tok>‹IMPORTE_1›</Tok></td><td>1.254,30 €</td><td>origen: factura</td></tr>
          </tbody></table>
          <p className="cap dark">Una por sesión. Guarda dónde se vio cada valor: eso es la procedencia.</p>
        </R>
      </div>
      <Foot />
    </div>
  );
}

function Pieza({ d, t, k, children, ex }) {
  return (
    <R d={d} className="pz">
      <p className="pz-k">{k}</p>
      <h3>{t}</h3>
      <p>{children}</p>
      {ex && <code className="pz-ex">{ex}</code>}
    </R>
  );
}
const ACT = ['El modelo pide act con un token', '¿Token de esta sesión?', '¿Procedencia válida para ese campo?', '¿Acción crítica? Espera tu «sí»', 'Rehidrata en local y escribe'];
function Como3() {
  return (
    <div className="in how">
      <Head eyebrow="Cómo funciona - 4 de 5 - Cómo actúa sin ver"><span className="nw">8 trabaja con tokens.</span> <span className="soft nw">Tu máquina pone los valores.</span></Head>
      <R d={3} className="actflow">
        {ACT.map((s, i) => <span key={s} className="af rv" style={{ '--d': 3 + i * 0.3 }}><b>{i + 1}</b>{s}</span>)}
      </R>
      <div className="pzs">
        <Pieza d={5} k="Ejecutor" t="Escribe sin conocer el dato" ex="act(escribir, ‹IBAN_1-propio›)">El ejecutor cambia el token por el valor real en tu máquina y lo pone en la pantalla. Un token que no existe en la sesión no se escribe.</Pieza>
        <Pieza d={5.5} k="Oráculo" t="Calcula sin revelar" ex="compare(‹SALDO_1›, ‹IMPORTE_1›) → mayor">sum, compare y matches, en local. sum da un ‹SUMA_n› nuevo y su tramo, nunca la cifra. Con presupuesto de preguntas: comparar a ciegas no reconstruye un saldo.</Pieza>
        <Pieza d={6} k="Procedencia" t="Cada dato sabe de dónde viene" ex="‹IBAN_2-correo› → IBAN de pago: rechazado">Un campo solo admite tokens de su tipo vistos en un origen aceptado. El IBAN del correo no entra en el pago, y solo se llama al teléfono de la ficha.</Pieza>
      </div>
      <R d={7} as="p" className="foot-note">El modelo solo tiene tres herramientas cerradas: <code>observe</code>, <code>act</code> y <code>oracle</code>. Sin eval, sin CDP, sin adb y sin código propio.</R>
      <Foot />
    </div>
  );
}

function Como4() {
  return (
    <div className="in how">
      <Head eyebrow="Cómo funciona - 5 de 5 - Control"><span className="nw">Cuatro barreras que no dependen del modelo.</span> <span className="soft nw">Y todo queda escrito.</span></Head>
      <div className="pzs four">
        <Pieza d={3} k="1 - Modo estricto" t="De serie, lo mínimo" ex="sin regla → no llega">Al modelo solo llega lo que cubre una regla del sitio. Un texto sin regla no sale, aunque el detector no lo reconozca.</Pieza>
        <Pieza d={4} k="2 - Bloqueo final" t="Si algo se escapa, no sale" ex="blocked: fuga">Cada petición al modelo o a la voz en la nube se revisa entera: patrones, datos rojos y cualquier valor de la bóveda. Falla cerrado.</Pieza>
        <Pieza d={5} k="3 - Tu «sí»" t="Confirmación obligatoria" ex="held → caduca en 5 min">Transferir, invertir, firmar, enviar y llamar esperan tu «sí». Huella, clave u OTP los pones tú, y 8 mira a otro lado.</Pieza>
        <Pieza d={6} k="4 - Registro firmado" t="Qué vio, qué se bloqueó, quién aprobó" ex="JSONL encadenado + ed25519">Cada línea se encadena por hashes y se firma. Si alguien altera una, la verificación lo detecta. Evidencia para auditoría.</Pieza>
      </div>
      <E mode="listo" on="band" className="e-gtm rv" />
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 5 arquitectura: dónde vive cada cosa y las ocho piezas */
const PIECES = [
  ['Detector', 'Decide qué es cada dato: reglas del sitio, IBAN, DNI, tarjetas y nombres.'],
  ['Tokens y bóveda', 'Cambia cada valor por ‹TIPO_n›. La tabla solo vive en tu máquina.'],
  ['Procedencia', 'Sabe de dónde viene cada dato: el IBAN de un correo no entra en un pago.'],
  ['Oráculo', 'Suma y compara sin revelar la cifra, con un presupuesto de preguntas.'],
  ['Ejecutor', 'Escribe en pantalla el valor real del token que pide el modelo.'],
  ['Tu «sí»', 'Registrar, transferir, firmar o enviar esperan tu confirmación.'],
  ['Bloqueo final', 'Revisa cada petición que sale: si lleva un valor real, no sale.'],
  ['Registro firmado', 'Qué vio el modelo, qué se bloqueó y qué aprobaste, firmado.'],
];
const VAULT = [['ES71 9400 0007 0206 0223 3441', '‹IBAN_1-propio›'], ['Suministros Lumen', '‹NOMBRE_1›'], ['1.180,00 €', '‹IMPORTE_3›']];
function Arquitectura() {
  return (
    <div className="in arq">
      <Head eyebrow="Arquitectura - 1 de 2"><span className="nw">Dónde vive cada cosa.</span> <span className="soft nw">Al modelo solo cruzan tokens.</span></Head>
      <div className="arq-map">
        <R d={3} className="arq-zone arq-local">
          <p className="arq-k">Tu máquina - ve valores reales</p>
          <div className="arq-ends"><span><b>Web</b>ERP y correo, por DOM</span><span><b>Móvil</b>Árbol de accesibilidad</span></div>
          <div className="arq-core">
            <p className="arq-core-h"><E mode="mirar" on="paper" className="e-arq" />Núcleo Priv8<small>librería Python, en el mismo proceso</small></p>
            <div className="arq-vault">
              {VAULT.map(([v, t], i) => <R d={4 + i * 0.4} key={t} className="arq-vrow"><span className="arq-real">{v}</span><i /><Tok>{t}</Tok></R>)}
            </div>
            <p className="arq-note">La tabla token - valor no sale de aquí.</p>
          </div>
          <div className="arq-ends"><span><b>Consola</b>Auditoría</span><span><b>App 8</b>Renderizador y voz local</span></div>
        </R>
        <div className="arq-wire">
          <R d={6} className="arq-w arq-out"><span>solo tokens</span><i /></R>
          <R d={7} className="arq-w arq-in"><i /><span>3 herramientas</span></R>
          <R d={7.5} className="arq-tools"><code>observe</code><code>act</code><code>oracle</code></R>
        </div>
        <R d={5} className="arq-zone arq-cloud">
          <p className="arq-k">Nube - no ve valores</p>
          <div className="arq-box"><b>Cualquier modelo</b><span>Recibe ‹IBAN_1› y responde con tokens. Sin navegador, sin sistema, sin código propio.</span></div>
          <div className="arq-box"><b>Voz en la nube</b><span>Solo frases sin datos. Cifras y nombres, con la voz local.</span></div>
        </R>
      </div>
      <Foot />
    </div>
  );
}
function Piezas() {
  return (
    <div className="in arq">
      <Head eyebrow="Arquitectura - 2 de 2"><span className="nw">Las ocho piezas.</span> <span className="soft nw">Ninguna depende de que el modelo obedezca.</span></Head>
      <ol className="arq-pieces">
        {PIECES.map(([p, t], i) => (
          <R d={3 + i * 0.35} as="li" key={p} className="arq-piece">
            <span className="arq-n">{i + 1}</span>
            <b>{p}</b>
            <p>{t.split(/(‹[^›]+›)/).map((s, j) => (/^‹/.test(s) ? <Tok key={j}>{s}</Tok> : s))}</p>
          </R>
        ))}
      </ol>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 6 demo 1 */
function Phone({ state, mode, children, d }) {
  return (
    <R d={d} className="phone">
      <div className="ph-top"><E mode={mode} on="band" className="e-ph" /><span>{state}</span></div>
      <div className="ph-body">{children}</div>
    </R>
  );
}
function Demo1() {
  if (HAS('b2c')) {
    return (
      <div className="in demo2 vid">
        <Head eyebrow="Demo - Priv8 en el móvil" chip="en directo"><span className="nw">«¿Cuánto tengo entre mis bancos?»</span> <span className="soft nw">8 suma sin ver la cifra.</span></Head>
        <div className="vrow rev">
          <Links d={7} />
          <div className="vcaps">
            <R d={4} className="scap"><b>1</b><p><strong>Recorre tus tres bancos</strong>Banca Alcor, Brezo Banco y Nimbo Bróker, por accesibilidad.</p></R>
            <R d={5} className="scap"><b>2</b><p><strong>El modelo ve <Tok>‹SUMA_1›</Tok></strong>La cifra solo suena con la voz del móvil.</p></R>
            <R d={6} className="scap"><b>3</b><p><strong>«Pasa 200 € al bróker»</strong>Lo prepara, mira a otro lado en tu huella y espera tu «sí».</p></R>
          </div>
        </div>
        <Foot />
      </div>
    );
  }
  return (
    <div className="in demo">
      <Head eyebrow="Demo - Priv8 en el móvil" chip="en directo">«¿Cuánto tengo entre mis bancos?»</Head>
      <div className="phones">
        <div className="pcol">
          <Phone d={3} state="Escuchando" mode="escuchar">
            <p className="me">¿Cuánto tengo entre mis bancos?</p>
            <p className="sys">Recorre Banca Alcor, Brezo Banco y Nimbo Bróker</p>
          </Phone>
          <R d={4} as="p" className="pcap"><b>1</b>Recorre tus bancos y suma sin ver la cifra</R>
        </div>
        <div className="pcol">
          <Phone d={5} state="Hablando" mode="hablar">
            <p className="me">¿Cuánto tengo entre mis bancos?</p>
            <p className="it">Entre tus tres cuentas tienes <mark>17.977,98 €</mark>.</p>
            <p className="sys">voz local - el modelo solo ve <Tok>‹SUMA_1›</Tok></p>
          </Phone>
          <R d={6} as="p" className="pcap"><b>2</b>La cifra solo suena en tu móvil</R>
        </div>
        <div className="pcol">
          <Phone d={7} state="Mira a otro lado" mode="apartar">
            <p className="me">Pasa 200 € al bróker</p>
            <div className="confirm"><b>200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?</b><span className="row2"><i className="yes">Confirmar</i><i>Cancelar</i></span></div>
            <p className="sys">Huella, clave u OTP: 8 no mira</p>
          </Phone>
          <R d={8} as="p" className="pcap"><b>3</b>«Pasa 200 € al bróker». Tu huella, 8 no la ve</R>
        </div>
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 7 demo 2 */
function Shot({ src, alt, title, d, className = '', z = 1, x = '0', y = '0' }) {
  return (
    <R d={d} className={'shot ' + className}>
      <div className="screen-bar"><i /><i /><i /><b>{title}</b></div>
      <div className="crop" style={{ '--z': z, '--x': x, '--y': y }}><img src={src} alt={alt} /></div>
    </R>
  );
}
function Demo2() {
  if (HAS('b2b')) {
    return (
      <div className="in demo2 vid">
        <Head eyebrow="Demo - Priv8 para empresas" chip="en directo"><span className="nw">Una factura llega por correo.</span> <span className="soft nw">8 la registra sin ver los datos.</span></Head>
        <div className="vrow">
          <div className="vcaps">
            <R d={4} className="scap"><b>1</b><p><strong>Lee el correo y abre Alba Core</strong>Al modelo le llegan <Tok>‹CIF_1›</Tok> e <Tok>‹IMPORTE_1›</Tok>.</p></R>
            <R d={5} className="scap"><b>2</b><p><strong>Registra la factura</strong>El ejecutor escribe los valores reales y espera tu «sí», que queda firmado.</p></R>
            <R d={6} className="scap"><b>3</b><p><strong>«Posible fraude detectado»</strong>La cuenta nueva del correo no entra en el pago.</p></R>
          </div>
          <Links d={7} />
        </div>
        <Foot />
      </div>
    );
  }
  return (
    <div className="in demo2">
      <Head eyebrow="Demo - Priv8 para empresas" chip="consola real"><span className="nw">Una factura llega por correo.</span> <span className="soft nw">8 la registra sin ver los datos.</span></Head>
      <div className="shots">
        <div className="scol">
          <Shot d={3} src={correo} alt="Correo de Suministros Lumen con la factura F-2026-0412 y un cambio de cuenta" title="Correo" z={1.6} x="-20%" y="-14%" />
          <R d={4} className="scap"><b>1</b><p><strong>Sin Priv8: 5 datos fuera.</strong> El correo trae la factura y una cuenta nueva.</p></R>
        </div>
        <div className="scol">
          <Shot d={5} src={consola} alt="La consola de Priv8: Alba Core con todos los campos en tokens, esperando la confirmación" title="Consola: lo que ve 8" z={1.38} x="-1%" y="-12%" />
          <R d={6} className="scap"><b>2</b><p><strong>Con Priv8: solo tokens.</strong> Registra en Alba Core y espera tu «sí», que queda firmado.</p></R>
        </div>
        <div className="scol">
          <Shot d={7} src={alarma} alt="Alarma de la consola: posible fraude, un correo pide cambiar la cuenta de pago" title="Consola: alarmas" className="bad" z={1.1} x="-1.5%" y="-2%" />
          <R d={8} className="scap"><b>3</b><p><strong>La otra cuenta, bloqueada.</strong> La consola avisa: «Posible fraude».</p></R>
        </div>
        <E mode="enfado" on="paper" className="e-fraud rv" />
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- dos verticales */
function Verticales() {
  return (
    <div className="in markets">
      <Head eyebrow="Producto"><span className="nw">Un núcleo,</span> <span className="soft nw">dos productos.</span></Head>
      <div className="mk">
        <R d={3} className="vcard">
          <p className="tag">B2B</p>
          <h3>Priv8 para empresas</h3>
          <p>8 trabaja en tu ERP o tu CRM de siempre, aunque no tenga API. Facturas, conciliación, altas.</p>
          <div className="vt"><Tok>‹IMPORTE_1›</Tok><Tok>‹CIF_1›</Tok><span className="never">bloqueo por origen</span></div>
        </R>
        <R d={5} className="hub"><E mode="mirar" on="band" className="e-hub" /><span>Núcleo Priv8</span></R>
        <R d={4} className="vcard">
          <p className="tag">B2C</p>
          <h3>Priv8 en el móvil</h3>
          <p>Una app para llevar todas tus cuentas desde el móvil, con seguridad. Le hablas a 8: suma, prepara y espera tu «sí». Tu clave la pones tú.</p>
          <div className="vt"><Tok>‹SUMA_1›</Tok><Tok>‹IBAN_2›</Tok><span className="never">nunca sale</span></div>
        </R>
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- foco, cliente y B2C */
function Foco() {
  return (
    <div className="in gtm">
      <Head eyebrow="Negocio"><span className="nw">Dos productos,</span> <span className="soft nw">dos clientes.</span></Head>
      <div className="steps foco">
        <R d={3} className="gstep"><b className="gn">1</b><h3>En qué nos centramos</h3><span className="gs">B2B</span><p>Procesos de back office que hoy no se automatizan por protección de datos. Empezamos por cuentas a pagar.</p></R>
        <R d={4} className="gstep"><b className="gn">2</b><h3>Nuestro cliente</h3><span className="gs">quien paga</span><p>Bancos y brókers, departamentos financieros de empresas medianas y grandes, y quien construye agentes para ellos. Licencia por proceso.</p></R>
        <R d={5} className="gstep"><b className="gn">3</b><h3>Priv8 en el móvil</h3><span className="gs">para personas</span><p>Una app para gestionar todas tus cuentas desde el móvil, con seguridad. La persona se la descarga y paga una suscripción.</p></R>
        <R d={2} className="rail" />
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- mercado: TAM, SAM y SOM */
const MK = [
  { tag: 'B2B - Priv8 para empresas', rows: [
    ['TAM', '7.000 M$', 'software de cuentas a pagar en el mundo, 2030', 'Grand View Research, 2024'],
    ['SAM', '212 M€', '35.354 empresas en España con 50 o más empleados, a 6.000 € al año', 'Cifras PYME, sept. 2026; precio, estimación propia'],
    ['SOM', '0,56 M€', '60 empresas y 2 bancos o BPO en 3 años', 'estimación propia'],
  ] },
  { tag: 'B2C - Priv8 en el móvil', rows: [
    ['TAM', '27,8 M', 'personas con banca online en España (74,7 % de 16 a 74 años)', 'INE, TIC-H 2025; Eurostat'],
    ['SAM', '15,8 M', 'con cuentas en varios bancos (57 %)', 'Visa, Pecunpay y Ditrendia, 2025; cálculo propio'],
    ['SOM', '0,6 M€', '100.000 usuarios activos de 1 o 2 bancos, a 6 € al año', 'estimación propia'],
  ] },
];
function Mercados() {
  return (
    <div className="in markets">
      <Head eyebrow="Mercado"><span className="nw">Dos mercados,</span> <span className="soft nw">un mismo núcleo.</span></Head>
      <div className="mk2">
        {MK.map((m, j) => (
          <R d={3 + j} key={m.tag} className="mcol">
            <p className="tag">{m.tag}</p>
            {m.rows.map(([k, n, t, src], i) => (
              <div key={k} className={'big' + (k === 'SOM' ? ' obj' : '')} style={{ '--w': `${100 - i * 14}%` }}>
                <small>{k}</small><b>{n}</b><span>{t}</span><em>{src}</em>
              </div>
            ))}
          </R>
        ))}
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 9 competencia */
const B2B_T = {
  head: ['Priv8', 'Enmascarado propio', 'RPA con IA', 'Agentes BPO'],
  sub: ['', 'como MyInvestor', 'UiPath', 'Zomma'],
  rows: [['Pantallas sin API', 'y', 'n', 'y', 'y'], ['La IA no ve datos', 'y', 'en el chat', 'parcial', 'n'], ['Bloquea por origen', 'y', 'n', 'n', 'n']],
};
const B2C_T = {
  head: ['8', 'Agregadores', 'Tu banco en un chat', 'Agentes generales'],
  sub: ['', 'Fintonic', 'MyInvestor en ChatGPT', 'ChatGPT, Gemini'],
  rows: [['Todas tus cuentas', 'y', 'y', 'n', 'y'], ['Hace la gestión', 'y', 'n', 'n', 'y'], ['La IA no ve datos', 'y', '-', 'n', 'n']],
};
function Cell({ v }) {
  if (v === 'y') return <td><span className="mark ok" aria-label="sí">sí</span></td>;
  if (v === 'n') return <td><span className="mark no" aria-label="no">no</span></td>;
  if (v === '-') return <td><span className="mark na" aria-label="no aplica">no aplica</span></td>;
  return <td><span className="mark part">{v}</span></td>;
}
function Table({ t, title, d }) {
  return (
    <R d={d} className="tbl">
      <table>
        <thead>
          <tr><th className="tt">{title}</th>{t.head.map((h, i) => <th key={h} className={i === 0 ? 'us' : ''}>{h}{t.sub[i] && <small>{t.sub[i]}</small>}</th>)}</tr>
        </thead>
        <tbody>
          {t.rows.map(([k, ...v]) => <tr key={k}><th>{k}</th>{v.map((x, i) => <Cell key={i} v={x} />)}</tr>)}
        </tbody>
      </table>
    </R>
  );
}
function Competencia() {
  return (
    <div className="in comp">
      <Head eyebrow="Competencia"><span className="nw">Otros enmascaran o enseñan.</span> <span className="soft nw">8 hace el trámite sin ver.</span></Head>
      <div className="tbls">
        <Table d={3} t={B2B_T} title="B2B" />
        <Table d={4} t={B2C_T} title="B2C" />
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- cómo llegamos */
const GTM = [
  ['1', 'Piloto', 'semanas 1 a 4', 'Un banco o una empresa', 'Un proceso de cuentas a pagar sobre su ERP, sin tocar el ERP', 'Datos expuestos (objetivo 0), fraudes bloqueados, horas ahorradas', 'Piloto de pago, descontable de la licencia', 'Primer caso medido'],
  ['2', 'Su back office', 'meses 2 a 12', 'El mismo cliente', 'Facturas, conciliación y altas de clientes y proveedores', 'Procesos activos, documentos al mes, coste por tarea', 'Licencia por proceso + unos 0,50 € por documento', 'Primer contrato anual'],
  ['3', 'Priv8 en el móvil', 'años 1 y 2', 'Personas con varios bancos', 'La app para todas tus cuentas, en las tiendas', 'Usuarios activos, bancos conectados, trámites hechos', 'Suscripción de unos 6 € al año', 'App publicada'],
  ['4', 'Más empresas', 'años 2 y 3', 'Integradores de ERP y BPO', 'El mismo núcleo en otros procesos y sectores', 'Socios, pantallas con reglas listas, clientes por socio', 'Reparto de ingresos con el socio', 'ISO 27001 y SOC 2'],
];
function Mercado() {
  return (
    <div className="in gtm">
      <Head eyebrow="Cómo llegamos"><span className="nw">Un piloto en empresas.</span> <span className="soft nw">La app, directa a las personas.</span></Head>
      <div className="tl">
        <R d={2} className="tl-rail" />
        {GTM.map(([n, f, w, who, what, kpi, pay, ms], i) => (
          <R d={3 + i * 0.6} key={n} className="tl-c">
            <p className="tl-w"><b className="gnum">{n}</b>{w}</p>
            <h3>{f}</h3>
            <p className="tl-who">{who}</p>
            <p className="tl-what">{what}</p>
            <div className="tl-k"><small>Medimos</small><span>{kpi}</span></div>
            <div className="tl-k pay"><small>Cobramos</small><span>{pay}</span></div>
            <p className="tl-ms">Hito: {ms}</p>
          </R>
        ))}
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 11 equipo */
const TEAM = [
  ['Ángel Martín', 'aaangelmartin', 'Ingeniero - diseño y producto', 'Agente, Android, voz y toda la marca', angel],
  ['Álvaro Carpintero', 'alvaarocl', 'Ingeniero - negocio y operaciones', 'Empresa: ERP, correo, consola y telefonía', alvaro],
  ['Pablo Rojo', 'rrojjo', 'Ingeniero - seguridad y protocolos', 'Núcleo: detector, bóveda, oráculo y auditoría', pablo],
  ['Marco Barroso', 'marcoobarroso', 'Ingeniero - producto móvil', 'App 8, bancos simulados y dictado', marco],
];
function Equipo() {
  return (
    <div className="in team">
      <Head eyebrow="Equipo"><span className="nw">Cuatro ingenieros,</span> <span className="soft nw">cada uno con otra disciplina.</span></Head>
      <div className="people">
        {TEAM.map(([n, gh, f, r, img], i) => (
          <R d={3 + i} key={n} className="person">
            <img src={img} alt="" />
            <h3>{n}</h3>
            <span className="field-t">{f}</span>
            <p>{r}</p>
            <code>@{gh}</code>
          </R>
        ))}
      </div>
      <R d={7} as="p" className="team-note">Todos ingenieros. En tres días: el núcleo, la consola, un ERP simulado, tres bancos y la app Android, funcionando.</R>
      <E mode="agradecer" on="paper" className="e-team rv" />
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- cierre */
/* azul: los módulos en blanco sobre el cobalto de la diapositiva (QR invertido, lo leen las cámaras de iOS y Android) */
function Qr({ rows, label, azul = false }) {
  const n = rows.length;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill={azul ? '#2d45d6' : '#fff'} />
      {rows.map((r, y) => [...r].map((c, x) => (c === '1' ? <rect key={x + '-' + y} x={x} y={y} width="1.02" height="1.02" fill={azul ? '#fff' : '#0b1b33'} /> : null)))}
    </svg>
  );
}
function Cierre() {
  const { active, moving } = useContext(SlideCtx);
  const show = active || moving;
  return (
    <div className={'in cierre' + (show ? ' live' : '')}>
      {show && <Field />}
      {show && <div className="clean" />}
      <div className="close5">
        <div className="c5-izq">
          <E id={active ? 'hero-anchor' : undefined} className="e-hero rv" seq={[['alegria', 2200], ['mirar', 0]]} />
          <R d={1} as="h2"><span className="line">El agente</span><span className="line">hace el trámite.</span><span className="line soft">Los datos se</span><span className="line soft">quedan contigo.</span></R>
        </div>
        <R d={3} className="c5-qr">
          <Qr rows={QR.web} label="Código QR a priv8.es" azul />
          <span className="cl-url">priv8.es</span>
          <span className="cl-sub">demo.priv8.es - mcp.priv8.es</span>
        </R>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- anexo */
/* cada entrada: [pregunta, respuesta, apoyo visual]. Tipos: nums, vs, flow, table, toks, split, eight, qr.
   face: la cara de 8 de la esquina, [modo, color] */
const QA1 = [
  ['¿Y si el modelo adivina la cifra a base de preguntas?', 'El oráculo calcula sin revelar: sum, compare y matches. Tiene presupuesto por sesión y por token, y responde por tramos o con una palabra, nunca con la cifra. Una búsqueda binaria no la reconstruye.',
    { t: 'flow', steps: [['oracle(sum)', 'lo pide el modelo'], ['Presupuesto', 'por sesión y por token'], ['‹SUMA_1›', 'y su tramo, nunca la cifra'], ['Sin presupuesto', 'denied']], bad: 3, face: ['pensar', 'paper'] }],
  ['¿Qué pasa con un dato en texto libre?', 'En modo estricto, el de serie, al modelo solo llega lo que cubre una regla del sitio. Además, patrones validados y la bóveda local. Si algo se escapa, el bloqueo final retiene la petición.',
    { t: 'flow', steps: [['Reglas del sitio', 'selectores, modo estricto'], ['Patrones validados', 'IBAN mod-97, DNI, Luhn'], ['Bóveda local', 'valores ya conocidos'], ['Bloqueo final', 'la petición no sale']], bad: 3, face: ['leer', 'paper'] }],
  ['¿Un token sigue siendo un dato personal?', 'Es seudonimización: la tabla token-valor no sale de la máquina. El RGPD sigue aplicando y el registro sirve de evidencia; no decimos que certifique nada.',
    { t: 'split', rows: [['ES71 9400 0007 0206 0223 3441', '‹IBAN_1-propio›'], ['1.180,00 €', '‹IMPORTE_3-positivo›'], ['Marco Barroso', '‹NOMBRE_2›']], face: ['mirar', 'paper'] }],
  ['¿Por qué no usar la API del ERP?', 'Porque muchos no la tienen, o integrarla cuesta meses. Priv8 trabaja sobre las pantallas que ya existen, leyendo el DOM y el árbol de accesibilidad, no píxeles.',
    { t: 'nums', items: [['0', 'cambios en el ERP'], ['0', 'APIs nuevas'], ['DOM', 'y accesibilidad, no píxeles']] }],
  ['¿Y la inyección de instrucciones en un correo?', 'No dependemos de que el modelo la ignore: la procedencia impide por diseño que un dato del correo entre en un campo de pago, y la consola avisa de posible fraude.',
    { t: 'flow', steps: [['Correo', 'trae un IBAN nuevo'], ['‹IBAN_2-correo›', 'origen: correo'], ['Campo de pago', 'rechazado por procedencia'], ['8 llama', 'al número de la ficha']], bad: 2, face: ['enfado', 'paper'] }],
  ['¿Cuánto añade de latencia y de coste?', 'El núcleo corre en local, en el mismo proceso que el servidor MCP; la consola mide la latencia de cada paso. El coste es el del modelo que elija el cliente, sin llamadas extra.',
    { t: 'nums', items: [['Local', 'en el mismo proceso'], ['0', 'llamadas extra al modelo'], ['Medida', 'latencia de cada paso']] }],
];
const QA2 = [
  ['¿Funciona con cualquier modelo?', 'Sí. El modelo solo recibe tokens y tiene tres herramientas cerradas. Ni navegador, ni sistema, ni código propio: sin eval, sin CDP, sin adb.',
    { t: 'toks', items: ['observe', 'act', 'oracle'], code: true, no: ['eval', 'CDP', 'adb'], cap: 'Las tres únicas herramientas del agente' }],
  ['¿Y la autenticación del banco (PSD2)?', 'La hace siempre la persona. Mientras pone huella, clave u OTP, 8 no recibe nada y mira a otro lado.',
    { t: 'eight', mode: 'apartar', on: 'paper', cap: 'Mirar a otro lado: huella, clave u OTP' }],
  ['¿El agente da consejos de inversión?', 'No. El asesoramiento está regulado: 8 ejecuta lo que la persona elige y dice «no puedo» si le piden consejo.',
    { t: 'eight', mode: 'rechazar', on: 'bad', cap: 'No puedo: asesoría de inversión' }],
  ['¿Cuánto cobraréis?', 'Licencia anual por proceso más un precio por documento. La cifra sale del coste por tarea que ya medimos y del ahorro frente a hacerlo a mano.',
    { t: 'nums', items: [['0,50 €', 'por documento'], ['+ licencia', 'anual por proceso']] }],
  ['¿Qué os diferencia de Tsinghua?', 'Su trabajo valida la idea en un emulador. Nosotros añadimos lo que hace falta para un producto.',
    { t: 'table', head: ['', 'Tsinghua', 'Priv8'], rows: [['Tokens en pantalla', 'Sí', 'Sí'], ['Procedencia', 'No', 'Sí'], ['Oráculo con presupuesto', 'No', 'Sí'], ['Confirmación y registro firmado', 'No', 'Sí'], ['Producto', 'Investigación', 'B2B y app']] }],
  ['¿Qué haríais con un piloto?', 'Un proceso de cuentas a pagar sobre el ERP del cliente, midiendo datos expuestos, fraudes bloqueados y horas ahorradas.',
    { t: 'nums', items: [['4 semanas', 'un proceso real'], ['0', 'datos expuestos, el objetivo'], ['Medido', 'fraudes bloqueados y horas']] }],
];
const QA3 = [
  ['¿Cómo lo vendéis?', 'Venta directa a bancos, brókers y departamentos financieros, con un piloto de 4 semanas. Después, integradores de ERP y empresas de BPO. La app del móvil, directa a las personas.',
    { t: 'flow', steps: [['Piloto', '4 semanas'], ['Venta directa', 'bancos y finanzas'], ['Canal', 'integradores y BPO'], ['App', 'directa a personas']] }],
  ['¿Cuánto cuesta?', 'Unos 0,50 € por documento, con una cuota mínima por proceso. Hoy una factura cuesta de media 9,84 $ en cuentas a pagar (Ardent Partners, 2025). En el móvil, unos 6 € al año. Estimación propia.',
    { t: 'vs', a: ['9,84 $', 'por factura hoy, a mano'], b: ['0,50 €', 'por documento con Priv8'], foot: 'Móvil: unos 6 € al año' }],
  ['¿Cuál es el modelo de negocio?', 'Suscripción en los dos: licencia por proceso para empresas y app de pago para personas. Cada proceso o banco nuevo cuesta reglas de sitio, no un producto nuevo.',
    { t: 'table', head: ['', 'Empresas', 'Personas'], rows: [['Producto', 'Priv8 para empresas', '8 en tu móvil'], ['Cobro', 'Licencia + documento', 'Suscripción'], ['Núcleo', 'Priv8 CUA', 'Priv8 CUA']] }],
  ['¿Sale a cuenta?', 'El núcleo corre en la máquina del cliente: no tenemos coste de cómputo por tarea. El modelo lo elige y lo paga el cliente; cobramos por el proceso que ya no se hace a mano.',
    { t: 'nums', items: [['0 €', 'de cómputo nuestro por tarea'], ['Cliente', 'elige y paga el modelo']] }],
  ['¿Quién decide la compra?', 'Dirección financiera y de operaciones, con el visto bueno de protección de datos y seguridad. El registro firmado es lo que les deja decir que sí.',
    { t: 'flow', steps: [['Finanzas y operaciones', 'quieren automatizar'], ['Protección de datos', 'revisa'], ['Seguridad', 'revisa'], ['Registro firmado', 'evidencia para el sí']] }],
  ['¿Qué pasa tras el piloto?', 'Medimos datos expuestos, fraudes bloqueados y horas ahorradas. Con eso se amplía a otros procesos del mismo cliente.',
    { t: 'nums', items: [['0', 'datos expuestos'], ['Fraudes', 'bloqueados'], ['Horas', 'ahorradas']], face: ['listo', 'paper'] }],
];
const QA4 = [
  ['¿Cumple el RGPD?', 'Es seudonimización (art. 4.5): el token sigue siendo dato personal, pero la tabla token-valor no sale de tu máquina. El RGPD sigue aplicando; el registro sirve de evidencia. No certificamos nada.',
    { t: 'split', rows: [['ES71 9400 0007 0206 0223 3441', '‹IBAN_1-propio›'], ['12345678Z', '‹DNI_1›'], ['1.180,00 €', '‹IMPORTE_3-positivo›']] }],
  ['¿Y PSD2 o PSD3?', 'La autenticación reforzada la hace siempre la persona. 8 no recibe la clave, la huella ni el OTP, y mira a otro lado mientras se ponen.',
    { t: 'eight', mode: 'nuncasale', on: 'bad', cap: 'Nunca sale: clave, huella y OTP' }],
  ['¿Y la ley europea de IA?', 'Un asistente que ejecuta lo que pide el usuario no es, en principio, de alto riesgo. Aplicamos transparencia: 8 dice siempre que es una IA.',
    { t: 'eight', mode: 'hablar', on: 'paper', cap: '8 dice siempre que es una IA' }],
  ['¿Y el secreto bancario?', 'El dato del cliente no llega al proveedor del modelo: solo tokens. Por eso un banco puede usar un modelo externo en procesos que hoy no puede.',
    { t: 'split', rows: [['ES71 9400 0007 0206 0223 3441', '‹IBAN_1-propio›'], ['3.412,58 €', '‹SALDO_1›']], left: 'Pantalla del banco', right: 'Modelo externo' }],
  ['¿Qué límites tiene la seguridad?', 'En modo estricto solo llega al modelo lo que marca una regla del sitio. La excepción es el cuerpo del correo: se tokeniza por patrones, bóveda y nombres, y un bloqueo final retiene lo que se escape.',
    { t: 'table', head: ['Fuente', 'Cómo se protege'], rows: [['Campos de pantalla', 'Regla del sitio (estricto)'], ['Cuerpo del correo', 'Patrones, bóveda y nombres'], ['Lo que se escape', 'Bloqueo final']] }],
  ['¿Cuánto cuesta integrarlo?', 'Unas reglas por pantalla (selectores) y el adaptador web o móvil que ya existe. Sin tocar el ERP ni pedir una API.',
    { t: 'flow', steps: [['Reglas por pantalla', 'selectores'], ['Adaptador', 'web o móvil, ya existe'], ['ERP intacto', 'sin API']] }],
];
const QA5 = [
  ['¿Por qué ahora?', 'Los modelos ya usan pantallas y los bancos ya prueban agentes. Lo que frena es qué ven.',
    { t: 'table', head: ['Quién', 'Qué resuelve'], rows: [['Visa TAP, Google AP2', 'Cómo paga un agente'], ['Skyflow, Basis Theory', 'Bóveda o tarjeta, sin pantallas'], ['Priv8', 'Qué ve mientras trabaja']], hi: 2 }],
  ['¿Qué riesgos veis?', 'Cada riesgo tiene su respuesta en el diseño o en la venta.',
    { t: 'table', head: ['Riesgo', 'Respuesta'], rows: [['Dato en texto libre', 'Modo estricto y bloqueo final'], ['El modelo falla una tarea', 'Tu «sí» antes de ejecutar'], ['Venta larga en banca', 'Piloto de 4 semanas']] }],
  ['¿Y si un gran proveedor lo hace?', 'Un proveedor de modelos no puede ser a la vez quien no ve los datos. Somos neutrales: funcionamos con cualquier modelo.',
    { t: 'eight', mode: 'curiosidad', on: 'paper', cap: 'Neutral: cualquier modelo' }],
  ['¿Hoja de ruta?', 'Primer piloto, más pantallas con reglas listas, la app en las tiendas y certificaciones.',
    { t: 'flow', steps: [['Piloto', 'cuentas a pagar'], ['Reglas listas', 'ERP habituales'], ['App de 8', 'en las tiendas'], ['Certificaciones', 'ISO 27001, SOC 2']] }],
  ['¿Puede el equipo sacarlo?', 'Cuatro personas han construido en tres días el núcleo, la consola, el ERP simulado, tres bancos y la app Android, todo funcionando.',
    { t: 'nums', items: [['4', 'personas'], ['3', 'días'], ['3', 'bancos simulados']], face: ['alegria', 'paper'] }],
  ['¿Lo podéis enseñar en directo?', 'Sí. Priv8 para empresas, entero: doble clic en Demo Priv8.command, «Preparar B2B», y 8 registra la factura en Alba Core y contesta al proveedor en vivo con Claude, mientras la consola enseña lo que ves tú y lo que ve el modelo. Priv8 en el móvil: «¿Cuánto tengo entre mis bancos?» en vivo en el emulador, con la cifra en la voz local. El resto de casos, grabados en demo.priv8.es.',
    { t: 'flow', steps: [['Doble clic', 'Demo Priv8.command'], ['Preparar B2B', 'Alba Core, correo y consola'], ['En vivo', 'factura y respuesta'], ['Móvil', '¿Cuánto tengo?']], qr: ['demo', 'demo.priv8.es'], face: ['alegria', 'paper'] }],
  ['¿Funciona hoy?', 'Sí. Las grabaciones reales están publicadas y el servidor MCP lo conecta a tu asistente, con tu modelo y tu clave.',
    { t: 'qr', items: [['demo', 'demo.priv8.es', 'Grabaciones reales'], ['mcp', 'mcp.priv8.es', 'Servidor MCP'], ['repo', 'github.com/aaangelmartin/Priv8', 'El código']], face: ['listo', 'paper'] }],
];
const GROUPS = [
  ['Negocio', QA3],
  ['Cumplimiento y límites', QA4],
  ['Seguridad y técnica', QA1],
  ['Producto y regulación', QA2],
  ['Mercado, riesgos y equipo', QA5],
];
const QS = GROUPS.flatMap(([g, qa], gi) => qa.map(([q, a, v]) => ({ g, gi, q, a, v })));
/* el anexo va justo después de las diapositivas principales: índice y luego una pregunta por diapositiva */
const ANNEX_AT = () => SLIDES.findIndex((x) => x.annex) + 1;
const qHref = (i) => `#${ANNEX_AT() + 1 + i}`;
const two = (n) => String(n).padStart(2, '0');
function Indice() {
  let k = -1;
  return (
    <div className="in qx-index">
      <Head eyebrow={`Anexo - ${QS.length} preguntas del jurado`}><span className="nw">Preguntas</span> <span className="soft nw">y respuestas.</span></Head>
      <div className="qi-grid">
        {GROUPS.map(([g, qa], j) => (
          <R d={3 + j * 0.4} key={g} className="qi-group">
            <p className="qi-gk">{two(j + 1)}</p>
            <h3>{g}</h3>
            <ol>{qa.map(([q]) => { k += 1; return <li key={q}><a href={qHref(k)}><span>{two(k + 1)}</span>{q}</a></li>; })}</ol>
          </R>
        ))}
      </div>
      <E mode="duda" on="paper" className="e-qi rv" />
      <Foot />
    </div>
  );
}
/* texto con tokens ‹…›: los pinta como chip */
const TokText = ({ s }) => (/^‹.*›$/.test(s) ? <Tok>{s}</Tok> : s);
function QrCard({ k, url, t }) {
  return (
    <a className="qv-qr" href={'https://' + url} target="_blank" rel="noreferrer">
      <Qr rows={QR[k]} label={'Código QR a ' + url} />
      <b>{url}</b>{t && <span>{t}</span>}
    </a>
  );
}
function Visual({ v }) {
  if (!v) return null;
  if (v.t === 'nums') {
    return (
      <div className={'qv qv-nums n' + v.items.length}>
        {v.items.map(([n, t], j) => <R d={4 + j * 0.3} key={n + t} className="qv-num"><b>{n}</b><span>{t}</span></R>)}
      </div>
    );
  }
  if (v.t === 'vs') {
    return (
      <div className="qv qv-vs">
        <R d={4} className="qv-num was"><span className="qv-tag">Hoy</span><b>{v.a[0]}</b><span>{v.a[1]}</span></R>
        <i className="qv-arrow" />
        <R d={5} className="qv-num now"><span className="qv-tag">Con Priv8</span><b>{v.b[0]}</b><span>{v.b[1]}</span></R>
        {v.foot && <p className="qv-foot">{v.foot}</p>}
      </div>
    );
  }
  if (v.t === 'flow') {
    return (
      <div className={'qv qv-flowwrap' + (v.qr ? ' has-qr' : '')}>
        <ol className="qv-flow">
          {v.steps.map(([h, t], j) => (
            <R d={4 + j * 0.3} as="li" key={h} className={j === v.bad ? 'bad' : j === v.steps.length - 1 && v.bad == null ? 'end' : ''}>
              <span className="qv-n">{j + 1}</span><b><TokText s={h} /></b><span>{t}</span>
            </R>
          ))}
        </ol>
        {v.qr && <QrCard k={v.qr[0]} url={v.qr[1]} />}
      </div>
    );
  }
  if (v.t === 'table') {
    return (
      <div className="qv qv-table">
        <table>
          <thead><tr>{v.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
          <tbody>{v.rows.map((r, ri) => <tr key={r[0]} className={ri === v.hi ? 'hi' : ''}>{r.map((c, j) => <td key={j}>{c === 'Sí' ? <span className="qv-yes">Sí</span> : c === 'No' ? <span className="qv-no">No</span> : <TokText s={c} />}</td>)}</tr>)}</tbody>
        </table>
        {v.foot && <p className="qv-foot">{v.foot}</p>}
      </div>
    );
  }
  if (v.t === 'toks') {
    return (
      <div className="qv qv-toks">
        <div className="qv-tokrow">{v.items.map((x, j) => <R d={4 + j * 0.3} as="span" key={x} className="tok">{x}</R>)}</div>
        {v.no && <div className="qv-norow">{v.no.map((x) => <span key={x}>{x}</span>)}</div>}
        {v.cap && <p className="qv-foot">{v.cap}</p>}
      </div>
    );
  }
  if (v.t === 'split') {
    return (
      <div className="qv qv-split">
        <div className="qv-sh"><span>{v.left || 'Tu máquina'}</span><span>{v.right || 'Lo que ve el modelo'}</span></div>
        {v.rows.map(([a, b], j) => (
          <R d={4 + j * 0.35} key={b} className="qv-srow"><span className="qv-real">{a}</span><i className="qv-arrow" /><Tok>{b}</Tok></R>
        ))}
        <p className="qv-foot">La tabla token - valor no sale de tu máquina</p>
      </div>
    );
  }
  if (v.t === 'eight') {
    return (
      <div className={'qv qv-eight on-' + v.on}>
        <E mode={v.mode} on={v.on} className="e-qv" />
        {v.cap && <p className="qv-cap">{v.cap}</p>}
      </div>
    );
  }
  if (v.t === 'qr') {
    return <div className="qv qv-qrs">{v.items.map(([k, url, t]) => <QrCard key={k} k={k} url={url} t={t} />)}</div>;
  }
  return null;
}
function Pregunta({ i }) {
  const { g, gi, q, a, v } = QS[i];
  const face = v.face || ['duda', 'paper'];
  return (
    <div className="in qx">
      <Head eyebrow={`${two(gi + 1)} ${g} - Pregunta ${i + 1} de ${QS.length}`}>{q}</Head>
      <div className={'qx-body t-' + v.t}>
        <div className="qx-side">
          <R d={3} as="p" className="qx-ans">{a}</R>
          <R d={5} as="a" className="qback" href={`#${ANNEX_AT()}`}>Volver al índice</R>
        </div>
        <R d={3.5} className="qx-stage"><Visual v={v} /></R>
      </div>
      {v.t !== 'eight' && <E mode={face[0]} on={face[1]} className="e-qx rv" />}
      <Foot />
    </div>
  );
}
const PREGUNTAS = QS.map((_, i) => ({ id: `pregunta-${i + 1}`, tone: 'paper', C: () => <Pregunta i={i} />, annex: true }));

export const SLIDES = [
  { id: 'portada', tone: 'band', C: Portada, field: true },
  { id: 'empresas', tone: 'paper', C: ProblemaB2B },
  { id: 'personas', tone: 'paper', C: ProblemaB2C },
  { id: 'podria', tone: 'paper', C: Podria },
  { id: 'captura', tone: 'band', C: Captura },
  { id: 'como-2', tone: 'band', C: Como2 },
  { id: 'como', tone: 'band', C: Como1 },
  { id: 'como-3', tone: 'band', C: Como3 },
  { id: 'como-4', tone: 'band', C: Como4 },
  { id: 'arquitectura', tone: 'band', C: Arquitectura },
  { id: 'piezas', tone: 'band', C: Piezas },
  { id: 'verticales', tone: 'paper', C: Verticales },
  { id: 'demo-empresas', tone: 'paper', C: Demo2 },
  { id: 'demo-movil', tone: 'paper', C: Demo1 },
  { id: 'foco', tone: 'band', C: Foco },
  { id: 'mercado', tone: 'paper', C: Mercados },
  { id: 'competencia', tone: 'paper', C: Competencia },
  { id: 'llegar', tone: 'band', C: Mercado },
  { id: 'equipo', tone: 'paper', C: Equipo },
  { id: 'cierre', tone: 'band', C: Cierre, field: true },
  { id: 'anexo', tone: 'paper', C: Indice, annex: true },
  ...PREGUNTAS,
];
