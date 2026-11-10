import { useEffect, useState } from 'react';
import Eight from './eight/Eight.jsx';
import { useTheme, PALETTE } from './useTheme.js';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* ---------------------------------------------------------------- portada */
function Hero({ pal }) {
  const [mode, setMode] = useState('saludar');
  useEffect(() => {
    const t = setTimeout(() => setMode('mirar'), 2400);
    return () => clearTimeout(t);
  }, []);
  const tickle = () => {
    if (mode !== 'mirar') return;
    setMode('risa');
    setTimeout(() => setMode('mirar'), 1600);
  };
  return (
    <header className="hero">
      <div className="wrap">
        <div>
          <p className="eyebrow" style={{ color: 'var(--band-ink-2)' }}>Priv8 CUA · privacidad para agentes que usan pantallas</p>
          <h1 style={{ marginTop: 18 }}>El agente hace el trámite. Nunca ve tus datos.</h1>
          <p className="lead">
            Priv8 cambia cada dato sensible de la pantalla por un token antes de que llegue al modelo, y solo lo devuelve a su valor real en tu
            máquina, al ejecutar. Para empresas que quieren automatizar sin exponer datos, y para 8, el agente que maneja tu móvil.
          </p>
          <div className="cta">
            <a className="btn solid" href="#demo">Ver cómo funciona</a>
            <a className="btn ghost" href="#producto">Conoce a 8</a>
          </div>
          <p className="quote">Visa y Google resolvieron cómo paga un agente. <b>Priv8 resuelve qué ve mientras trabaja.</b></p>
        </div>
        <div className="hero-col-eight">
          <Eight className="hero-eight" mode={mode} fg="#FFFFFF" cut={pal.band} onClick={tickle} label="8, el agente de Priv8. Haz clic: tiene cosquillas." />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------- lo que ves / lo que ve la IA */
const ROWS = [
  { k: 'Titular', real: 'Lucía Ferrer', ia: <Tok>‹NOMBRE_1·propio›</Tok>, face: 'nove', tone: 'warn' },
  { k: 'Cuenta nómina', real: 'ES43 9100 0001 5740 1234 5678', mono: true, ia: <Tok>‹IBAN_1·propio›</Tok>, face: 'nove', tone: 'warn' },
  { k: 'Saldo', real: '3.412,58 €', ia: <Tok>‹IMPORTE_1·positivo›</Tok>, face: 'nove', tone: 'warn' },
  { k: 'Clave', real: '••••••••••', mono: true, ia: <span className="never">Nunca sale</span>, face: 'nuncasale', tone: 'bad' },
  { k: 'Botón', real: 'Hacer una transferencia', ia: 'Hacer una transferencia', face: 've', tone: 'ok' },
];

function Demo({ pal }) {
  const [on, setOn] = useState(-1);
  return (
    <section className="sec" id="demo" aria-labelledby="h-demo">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="h-demo">La misma pantalla, vista por ti y por la IA</h2>
          <p className="lead">El agente necesita entender la pantalla para trabajar, no conocer los datos. Pasa el cursor por cada fila.</p>
        </div>
        <div className="split">
          <div className="screen" aria-label="Lo que ves">
            <div className="bar"><b>Banca Alcor</b><span className="who">Lo que ves</span></div>
            <div className="rows">
              {ROWS.map((r, i) => (
                <div key={r.k} className={'row' + (on === i ? ' on' : '')} onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(-1)}>
                  <span className="k">{r.k}</span>
                  <span className={'v' + (r.mono ? ' mono' : '')}>{r.real}</span>
                  <span />
                </div>
              ))}
            </div>
          </div>
          <div className="screen" aria-label="Lo que ve la IA">
            <div className="bar"><b>Banca Alcor</b><span className="who">Lo que ve la IA</span></div>
            <div className="rows">
              {ROWS.map((r, i) => (
                <div key={r.k} className={'row' + (on === i ? ' on' : '')} onMouseEnter={() => setOn(i)} onMouseLeave={() => setOn(-1)}>
                  <span className="k">{r.k}</span>
                  <span className="v">{r.ia}</span>
                  <Eight className="face" mode={r.face} fg={pal[r.tone]} cut={on === i ? pal.bg2 : pal.bg} label={'8: ' + (r.face === 've' ? 've' : r.face === 'nove' ? 'tokenizado' : 'nunca sale')} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="legend">
          <span className="chip ok"><i />Verde: la interfaz, 8 la ve</span>
          <span className="chip warn"><i />Ámbar: se cambia por un token</span>
          <span className="chip bad"><i />Rojo: claves y códigos, nunca salen</span>
        </div>
        <p className="lead" style={{ marginTop: 24 }}>
          Si 8 necesita saber si el saldo cubre 200 €, pregunta a un oráculo local y recibe «sí». Nunca la cifra.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- problema */
function Problem() {
  return (
    <section className="sec alt" id="problema" aria-labelledby="h-prob">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">El problema</p>
          <h2 id="h-prob">Los agentes ya saben usar pantallas. Nadie quiere enseñarles los datos.</h2>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="n">52 %</span>
            <p>de los directivos de grandes empresas pone la seguridad, la privacidad o el cumplimiento como primer freno de los agentes de IA.</p>
            <span className="src"><a href="https://securitybrief.co.uk/story/security-fears-keep-half-of-agentic-ai-stuck-in-pilots" target="_blank" rel="noreferrer">Encuesta de Dynatrace, vía SecurityBrief</a></span>
          </div>
          <div className="stat">
            <span className="n">97 %</span>
            <p>de los datos sensibles de la pantalla llega al modelo cuando un agente trabaja sin protección.</p>
            <span className="src"><a href="https://arxiv.org/html/2602.10139v2" target="_blank" rel="noreferrer">Tsinghua, «Available but Invisible»</a></span>
          </div>
          <div className="stat">
            <span className="n">8 de 120</span>
            <p>IBAN se leyeron bien por OCR a través de un escritorio remoto. Por eso Priv8 lee la estructura de la pantalla, no los píxeles.</p>
            <span className="src">Medición propia del equipo</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- protocolo */
const PIECES = [
  ['Tokens', <>Cada dato se cambia por un token tipado y estable en la sesión: <Tok>‹IBAN_1·propio›</Tok>.</>],
  ['Clases de dato', 'Verde se ve, ámbar se tokeniza y rojo (claves, PIN, códigos) nunca sale.'],
  ['Procedencia', 'Lo que llega por correo o de un tercero no puede entrar en un campo de pago ni cambiar la operación.'],
  ['Oráculo', 'Suma, compara y comprueba sin revelar cifras, con un presupuesto de preguntas.'],
  ['Ejecutor', 'El modelo escribe tokens y el ejecutor pone el valor real en pantalla, en local.'],
  ['Confirmación humana', 'Transferir, firmar o enviar espera a que tú digas que sí.'],
  ['Auditoría firmada', 'Queda registrado qué recibió el modelo, qué se bloqueó y qué aprobaste.'],
];

function Protocol() {
  return (
    <section className="sec" id="protocolo" aria-labelledby="h-proto">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Priv8 CUA</p>
          <h2 id="h-proto">Un protocolo que cualquier agente puede adoptar</h2>
          <p className="lead">El agente solo tiene tres herramientas cerradas: observar, actuar y preguntar al oráculo. Todo lo demás pasa por estas piezas.</p>
        </div>
        <div className="flow">
          {PIECES.map(([t, d], i) => (
            <article className="piece" key={t}>
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
          <article className="piece block">
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
          <div className="gate">Bloqueo final</div>
          <div>
            <span className="zone">Nube</span>
            <h3>Solo tokens y frases sin datos</h3>
            <ul><li>Claude razona con tokens</li><li>ElevenLabs lee frases sin cifras ni nombres</li></ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- verticales */
function Empresas() {
  return (
    <div className="vert" role="tabpanel" id="p-empresas" aria-labelledby="t-empresas">
      <div className="copy">
        <h3 style={{ fontSize: 'var(--step-2)' }}>Automatiza lo que la protección de datos te frenaba</h3>
        <p className="lead">8 trabaja en tu ERP o tu CRM de siempre, aunque no tenga API, y el proveedor del modelo solo recibe tokens.</p>
        <ul className="points">
          <li>Funciona sobre las pantallas que ya tienes, sin integrar nada.</li>
          <li>Un correo no puede cambiar un pago: la procedencia lo impide por diseño.</li>
          <li>Verifica por teléfono con el número que ya tenías, diciendo que es una IA.</li>
          <li>Cada paso queda firmado, listo para tus auditorías.</li>
        </ul>
      </div>
      <ol className="steps" aria-label="Ejemplo: una factura de proveedor">
        <li><div><b>Llega la factura de Suministros Lumen por correo</b><span>8 la abre con la bandeja de siempre.</span></div></li>
        <li><div><b>La lee sin ver los datos</b><span>Al modelo le llegan <Tok>‹CIF_1›</Tok> e <Tok>‹IMPORTE_2›</Tok>.</span></div></li>
        <li><div><b>La registra en el ERP</b><span>El ejecutor escribe los valores reales en local.</span></div></li>
        <li className="trap"><div><b>El pie del correo pide pagar a un IBAN nuevo</b><span>Bloqueado: un dato que llega por correo no puede entrar en el campo de pago.</span></div></li>
        <li><div><b>Llama al proveedor al número de su ficha</b><span>Se presenta como IA y hace una pregunta de comprobación.</span></div></li>
        <li><div><b>Contesta el correo y firma el registro</b><span>Qué vio el modelo, qué se bloqueó y quién aprobó.</span></div></li>
      </ol>
    </div>
  );
}

const SCENES = [
  { id: 'cuanto', label: '¿Cuánto tengo?', mode: 'hablar', state: 'Habla' },
  { id: 'pasa', label: 'Pasa 200 € al bróker', mode: 'esperar', state: 'Espera tu confirmación' },
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
    <div className="vert" role="tabpanel" id="p-movil" aria-labelledby="t-movil">
      <div className="copy">
        <h3 style={{ fontSize: 'var(--step-2)' }}>8 maneja tu móvil por ti, sin ver tus cuentas</h3>
        <p className="lead">Le hablas y 8 abre tus apps de banca, lee, suma y prepara. Las cifras te las dice la voz del móvil; a la nube no llegan.</p>
        <div className="scenes" role="group" aria-label="Escenas">
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
          <div className="scr">
            <div className="top">
              <Eight className="eye" mode={mode} fg="#FFFFFF" cut={pal.band} />
              <small>{scene === 'pasa' && answer ? (answer === 'si' ? 'Hecho' : 'Cancelado') : sc.state}</small>
            </div>
            <div className="chat" aria-live="polite">
              {scene === 'cuanto' && (<>
                <p className="bubble me">¿Cuánto tengo entre mis bancos?</p>
                <p className="bubble eight">Entre tus cuentas tienes 15.462,58 €.
                  <span className="local">La cifra la dice la voz del móvil. Al modelo solo le llegó ‹SUMA_1›.</span></p>
              </>)}
              {scene === 'pasa' && (<>
                <p className="bubble me">Pasa 200 € al bróker.</p>
                <p className="bubble eight">Lo tengo preparado. Falta tu confirmación.</p>
                {answer === 'si' && <p className="bubble eight">Hecho. Te dejo el justificante.</p>}
                {answer === 'no' && <p className="bubble eight">Cancelado. No se ha movido nada.</p>}
              </>)}
              {scene === 'clave' && (<>
                <p className="bubble eight">Pon tu clave. No miro.</p>
                <p className="bubble me" style={{ fontFamily: 'var(--f-mono)' }}>••••••••</p>
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
                  <button type="button" onClick={() => setAnswer('no')}>Cancelar</button>
                  <button type="button" className="yes" onClick={() => setAnswer('si')}>Confirmar</button>
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
    <section className="sec alt" id="producto" aria-labelledby="h-prod">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Un núcleo, dos productos</p>
          <h2 id="h-prod">Para tu empresa y para tu móvil</h2>
        </div>
        <div className="vtabs" role="tablist" aria-label="Productos">
          <button type="button" role="tab" id="t-empresas" aria-controls="p-empresas" aria-selected={tab === 'empresas'} onClick={() => setTab('empresas')}>Priv8 para empresas</button>
          <button type="button" role="tab" id="t-movil" aria-controls="p-movil" aria-selected={tab === 'movil'} onClick={() => setTab('movil')}>8 en tu móvil</button>
        </div>
        {tab === 'empresas' ? <Empresas /> : <Movil pal={pal} />}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- para quién */
function Quien() {
  return (
    <section className="sec" id="quien" aria-labelledby="h-quien">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Para quién</p>
          <h2 id="h-quien">Quien usa el agente, quien lo ofrece y quien lo construye</h2>
        </div>
        <div className="who-grid">
          <article className="who-card"><span className="tag">Empresas</span><h3>Operaciones y finanzas</h3><p>Automatiza facturas, reclamaciones y altas en los programas de siempre sin enviar datos de clientes al modelo.</p></article>
          <article className="who-card"><span className="tag">Bancos y brókers</span><h3>Ofrece agentes a tus clientes</h3><p>Deja que 8 opere en tu app sin abrir tus sistemas ni exponer datos, con la confirmación siempre en manos del cliente.</p></article>
          <article className="who-card"><span className="tag">Personas</span><h3>8 en el bolsillo</h3><p>Pregunta cuánto tienes, prepara una transferencia o pide que llame al banco. Tus datos se quedan en tu móvil.</p></article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- confianza */
function Confianza() {
  return (
    <section className="sec alt" id="confianza" aria-labelledby="h-conf">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Confianza</p>
          <h2 id="h-conf">Pensado para lo que pide un responsable de datos</h2>
        </div>
        <div className="trust">
          <article><h3>El proveedor del modelo solo recibe tokens</h3>
            <p>El Tribunal de Justicia de la UE admitió en 2025 que unos datos seudonimizados pueden no ser datos personales para quien no puede reidentificarlos. Tu empresa sigue siendo responsable de sus datos. <a href="https://cm.twobirds.com/en/insights/2025/eu-the-srb-decision-a-new-era-for-personal-data-and-data-processing-agreements" target="_blank" rel="noreferrer">Sentencia C-413/23 P</a></p></article>
          <article><h3>Lo irreversible lo confirmas tú</h3><p>Transferir, firmar o enviar espera a tu aprobación, y la autenticación del banco la haces siempre tú.</p></article>
          <article><h3>Cada paso, firmado</h3><p>Un registro encadenado de qué vio el modelo, qué se bloqueó y quién aprobó, útil como evidencia en auditorías de seguridad.</p></article>
          <article><h3>8 dice que es una IA</h3><p>Cuando llama por ti a un proveedor o a tu banco, se presenta como asistente de IA desde el primer momento.</p></article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- cierre */
function Cierre({ pal }) {
  return (
    <section className="close" id="contacto" aria-labelledby="h-close">
      <div className="wrap">
        <div>
          <h2 id="h-close">Visa y Google resolvieron cómo paga un agente. Priv8 resuelve qué ve mientras trabaja.</h2>
          <p>Lo presentamos el 12 de noviembre de 2026 en Hackfinance, Madrid Engineering Week. Equipo: Ángel, Álvaro, Marco y Pablo.</p>
          <div className="cta" style={{ marginTop: 28 }}><a className="btn solid" href="#demo">Ver cómo funciona</a></div>
        </div>
        <Eight className="mini" mode="mirar" fg="#FFFFFF" cut={pal.band} />
      </div>
    </section>
  );
}

export default function App() {
  const { effective, cycle } = useTheme();
  const pal = PALETTE[effective];
  return (
    <>
      <nav className="nav" aria-label="Principal">
        <div className="wrap">
          <a className="logo" href="#" aria-label="Priv8, inicio">
            <img className="light" src="./priv8-claro.svg" alt="Priv8" />
            <img className="dark" src="./priv8-oscuro.svg" alt="Priv8" />
          </a>
          <ul>
            <li><a href="#demo">Cómo funciona</a></li>
            <li><a href="#protocolo">Protocolo</a></li>
            <li><a href="#producto">Productos</a></li>
            <li><a href="#confianza">Confianza</a></li>
          </ul>
          <div className="right">
            <button type="button" className="theme" onClick={cycle} aria-label={effective === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
              {effective === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" fill="currentColor" /></svg>
              )}
            </button>
            <a className="btn solid" href="#producto">Conoce a 8</a>
          </div>
        </div>
      </nav>
      <main>
        <Hero pal={pal} />
        <Demo pal={pal} />
        <Problem />
        <Protocol />
        <Producto pal={pal} />
        <Quien />
        <Confianza />
        <Cierre pal={pal} />
      </main>
      <footer>
        <div className="wrap">
          <span>Priv8 · Hackfinance 2026 · Madrid Engineering Week</span>
          <span>Datos de la demo inventados. Banca Alcor, Nimbo Bróker y Suministros Lumen son nombres inventados.</span>
        </div>
      </footer>
    </>
  );
}
