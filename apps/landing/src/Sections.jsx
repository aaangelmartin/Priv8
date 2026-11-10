import { useEffect, useRef, useState } from 'react';
import { Spot, Scene } from './Story.jsx';
import Eight from './eight/Eight.jsx';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* aparece cuando entra en pantalla (una vez) */
export function useSeen(threshold = 0.3) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

/* Un dato de pantalla que pasa de su valor real a su token con un glitch: las letras se revuelven una a una
   y se asientan en el nuevo texto. `on` = enseñar el token. `hot` = marcar el valor real como dato expuesto. */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789‹›_·#*%';
function V({ real, tok, on, i = 0, hot = false }) {
  const target = on ? tok : real;
  const [txt, setTxt] = useState(target);
  const [settled, setSettled] = useState(true);
  const first = useRef(true);
  const shown = useRef(target);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* nada */ }
    if (still) { setTxt(target); shown.current = target; return undefined; }
    const from = shown.current, len = Math.max(from.length, target.length);
    const t0 = performance.now() + i * 40, dur = 520;
    let raf = 0;
    setSettled(false);
    const step = (now) => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      let out = '';
      for (let j = 0; j < len; j++) {
        if (j / len < k * 1.15 - 0.1) out += target[j] ?? '';
        else if (k > 0) out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        else out += from[j] ?? '';
      }
      setTxt(out);
      if (k < 1) raf = requestAnimationFrame(step); else { setTxt(target); shown.current = target; setSettled(true); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const cls = 'dv3' + (on && settled ? ' is-tok' : '') + (!settled ? ' is-glitch' : '') + (!on && settled && hot ? ' is-hot' : '');
  return <span className={cls}>{txt}</span>;
}

/* ---------------------------------------------------------------- qué ve: una banca de verdad */
export function BankScreen({ safe }) {
  const h = !safe;
  return (
    <div className={'bank ' + (safe ? 'is-safe' : 'is-raw')}>
      <div className="bank-top">
        <span className="dots3"><i /><i /><i /></span>
        <b>Banca Alcor</b>
        <span className="bank-url">bancaalcor.es/posicion-global</span>
        <span className="bank-user"><V on={safe} hot={h} i={0} real="Lucía Ferrer" tok="‹NOMBRE_1›" /></span>
      </div>
      <div className="bank-body">
        <nav className="bank-side" aria-hidden="true">
          <span className="on">Posición global</span><span>Cuentas</span><span>Tarjetas</span><span>Transferencias</span><span>Bizum</span><span>Inversiones</span>
        </nav>
        <div className="bank-main">
          <div className="acc">
            <small>Cuenta nómina</small>
            <span className="acc-iban"><V on={safe} hot={h} i={1} real="ES43 9100 0001 5740 1234 5678" tok="‹IBAN_1›" /></span>
            <strong><V on={safe} hot={h} i={2} real="3.412,58 €" tok="‹IMPORTE_1›" /></strong>
            <small>disponible</small>
          </div>
          <div className="acc-row">
            <div className="mini"><small>Tarjeta de débito</small><V on={safe} hot={h} i={3} real="4111 •••• •••• 1111" tok="‹TARJETA_1›" /></div>
            <div className="mini"><small>Cuenta ahorro</small><V on={safe} hot={h} i={4} real="12.050,00 €" tok="‹IMPORTE_3›" /></div>
          </div>
          <div className="mov">
            <p className="mov-h">Últimos movimientos</p>
            {[
              ['10 nov', 'Suministros Lumen', '‹NOMBRE_2›', '−1.180,00 €', '‹IMPORTE_2›'],
              ['08 nov', 'Nómina Talleres Norte', '‹NOMBRE_3›', '+2.150,00 €', '‹IMPORTE_4›'],
              ['06 nov', 'Bizum a Marta Ruiz', '‹NOMBRE_4›', '−25,00 €', '‹IMPORTE_5›'],
              ['05 nov', 'Nimbo Bróker', '‹NOMBRE_5›', '−200,00 €', '‹IMPORTE_6›'],
            ].map(([d, who, wt, amt, at], k) => (
              <div className="mov-r" key={d}>
                <span className="mov-d">{d}</span>
                <span className="mov-w"><V on={safe} hot={h} i={5 + k * 2} real={who} tok={wt} /></span>
                <span className="mov-a"><V on={safe} hot={h} i={6 + k * 2} real={amt} tok={at} /></span>
              </div>
            ))}
          </div>
          <div className="sign"><small>Clave de firma</small><V on={safe} hot={h} i={13} real="••••••••" tok="nunca sale" /></div>
        </div>
      </div>
      <div className="leakmeter"><b>{safe ? '0' : '14'}</b><span>{safe ? 'datos reales salen de tu máquina. El modelo recibe tokens y la interfaz.' : 'datos reales salen hacia el proveedor del modelo.'}</span></div>
    </div>
  );
}

/* ---------------------------------------------------------------- por qué ahora (en blanco) */
export function WhyNow() {
  const [ref, seen] = useSeen();
  return (
    <section id="cifras" className={'block block-paper why2' + (seen ? ' seen' : '')} aria-labelledby="h-why" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="curiosidad" say="Los agentes ya están dentro." />
          <p className="eyebrow">Por qué ahora</p>
          <h2 id="h-why">Los bancos ya usan agentes. <span className="soft">Nadie controla qué ven.</span></h2>
        </div>
        <div className="why-cards">
          <article className="wc">
            <div className="wc-viz dotgrid" aria-hidden="true">{Array.from({ length: 100 }, (_, i) => <i key={i} className={i < 55 ? 'on' : ''} style={{ '--k': i }} />)}</div>
            <p className="wc-n">55 %</p>
            <p className="wc-t">de los bancos europeos ya usa IA generativa o agentes con sus clientes.</p>
            <p className="wc-s">55 de cada 100 · EBA, seguimiento de la IA en banca, 2025</p>
          </article>
          <article className="wc">
            <div className="wc-viz leakviz" aria-hidden="true">
              {Array.from({ length: 33 }, (_, i) => <i key={i} className={i === 20 ? 'kept' : ''} style={{ '--k': i }} />)}
            </div>
            <p className="wc-n">97 %</p>
            <p className="wc-t">de los datos sensibles de la pantalla llega al modelo cuando el agente no tiene protección.</p>
            <p className="wc-s"><a href="https://arxiv.org/html/2602.10139v2" target="_blank" rel="noreferrer">Tsinghua, «Available but Invisible»</a></p>
          </article>
          <article className="wc">
            <div className="wc-viz bars" aria-hidden="true">
              <div className="bar" style={{ '--w': '83%' }}><span>2023</span><b>3.500 M€</b></div>
              <div className="bar now" style={{ '--w': '100%' }}><span>2024</span><b>4.200 M€</b></div>
            </div>
            <p className="wc-n">+20 %</p>
            <p className="wc-t">de fraude en pagos en la UE en un año. En transferencias, más de la mitad es alguien que se hace pasar por otro.</p>
            <p className="wc-s">EBA y BCE, informe de fraude en pagos 2025</p>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- un caso real, con el scroll */
const CASE = [
  { h: 'Llega la factura', t: 'Suministros Lumen manda la factura de noviembre a la bandeja de siempre.', mode: 'mirar', say: 'Factura nueva.' },
  { h: '8 la lee en tokens', t: 'Al modelo le llegan ‹NOMBRE_2›, ‹IMPORTE_2› e ‹IBAN_2›. Los valores se quedan en tu máquina.', mode: 'nove', say: 'La leo sin ver los datos.' },
  { h: 'La registra en el ERP', t: 'El modelo escribe tokens. El ejecutor pone los valores reales en el formulario, en local.', mode: 'leer', say: 'Registrada.' },
  { h: 'Para el cambio de IBAN', t: 'El correo pide pagar a otra cuenta. Un dato que llega por correo no puede entrar en un campo de pago.', mode: 'enfado', say: 'Ese IBAN no es el de la ficha.' },
  { h: 'Llama para comprobarlo', t: 'Al número de la ficha del proveedor. Dice que es una IA y hace una pregunta de comprobación.', mode: 'hablar', say: 'Hola, soy 8, un asistente de IA.' },
  { h: 'Queda firmado', t: 'Qué recibió el modelo, qué se bloqueó y quién aprobó, en un registro firmado.', mode: 'listo', say: 'Todo apuntado.' },
];

function Win({ title, tag, children, on, cls = '' }) {
  return (
    <div className={'cv-p ' + cls + (on ? ' on' : '')}>
      <div className="win-bar"><span className="dots3"><i /><i /><i /></span><b>{title}</b>{tag && <span className="win-tag">{tag}</span>}</div>
      <div className="win-body">{children}</div>
    </div>
  );
}

function CaseVisual({ step }) {
  const tok = step === 1;
  return (
    <div className="cv">
      <Win title="Correo · Bandeja de entrada" tag={tok ? 'lo que recibe el modelo' : 'lo que ves tú'} on={step <= 1} cls="mailc">
        <div className="mailc-head"><b><V on={tok} i={0} real="Suministros Lumen" tok="‹NOMBRE_2›" /></b><span>10 nov · 09:12</span></div>
        <p className="mailc-sub">Factura F-2611 · noviembre</p>
        <div className="mailc-att">F-2611.pdf · <V on={tok} i={1} real="1.180,00 €" tok="‹IMPORTE_2›" /></div>
        <p>Pago a la cuenta de siempre: <V on={tok} i={2} real="ES08 9300 0001 0522 0033 4455" tok="‹IBAN_2›" /></p>
        <p className="mailc-trap">P. D.: hemos cambiado de banco. Pagad hoy a <V on={tok} i={3} real="ES71 9400 0007 0206 0223 3441" tok="‹IBAN_3›" />.</p>
      </Win>
      <Win title="Alba Core · Alta de factura" tag="el modelo escribe tokens" on={step === 2} cls="erp">
        {[['Proveedor', '‹NOMBRE_2›', 'Suministros Lumen'], ['Importe', '‹IMPORTE_2›', '1.180,00 €'], ['IBAN de pago', '‹IBAN_2›', 'ES08 9300 0001 0522 0033 4455']].map(([k, t, r], i) => (
          <div className="erp-f" key={k} style={{ '--i': i }}><small>{k}</small><div><Tok>{t}</Tok><span className="arr" /><b>{r}</b></div></div>
        ))}
        <p className="erp-ok">Guardado en local por el ejecutor</p>
      </Win>
      <Win title="Alba Core · Pago a proveedor" tag="procedencia" on={step === 3} cls="block3">
        <div className="b3-row"><small>IBAN de la ficha</small><Tok>‹IBAN_2›</Tok><span className="ok">permitido</span></div>
        <div className="b3-row bad"><small>IBAN del correo</small><Tok>‹IBAN_3›</Tok><span className="ko">bloqueado</span></div>
        <p className="b3-why">Un dato que llega por correo no puede entrar en un campo de pago.</p>
      </Win>
      <Win title="Llamada saliente" tag="número de la ficha" on={step === 4} cls="call">
        <div className="call-h"><span className="ring" />Suministros Lumen · llamando</div>
        <p className="cb me">Hola, soy 8, un asistente de IA de Talleres Norte.</p>
        <p className="cb">Dígame.</p>
        <p className="cb me">¿Han cambiado ustedes de cuenta bancaria este mes?</p>
        <p className="cb">No, seguimos con la misma.</p>
      </Win>
      <Win title="Registro firmado" tag="auditoría" on={step === 5} cls="logc">
        <ol className="log">
          <li><time>09:12:04</time>al modelo: 3 tokens, 0 datos reales</li>
          <li><time>09:12:09</time>factura registrada en el ERP</li>
          <li className="bad"><time>09:12:10</time>bloqueado: IBAN llegado por correo</li>
          <li><time>09:13:02</time>llamada: el proveedor no ha cambiado de cuenta</li>
          <li className="ok"><time>09:13:05</time>registro firmado</li>
        </ol>
      </Win>
    </div>
  );
}

export function HowCase() {
  return (
    <Scene id="caso" screens={CASE.length} tone="cobalt" phases={CASE.length} label="Un caso real">
      {({ phase }) => (
        <div className="wrap caseScn">
          <div className="case-head">
            <Spot className="spot-inline" mode={CASE[phase].mode} say={CASE[phase].say} />
            <p className="eyebrow">Un caso real</p>
            <h2>Una factura con trampa. <span className="soft">De principio a fin.</span></h2>
          </div>
          <div className="case">
            <CaseVisual step={phase} />
            <ol className="case-steps">
              {CASE.map((c, i) => (
                <li key={c.h} className={i === phase ? 'on' : i < phase ? 'past' : ''}>
                  <span className="n">{i + 1}</span>
                  <span className="tx"><b>{c.h}</b><span>{c.t}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Scene>
  );
}

/* ---------------------------------------------------------------- productos, con su dibujo */
export function Products() {
  const [ref, seen] = useSeen();
  return (
    <section id="producto" className={'block block-paper prods' + (seen ? ' seen' : '')} aria-labelledby="h-prod" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="leer" say="El mismo 8, en dos sitios." />
          <p className="eyebrow">Dos productos, un mismo 8</p>
          <h2 id="h-prod">En tu oficina <span className="soft">y en el bolsillo de tus clientes.</span></h2>
        </div>
        <div className="prod-grid">
          <article className="prod">
            {/* solo un ERP, con 8 trabajando dentro: rellena con tokens y el valor real aparece en local */}
            <div className="pv erpv" aria-hidden="true">
              <div className="erpv-win">
                <div className="win-bar"><span className="dots3"><i /><i /><i /></span><b>Alba Core · Alta de factura</b></div>
                <div className="erpv-body">
                  <div className="erpv-f" style={{ '--d': 0 }}><small>Proveedor</small><span><Tok>‹NOMBRE_2›</Tok><b>Suministros Lumen</b></span></div>
                  <div className="erpv-f" style={{ '--d': 1 }}><small>Importe</small><span><Tok>‹IMPORTE_2›</Tok><b>1.180,00 €</b></span></div>
                  <div className="erpv-f" style={{ '--d': 2 }}><small>IBAN</small><span><Tok>‹IBAN_2›</Tok><b>ES08 9300 …</b></span></div>
                </div>
              </div>
              <div className="erpv-eight"><Eight mode="leer" fg="#2D45D6" cut="#FFFFFF" label="8" /></div>
            </div>
            <p className="eyebrow">Priv8 para empresas</p>
            <h3>Automatiza lo que la protección de datos te frenaba.</h3>
            <p>8 trabaja en tu ERP, tu CRM y tu correo de siempre, aunque no tengan API. El proveedor del modelo solo recibe tokens.</p>
            <dl className="facts">
              <div><dt>Para</dt><dd>Finanzas, operaciones y atención al cliente.</dd></div>
              <div><dt>Dónde</dt><dd>En el navegador del puesto de trabajo, sin integraciones.</dd></div>
              <div><dt>Qué hace</dt><dd>Registra facturas, da de alta proveedores, contesta correos y prepara pagos.</dd></div>
            </dl>
          </article>
          <article className="prod">
            <div className="pv phone2" aria-hidden="true">
              <div className="p2-scr">
                <p className="pb me" style={{ '--d': 0 }}>¿Cuánto tengo entre mis bancos?</p>
                <p className="pb" style={{ '--d': 1 }}>Te lo digo en voz alta.<small>al modelo: ‹SUMA_1›</small></p>
                <p className="pb me" style={{ '--d': 2 }}>Pasa 200 € al bróker.</p>
                <p className="pb" style={{ '--d': 3 }}>Preparado. ¿Lo confirmas?</p>
                <div className="pc" style={{ '--d': 4 }}><i>Cancelar</i><i className="yes">Confirmar</i></div>
              </div>
            </div>
            <p className="eyebrow">8 en el móvil</p>
            <h3>Tus clientes le hablan a 8 y él maneja sus apps del banco.</h3>
            <p>Lee, suma y prepara sin ver las cuentas. Las cifras las dice la voz del propio móvil; a la nube no llegan.</p>
            <dl className="facts">
              <div><dt>Para</dt><dd>Bancos y brokers que quieren ofrecer su propio agente.</dd></div>
              <div><dt>Dónde</dt><dd>En Android, a través de la accesibilidad, con voz.</dd></div>
              <div><dt>Qué hace</dt><dd>Consulta saldos entre bancos y prepara transferencias. La clave la pone la persona.</dd></div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}
