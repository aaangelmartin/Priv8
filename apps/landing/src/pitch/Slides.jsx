import { createContext, useContext, useEffect, useState } from 'react';
import Eight from '../eight/Eight.jsx';
import Field from '../Field.jsx';
import correo from './img/correo.jpg';
import consola from './img/consola.jpg';
import alarma from './img/alarma.jpg';
import qr from './img/qr.svg';
import pablo from './img/pablo.png';
import angel from './img/angel.png';
import alvaro from './img/alvaro.png';
import marco from './img/marco.png';

/* Las diapositivas del pitch, en el orden acordado por el equipo (12 y 2 de anexo). */
export const SlideCtx = createContext({ live: false, active: false, printing: false, n: '', annex: false });

const COL = { band: { fg: '#FFFFFF', cut: '#2D45D6' }, paper: { fg: '#2D45D6', cut: '#FFFFFF' } };

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

function Foot() {
  const { n, annex } = useContext(SlideCtx);
  return (
    <footer className="sfoot" aria-hidden="true">
      <span className="brand">Priv8</span>
      <span>{annex ? `${n} | Preguntas del jurado` : n}</span>
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
  const { active } = useContext(SlideCtx);
  return (
    <div className={'in portada' + (active ? ' live' : '')}>
      {active && <Field />}
      {active && <div className="clean" />}
      <div className="top"><span className="brand">Priv8</span><span>priv8.es</span></div>
      <div className="center">
        <E id={active ? 'hero-anchor' : undefined} className="e-hero rv" />
        <R d={1} as="h1"><span className="line">8 hace el trámite.</span><span className="line soft">Sin ver tus datos.</span></R>
        <R d={3} as="p" className="who">Ángel Martín, Álvaro Carpintero, Marco Barroso y Pablo Rojo</R>
        <R d={4} as="p" className="event">Hackfinance | Madrid Engineering Week | 12 nov 2026</R>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 2 problema B2B */
const LUMEN = [
  ['Proveedor', 'Suministros Lumen S.L.'],
  ['CIF', 'B12345674'],
  ['Factura', 'F-2026-0412'],
  ['Importe', '1.254,30 €'],
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
        <Head eyebrow="Empresas y bancos">La IA podría hacerlo. <span className="soft">Pero vería los datos.</span></Head>
        <R d={3} className="screen">
          <div className="screen-bar"><i /><i /><i /><b>Alba Core</b><span>lo que recibiría la IA</span></div>
          {LUMEN.map(([k, v], i) => (
            <div className="srow" key={k} style={{ '--i': i }}><span className="k">{k}</span><span className="real">{v}</span></div>
          ))}
          <div className="leak"><b>5</b><span>datos reales al modelo</span><E mode="miedo" on="paper" className="e-leak" /></div>
        </R>
      </div>
      <div className="col stats">
        <Stat d={4} n="67 %" t="de los grandes bancos, frenados por la privacidad" s="EY-Parthenon, 2025" />
        <Stat d={5} n="52 %" t="de los directivos pone la seguridad y la privacidad como primer freno de los agentes" s="Dynatrace, 2025" />
        <Stat d={6} n="97 %" t="de los datos sensibles de la pantalla llega al modelo sin protección" s="Tsinghua, 2026" />
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
    <div className="in split">
      <div className="col">
        <Head eyebrow="Personas">Tres bancos, tres apps. <span className="soft">Ninguna ayuda.</span></Head>
        <div className="phones3">
          {BANKS.map(([b, a, c], i) => (
            <R d={3 + i} key={b} className="mini" style={{ '--d': 3 + i, '--bk': c }}>
              <div className="mini-top"><b>{b}</b></div>
              <div className="mini-body"><i /><i /><i className="short" /></div>
              <span className="auth">{a}</span>
            </R>
          ))}
          <E mode="duda" on="paper" className="e-b2c rv" />
        </div>
        <R d={6} as="p" className="note">3 apps, 3 claves, ninguna suma por ti.</R>
      </div>
      <div className="col stats">
        <Stat d={4} n="57 %" t="con cuentas en varias entidades" s="Visa y Ditrendia, 2025" />
        <Stat d={5} n="1,81" t="bancos por persona" s="Inmark, 2024" />
        <Stat d={6} n="+600.000" t="firmas en «Soy mayor, no idiota»" s="2022" />
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 4 cómo funciona */
const HOW = [
  ['Saldo', '12.050,00 €', '‹IMPORTE_2›'],
  ['IBAN', 'ES91 9400 0007 0206 0223 3441', '‹IBAN_1-propio›'],
  ['Clave', '••••••', null],
];
function Como() {
  return (
    <div className="in how">
      <Head eyebrow="Cómo funciona">El modelo ve tokens. <span className="soft">Tu máquina pone los datos.</span></Head>
      <div className="flow">
        <R d={3} className="card">
          <p className="step"><b>1</b>Tu pantalla</p>
          {HOW.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><em className="real">{v}</em></div>)}
          <p className="cap">El dato real, en tu máquina</p>
        </R>
        <R d={4} className="arrow" />
        <R d={5} className="card ai">
          <p className="step"><b>2</b>Lo que ve la IA <E mode="leer" on="paper" className="e-card" /></p>
          {HOW.map(([k, , t], i) => <div className="kv" key={k}><span>{k}</span>{t ? <span className="tok morph" style={{ '--i': i }}>{t}</span> : <span className="never morph" style={{ '--i': i }}>nunca sale</span>}</div>)}
          <p className="cap">Solo tokens y la interfaz</p>
        </R>
        <R d={6} className="arrow" />
        <R d={7} className="card">
          <p className="step"><b>3</b>Tu máquina actúa</p>
          <div className="kv"><span>escribe</span><em className="real">ES91 9400 …</em></div>
          <div className="kv"><span>pagar</span><span className="wait">espera tu «sí»</span></div>
          <p className="cap">El ejecutor pone el valor real</p>
        </R>
      </div>
      <R d={8} as="p" className="foot-note">Modo estricto, el de serie: al modelo solo llega lo que marca una regla del sitio. Tres herramientas cerradas: <code>observe</code>, <code>act</code> y <code>oracle</code>.</R>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 5 arquitectura */
const PIECES = ['Detector', 'Tokens y bóveda', 'Procedencia', 'Oráculo', 'Ejecutor', 'Tu «sí»', 'Bloqueo final', 'Registro firmado'];
function Arquitectura() {
  return (
    <div className="in arch">
      <Head eyebrow="Arquitectura">Ocho piezas. <span className="soft">Ninguna depende de que el modelo obedezca.</span></Head>
      <div className="arch-row">
        <R d={3} className="trust">
          <p className="zone">Tu entorno de confianza</p>
          <div className="ends"><span>Web: ERP y correo</span><span>Móvil con accesibilidad</span></div>
          <div className="core">
            <p className="core-h"><E mode="mirar" on="band" className="e-core" />Núcleo Priv8</p>
            <div className="pieces">
              {PIECES.map((p, i) => <span key={p} className="piece rv" style={{ '--d': 4 + i * 0.5 }}><b>{i + 1}</b>{p}</span>)}
            </div>
          </div>
          <div className="ends"><span>Consola de auditoría</span><span>App 8 con voz local</span></div>
        </R>
        <div className="wire">
          <R d={8} className="w-out"><span>solo tokens</span><i /></R>
          <R d={9} className="w-in"><i /><span><code>observe</code> <code>act</code> <code>oracle</code></span></R>
        </div>
        <R d={7} className="cloud">
          <p className="zone">Nube</p>
          <div className="cbox"><b>Cualquier modelo</b><span>3 herramientas cerradas. Sin navegador, sin sistema, sin código propio.</span></div>
          <div className="cbox"><b>Voz en la nube</b><span>Solo frases sin datos. Cifras y nombres, con la voz local.</span></div>
        </R>
      </div>
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
  return (
    <div className="in demo">
      <Head eyebrow="Demo 1 | 8 en tu móvil" chip="en directo, 1:10">«¿Cuánto tengo entre mis bancos?»</Head>
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
            <p className="it">Entre tus tres cuentas tienes <mark>17.977,98 €</mark>.</p>
            <p className="sys">voz local | el modelo solo ve <Tok>‹SUMA_1›</Tok></p>
          </Phone>
          <R d={6} as="p" className="pcap"><b>2</b>La cifra solo suena en tu móvil</R>
        </div>
        <div className="pcol">
          <Phone d={7} state="Mira a otro lado" mode="apartar">
            <p className="me">Pasa 200 € al bróker</p>
            <div className="confirm"><b>200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?</b><span className="row2"><i className="yes">Confirmar</i><i>Cancelar</i></span></div>
            <p className="sys">Huella, clave u OTP: 8 no mira</p>
          </Phone>
          <R d={8} as="p" className="pcap"><b>3</b>«Pasa 200 € al bróker». Tu huella, 8 no la ve</R>
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
  return (
    <div className="in demo2">
      <Head eyebrow="Demo 2 | Priv8 para empresas y bancos" chip="en directo, 1:15">Una factura llega por correo. <span className="soft">8 la registra sin ver los datos.</span></Head>
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

/* ---------------------------------------------------------------- 8 mercados */
function Mercados() {
  return (
    <div className="in markets">
      <Head eyebrow="Mercado">Dos verticales, <span className="soft">un mismo núcleo.</span></Head>
      <div className="mk">
        <R d={3} className="mcol">
          <p className="tag">B2B | empresas y bancos</p>
          <div className="big"><small>mercado total</small><b>6.900 M$</b><span>automatizar cuentas a pagar</span></div>
          <div className="big obj"><small>nuestro objetivo</small><b>34.711</b><span>empresas en España con más de 50 empleados</span></div>
        </R>
        <R d={5} className="hub"><E mode="mirar" on="band" className="e-hub" /><span>Priv8 CUA</span></R>
        <R d={4} className="mcol">
          <p className="tag">B2C | personas</p>
          <div className="big"><small>mercado total</small><b>27 M</b><span>personas con banca online en España</span></div>
          <div className="big obj"><small>nuestro objetivo</small><b>15 M</b><span>con cuentas en varios bancos</span></div>
        </R>
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
      <Head eyebrow="Competencia">Otros enmascaran o enseñan. <span className="soft">8 hace el trámite sin ver.</span></Head>
      <div className="tbls">
        <Table d={3} t={B2B_T} title="B2B" />
        <Table d={4} t={B2C_T} title="B2C" />
      </div>
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 10 go to market */
const GTM = [['Piloto', '4 semanas', 'Un proceso de cuentas a pagar sobre su ERP'], ['Su back office', 'licencia por proceso', 'Facturas, conciliación, altas'], ['Sus clientes', 'por usuario activo', '8 en su app, con su marca'], ['Más empresas', 'integradores de ERP', 'El mismo núcleo, otros sectores']];
function Mercado() {
  return (
    <div className="in gtm">
      <Head eyebrow="Cómo llegamos">Un banco, <span className="soft">los dos lados.</span></Head>
      <div className="steps">
        {GTM.map(([h, s, t], i) => (
          <R d={3 + i} key={h} className="gstep">
            <b className="gn">{i + 1}</b>
            <h3>{h}</h3>
            <span className="gs">{s}</span>
            <p>{t}</p>
          </R>
        ))}
        <R d={2} className="rail" />
      </div>
      <E mode="alegria" on="band" className="e-gtm rv" />
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 11 equipo */
const TEAM = [
  ['Pablo Rojo', 'rrojjo', 'Núcleo del protocolo', pablo],
  ['Ángel Martín', 'aaangelmartin', 'Agente, Android, voz y diseño', angel],
  ['Álvaro Carpintero', 'alvaarocl', 'Empresa: ERP, correo y consola', alvaro],
  ['Marco Barroso', 'marcoobarroso', 'App 8 y bancos simulados', marco],
];
function Equipo() {
  return (
    <div className="in team">
      <Head eyebrow="Equipo">Cuatro personas, <span className="soft">un protocolo que ya funciona.</span></Head>
      <div className="people">
        {TEAM.map(([n, gh, r, img], i) => (
          <R d={3 + i} key={n} className="person">
            <img src={img} alt="" />
            <h3>{n}</h3>
            <p>{r}</p>
            <code>@{gh}</code>
          </R>
        ))}
      </div>
      <E mode="agradecer" on="paper" className="e-team rv" />
      <Foot />
    </div>
  );
}

/* ---------------------------------------------------------------- 12 cierre */
function Cierre() {
  const { active } = useContext(SlideCtx);
  return (
    <div className={'in cierre' + (active ? ' live' : '')}>
      {active && <Field />}
      {active && <div className="clean" />}
      <div className="center">
        <E id={active ? 'hero-anchor' : undefined} className="e-hero rv" seq={[['alegria', 2200], ['mirar', 0]]} />
        <R d={1} as="h2"><span className="line">El agente hace el trámite.</span><span className="line soft">Los datos se quedan contigo.</span></R>
        <R d={3} className="qr">
          <img src={qr} alt="Código QR a priv8.es" />
          <div><small>Web y demo</small><b>priv8.es</b></div>
        </R>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- anexo */
const QA1 = [
  ['¿Y si el modelo adivina la cifra a base de preguntas?', 'El oráculo tiene un presupuesto de preguntas por sesión y responde por tramos, nunca con la cifra.'],
  ['¿Qué pasa con un dato en texto libre?', 'En modo estricto, el de serie, al modelo solo llega lo que cubre una regla del sitio. Además, patrones validados (IBAN mod-97, DNI, Luhn) y la bóveda local. Si algo se escapa, el bloqueo final retiene la petición.'],
  ['¿Un token sigue siendo un dato personal?', 'Es seudonimización: la tabla token-valor no sale de la máquina. El RGPD sigue aplicando y el registro sirve de evidencia; no decimos que certifique nada.'],
  ['¿Por qué no usar la API del ERP?', 'Porque muchos no la tienen, o integrarla cuesta meses. Priv8 trabaja sobre las pantallas que ya existen.'],
  ['¿Y la inyección de instrucciones en un correo?', 'No dependemos de que el modelo la ignore: la procedencia impide por diseño que un dato del correo entre en un campo de pago, y la consola avisa de posible fraude.'],
  ['¿Cuánto añade de latencia y de coste?', 'El núcleo corre en local, en el mismo proceso; la consola mide la latencia de cada paso. El coste es el del modelo que elija el cliente, sin llamadas extra.'],
];
const QA2 = [
  ['¿Funciona con cualquier modelo?', 'Sí. El modelo solo recibe tokens y tiene tres herramientas cerradas: observe, act y oracle. Ni navegador, ni sistema, ni código propio.'],
  ['¿Y la autenticación del banco (PSD2)?', 'La hace siempre la persona. Mientras pone huella, clave u OTP, 8 no recibe nada y mira a otro lado.'],
  ['¿El agente da consejos de inversión?', 'No. El asesoramiento está regulado: 8 ejecuta lo que la persona elige y dice «no puedo» si le piden consejo.'],
  ['¿Cuánto cobraréis?', 'Licencia anual por proceso más un precio por documento. La cifra saldrá del coste por tarea que ya medimos y del ahorro frente a hacerlo a mano.'],
  ['¿Qué os diferencia de Tsinghua?', 'Su trabajo valida la idea en un emulador. Nosotros añadimos procedencia, oráculo con presupuesto, confirmación y registro firmado, y lo llevamos a un producto.'],
  ['¿Qué haríais con un piloto?', 'Un proceso de cuentas a pagar en 4 semanas, sobre el ERP del cliente, midiendo datos expuestos, fraudes bloqueados y horas ahorradas.'],
];
function Anexo({ qa, part }) {
  return (
    <div className="in qa">
      <Head eyebrow={`Anexo ${part} de 2 | Preguntas del jurado`}>Lo que nos pueden <span className="soft">preguntar.</span></Head>
      <div className="qgrid">
        {qa.map(([q, a], i) => <R d={3 + i * 0.6} key={q} className="qcard"><h3>{q}</h3><p>{a}</p></R>)}
      </div>
      <E mode="duda" on="paper" className="e-qa rv" />
      <Foot />
    </div>
  );
}
const Anexo1 = () => <Anexo qa={QA1} part={1} />;
const Anexo2 = () => <Anexo qa={QA2} part={2} />;

export const SLIDES = [
  { id: 'portada', tone: 'band', C: Portada },
  { id: 'empresas', tone: 'paper', C: ProblemaB2B },
  { id: 'personas', tone: 'paper', C: ProblemaB2C },
  { id: 'como', tone: 'band', C: Como },
  { id: 'arquitectura', tone: 'paper', C: Arquitectura },
  { id: 'demo-movil', tone: 'band', C: Demo1 },
  { id: 'demo-empresas', tone: 'paper', C: Demo2 },
  { id: 'mercado', tone: 'paper', C: Mercados },
  { id: 'competencia', tone: 'paper', C: Competencia },
  { id: 'llegar', tone: 'band', C: Mercado },
  { id: 'equipo', tone: 'paper', C: Equipo },
  { id: 'cierre', tone: 'band', C: Cierre },
  { id: 'anexo-1', tone: 'paper', C: Anexo1, annex: true },
  { id: 'anexo-2', tone: 'paper', C: Anexo2, annex: true },
];
