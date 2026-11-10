import { useEffect, useRef, useState } from 'react';
import { Spot } from './Story.jsx';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* aparece cuando entra en pantalla (una vez) */
function useSeen() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

/* barra de bloques: n bloques llenos de un total, como en Open2Agents */
function Blocks({ total, full, extra = 0, seen }) {
  return (
    <div className="blocks" aria-hidden="true" style={{ '--cols': total > 30 ? Math.ceil(total / 2) : total }}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < full ? 'on' : i < full + extra ? 'add' : ''} style={{ transitionDelay: `${i * 18}ms` }} data-seen={seen ? '1' : '0'} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- por qué ahora */
export function WhyNow() {
  const [ref, seen] = useSeen();
  return (
    <section id="cifras" className="block block-paper why" aria-labelledby="h-why" ref={ref}>
      <div className="wrap why-grid">
        <div className="why-head">
          <Spot className="spot-inline" mode="curiosidad" say="Los agentes ya están dentro." />
          <p className="eyebrow">Por qué ahora</p>
          <h2 id="h-why">Los bancos ya usan agentes. <span className="soft">Nadie sabe qué ven.</span></h2>
        </div>
        <div className={'why-stats' + (seen ? ' seen' : '')}>
          <div className="stat">
            <p className="stat-k">bancos europeos con IA generativa o agentes de cara al cliente</p>
            <p className="stat-n">55 %</p>
            <Blocks total={20} full={11} seen={seen} />
            <p className="stat-s">fuente: EBA, seguimiento de la IA en banca, 2025</p>
          </div>
          <div className="stat">
            <p className="stat-k">directivos que ponen la seguridad o la privacidad como primer freno de los agentes</p>
            <p className="stat-n">52 %</p>
            <Blocks total={20} full={10} extra={0} seen={seen} />
            <p className="stat-s">fuente: <a href="https://securitybrief.co.uk/story/security-fears-keep-half-of-agentic-ai-stuck-in-pilots" target="_blank" rel="noreferrer">Dynatrace, vía SecurityBrief</a></p>
          </div>
          <div className="stat">
            <p className="stat-k">datos sensibles de la pantalla que llegan al modelo cuando el agente no tiene protección</p>
            <p className="stat-n hot">97 %</p>
            <Blocks total={20} full={19} seen={seen} />
            <p className="stat-s">fuente: <a href="https://arxiv.org/html/2602.10139v2" target="_blank" rel="noreferrer">Tsinghua, «Available but Invisible»</a></p>
          </div>
          <div className="stat">
            <p className="stat-k">fraude en pagos en la UE: 3.500 M€ en 2023 y 4.200 M€ en 2024. Más de la mitad del fraude en transferencias es manipulación del pagador</p>
            <p className="stat-n hot">4.200 M€</p>
            <Blocks total={42} full={35} extra={7} seen={seen} />
            <p className="stat-s">fuente: EBA y BCE, informe de fraude en pagos 2025 · 1 bloque = 100 M€</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- cómo funciona */
/* Un esquema de flujo, todo a la vista: la pantalla entra, se lee, se tokeniza y el modelo solo recibe tokens.
   Luego, según lo que quiera hacer el agente, una de cuatro salidas. Las piezas aparecen en orden y las flechas corren. */
export function HowFlow() {
  const [ref, seen] = useSeen();
  return (
    <section id="como" className={'block block-cobalt flow' + (seen ? ' seen' : '')} aria-labelledby="h-how" ref={ref}>
      <div className="wrap">
        <div className="block-head">
          <Spot className="spot-inline" mode="leer" say="Así trabajo sin mirar." />
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="h-how">La pantalla entra.<br /><span className="soft">Los datos se quedan.</span></h2>
        </div>
        <div className="flow-row">
          <article className="node" style={{ '--d': 0 }}>
            <p className="tag"><b>00</b> llega una pantalla</p>
            <h3>Tu ERP, tu correo o la app del banco</h3>
            <code className="sample">Saldo: 3.412,58 €</code>
          </article>
          <span className="link" style={{ '--d': 1 }} />
          <article className="node" style={{ '--d': 2 }}>
            <p className="tag"><b>p.01</b> lee</p>
            <h3>La estructura, no la foto</h3>
            <p>El DOM en la web, el árbol de accesibilidad en el móvil.</p>
          </article>
          <span className="link" style={{ '--d': 3 }} />
          <article className="node" style={{ '--d': 4 }}>
            <p className="tag"><b>p.02</b> tokeniza</p>
            <h3>Cada dato, su token</h3>
            <p className="pairs"><span>3.412,58 €</span><Tok>‹IMPORTE_1›</Tok></p>
            <p className="pairs"><span>clave</span><Tok>nunca sale</Tok></p>
          </article>
          <span className="link" style={{ '--d': 5 }} />
          <article className="node node-out" style={{ '--d': 6 }}>
            <p className="tag"><b>=</b> lo que recibe el modelo</p>
            <p className="big0">0</p>
            <p>datos reales. Solo tokens y la interfaz.</p>
          </article>
        </div>
        <div className="flow-q" style={{ '--d': 7 }}><span className="tag"><b>q</b></span>¿Qué quiere hacer el agente?</div>
        <div className="flow-outs">
          <article className="out" style={{ '--d': 8 }}><h4>Consultar</h4><p>Un oráculo local responde «sí» o «no», sin dar la cifra.</p></article>
          <article className="out" style={{ '--d': 9 }}><h4>Escribir</h4><p>El ejecutor pone el valor real en local, justo antes de pulsar.</p></article>
          <article className="out" style={{ '--d': 10 }}><h4>Pagar o firmar</h4><p>Espera el «sí» de una persona. La clave la pone ella.</p></article>
          <article className="out out-stop" style={{ '--d': 11 }}><h4>Usar un dato de un correo</h4><p>Bloqueado: no puede entrar en un campo de pago.</p></article>
        </div>
        <p className="flow-foot" style={{ '--d': 12 }}>Y cada paso queda en un registro firmado.</p>
      </div>
    </section>
  );
}
