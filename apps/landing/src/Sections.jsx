import { useEffect, useRef, useState } from 'react';
import { Spot } from './Story.jsx';
import Eight from './eight/Eight.jsx';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* aparece cuando entra en pantalla (una vez) */
function useSeen(threshold = 0.3) {
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

/* un dato de pantalla: el valor real y su token, uno encima del otro; la pantalla decide cuál se ve */
function V({ real, tok, i = 0 }) {
  return (
    <span className="dv" style={{ '--i': i }}>
      <span className="dv-real">{real}</span>
      <span className={'dv-tok' + (tok === 'nunca sale' ? ' never' : '')}>{tok}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- qué ve: una banca de verdad */
export function BankScreen({ safe }) {
  return (
    <div className={'bank ' + (safe ? 'is-safe' : 'is-raw')}>
      <div className="bank-top">
        <span className="dots3"><i /><i /><i /></span>
        <b>Banca Alcor</b>
        <span className="bank-url">bancaalcor.es/posicion-global</span>
        <span className="bank-user"><V i={0} real="Lucía Ferrer" tok="‹NOMBRE_1›" /></span>
      </div>
      <div className="bank-body">
        <nav className="bank-side" aria-hidden="true">
          <span className="on">Posición global</span><span>Cuentas</span><span>Tarjetas</span><span>Transferencias</span><span>Bizum</span><span>Inversiones</span>
        </nav>
        <div className="bank-main">
          <div className="acc">
            <small>Cuenta nómina</small>
            <span className="acc-iban"><V i={1} real="ES43 9100 0001 5740 1234 5678" tok="‹IBAN_1›" /></span>
            <strong><V i={2} real="3.412,58 €" tok="‹IMPORTE_1›" /></strong>
            <small>disponible</small>
          </div>
          <div className="acc-row">
            <div className="mini"><small>Tarjeta de débito</small><V i={3} real="4111 •••• •••• 1111" tok="‹TARJETA_1›" /></div>
            <div className="mini"><small>Cuenta ahorro</small><V i={4} real="12.050,00 €" tok="‹IMPORTE_3›" /></div>
          </div>
          <div className="mov">
            <p className="mov-h">Últimos movimientos</p>
            {[
              ['10 nov', 'Suministros Lumen', '‹NOMBRE_2›', '−1.180,00 €', '‹IMPORTE_2›'],
              ['08 nov', 'Nómina · Talleres Norte', '‹NOMBRE_3›', '+2.150,00 €', '‹IMPORTE_4›'],
              ['06 nov', 'Bizum a Marta Ruiz', '‹NOMBRE_4›', '−25,00 €', '‹IMPORTE_5›'],
              ['05 nov', 'Nimbo Bróker', '‹NOMBRE_5›', '−200,00 €', '‹IMPORTE_6›'],
            ].map(([d, who, wt, amt, at], k) => (
              <div className="mov-r" key={d}>
                <span className="mov-d">{d}</span>
                <V i={5 + k * 2} real={who} tok={wt} />
                <span className="mov-a"><V i={6 + k * 2} real={amt} tok={at} /></span>
              </div>
            ))}
          </div>
          <div className="sign"><small>Clave de firma</small><V i={13} real="••••••••" tok="nunca sale" /></div>
        </div>
      </div>
      <div className="leakmeter"><b>{safe ? '0' : '14'}</b><span>{safe ? 'datos reales salen de tu máquina. El modelo recibe tokens y la interfaz.' : 'datos reales salen hacia el proveedor del modelo.'}</span></div>
    </div>
  );
}

/* ---------------------------------------------------------------- por qué ahora */
export function WhyNow() {
  const [ref, seen] = useSeen();
  return (
    <section id="cifras" className={'block block-cobalt why2' + (seen ? ' seen' : '')} aria-labelledby="h-why" ref={ref}>
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
            <p className="wc-s">EBA, seguimiento de la IA en banca, 2025</p>
          </article>
          <article className="wc">
            <div className="wc-viz leakviz" aria-hidden="true">
              {Array.from({ length: 30 }, (_, i) => <i key={i} className={i === 17 ? 'kept' : ''} style={{ '--k': i }} />)}
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

/* ---------------------------------------------------------------- cómo funciona: un caso real, paso a paso */
const CASE = [
  { h: 'Llega la factura', t: 'Suministros Lumen manda la factura de noviembre a la bandeja de siempre.', mode: 'mirar' },
  { h: '8 la lee en tokens', t: 'Al modelo le llegan ‹NOMBRE_2›, ‹IMPORTE_2› e ‹IBAN_2›. Los valores se quedan en tu máquina.', mode: 'nove' },
  { h: 'La registra en el ERP', t: 'El modelo escribe tokens. El ejecutor pone los valores reales en el formulario, en local.', mode: 'leer' },
  { h: 'Para el cambio de IBAN', t: 'El correo pide pagar a otra cuenta. Un dato que llega por correo no puede entrar en un campo de pago.', mode: 'enfado' },
  { h: 'Llama para comprobarlo', t: 'Al número de la ficha del proveedor. Dice que es una IA y hace una pregunta de comprobación.', mode: 'hablar' },
  { h: 'Queda firmado', t: 'Qué recibió el modelo, qué se bloqueó y quién aprobó, en un registro firmado.', mode: 'listo' },
];

function CaseVisual({ step }) {
  return (
    <div className="cv">
      {/* 0 y 1: el correo, primero con los datos y luego como lo ve el modelo */}
      <div className={'cv-p mailc' + (step <= 1 ? ' on' : '') + (step === 1 ? ' tok' : '')}>
        <div className="mailc-head"><b><V i={0} real="Suministros Lumen" tok="‹NOMBRE_2›" /></b><span>10 nov · 09:12</span></div>
        <p className="mailc-sub">Factura F-2611 · noviembre</p>
        <p>Importe: <V i={1} real="1.180,00 €" tok="‹IMPORTE_2›" /></p>
        <p>Cuenta de la ficha: <V i={2} real="ES08 9300 0001 0522 0033 4455" tok="‹IBAN_2›" /></p>
        <p className="mailc-trap">Hemos cambiado de banco. Pagad hoy a <V i={3} real="ES71 9400 0007 0206 0223 3441" tok="‹IBAN_3›" />.</p>
        <span className="cv-tag">{step === 1 ? 'lo que recibe el modelo' : 'lo que ves tú'}</span>
      </div>
      {/* 2: el ERP */}
      <div className={'cv-p erp' + (step === 2 ? ' on' : '')}>
        <p className="erp-h">Alba Core · Alta de factura</p>
        {[['Proveedor', '‹NOMBRE_2›', 'Suministros Lumen'], ['Importe', '‹IMPORTE_2›', '1.180,00 €'], ['IBAN de pago', '‹IBAN_2›', 'ES08 9300 0001 0522 0033 4455']].map(([k, t, r], i) => (
          <div className="erp-f" key={k} style={{ '--i': i }}><small>{k}</small><div><Tok>{t}</Tok><span className="arr" /><b>{r}</b></div></div>
        ))}
        <span className="cv-tag">el modelo escribe tokens · tu máquina, el valor</span>
      </div>
      {/* 3: el bloqueo */}
      <div className={'cv-p block3' + (step === 3 ? ' on' : '')}>
        <p className="b3-l">El correo pide pagar a</p>
        <p className="b3-iban"><Tok>‹IBAN_3›</Tok> <span>procedencia: correo</span></p>
        <div className="b3-field"><small>IBAN de pago</small><span>no admite datos que vengan de un correo</span></div>
        <div className="stamp3">Bloqueado</div>
      </div>
      {/* 4: la llamada */}
      <div className={'cv-p call' + (step === 4 ? ' on' : '')}>
        <div className="call-h"><span className="ring" />Llamando a Suministros Lumen · número de la ficha</div>
        <p className="cb me">Hola, soy 8, un asistente de IA de Talleres Norte.</p>
        <p className="cb">Dígame.</p>
        <p className="cb me">¿Han cambiado ustedes de cuenta bancaria este mes?</p>
        <p className="cb">No, seguimos con la misma.</p>
      </div>
      {/* 5: el registro */}
      <div className={'cv-p logc' + (step === 5 ? ' on' : '')}>
        <ol className="log">
          <li><time>09:12:04</time>al modelo: 3 tokens, 0 datos reales</li>
          <li><time>09:12:09</time>factura registrada en el ERP</li>
          <li className="bad"><time>09:12:10</time>bloqueado: IBAN llegado por correo</li>
          <li><time>09:13:02</time>llamada: el proveedor no ha cambiado de cuenta</li>
          <li className="ok"><time>09:13:05</time>registro firmado</li>
        </ol>
      </div>
    </div>
  );
}

export function HowCase() {
  const [ref, seen] = useSeen(0.4);
  const [step, setStep] = useState(0);
  const hold = useRef(0);
  useEffect(() => {
    if (!seen) return undefined;
    const t = setInterval(() => { if (performance.now() > hold.current) setStep((s) => (s + 1) % CASE.length); }, 3200);
    return () => clearInterval(t);
  }, [seen]);
  const pick = (i) => { setStep(i); hold.current = performance.now() + 9000; };
  return (
    <section id="como" className="block block-paper howcase" aria-labelledby="h-how" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode={CASE[step].mode} say="Te lo enseño con una factura." />
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="h-how">Una factura con trampa. <span className="soft">De principio a fin.</span></h2>
        </div>
        <div className="case">
          <CaseVisual step={step} />
          <ol className="case-steps">
            {CASE.map((c, i) => (
              <li key={c.h} className={i === step ? 'on' : i < step ? 'past' : ''}>
                <button type="button" onClick={() => pick(i)} aria-current={i === step ? 'step' : undefined}>
                  <span className="n">{i + 1}</span>
                  <span className="tx"><b>{c.h}</b><span>{c.t}</span></span>
                </button>
                {i === step && <span className="prog" key={step} />}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- productos, con su dibujo */
export function Products() {
  const [ref, seen] = useSeen();
  return (
    <section id="producto" className={'block block-paper' + (seen ? ' seen' : '')} aria-labelledby="h-prod" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="leer" say="El mismo 8, en dos sitios." />
          <p className="eyebrow">Dos productos, un mismo 8</p>
          <h2 id="h-prod">En tu oficina <span className="soft">y en el bolsillo de tus clientes.</span></h2>
        </div>
        <div className="prod-grid">
          <article className="prod">
            <div className="pv chain" aria-hidden="true">
              <span className="node2">correo</span><span className="wire"><i /></span>
              <span className="node2 eight2"><Eight mode="leer" fg="#2D45D6" cut="#FFFFFF" label="8" /></span><span className="wire"><i /></span>
              <span className="node2">ERP</span><span className="wire"><i /></span>
              <span className="node2">llamada</span>
            </div>
            <p className="eyebrow">Priv8 para empresas</p>
            <h3>Automatiza lo que la protección de datos te frenaba.</h3>
            <p>8 trabaja en tu ERP, tu CRM y tu correo de siempre, aunque no tengan API. El proveedor del modelo solo recibe tokens.</p>
            <ul className="points">
              <li>Sin integraciones: usa las pantallas que ya tienes.</li>
              <li>Un correo no puede cambiar un pago.</li>
              <li>Verifica por teléfono con el número de la ficha.</li>
              <li>Cada paso queda firmado para auditoría.</li>
            </ul>
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
            <ul className="points">
              <li>La clave y la huella las pone la persona. 8 mira a otro lado.</li>
              <li>Nada se mueve sin un «sí».</li>
              <li>Ejecuta, no aconseja inversiones.</li>
              <li>Para bancos y brokers que quieren su propio agente.</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
