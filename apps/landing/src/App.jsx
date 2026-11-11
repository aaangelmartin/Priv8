import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Nav from './Nav.jsx';
import Companion from './Companion.jsx';
import Field, { Blend } from './Field.jsx';
import { SeeScene, Spot } from './Story.jsx';
import { WhyNow, Products } from './Sections.jsx';
import { HowArch, Guarantees, Developers, Compare, Compliance } from './More.jsx';
import { mood, setSection } from './companion.js';
import { PALETTE } from './useTheme.js';
import byLaaabs from './by-laaabs.svg';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* ---------------------------------------------------------------- portada */
/* Lo que hace 8, rotando en el titular: una tarea cada vez, entra desde abajo y sale por arriba. */
/* alternan empresa y persona: lo que 8 hace en un ERP y lo que hace en tu móvil. Todas caben en una línea a 360 px. */
const TASKS = ['registra facturas.', 'suma tus cuentas.', 'paga a proveedores.', 'llama a tu banco.', 'frena estafas.', 'contesta correos.', 'prepara tus pagos.'];
function Rotator() {
  const [i, setI] = useState(0);
  const box = useRef(null);
  /* el hueco se ajusta al ancho de la tarea que se ve, así el titular queda siempre centrado */
  useEffect(() => {
    const el = box.current; if (!el) return;
    const item = el.querySelectorAll('.rot-item')[i];
    if (item) el.style.width = item.scrollWidth + 'px';
  }, [i]);
  useEffect(() => {
    const on = () => { const el = box.current; const item = el && el.querySelectorAll('.rot-item')[i]; if (item) el.style.width = item.scrollWidth + 'px'; };
    window.addEventListener('resize', on);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(on);
    return () => window.removeEventListener('resize', on);
  });
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    if (still) return undefined;
    const t = setInterval(() => setI((v) => (v + 1) % TASKS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="rotator" ref={box} aria-live="polite">
      {TASKS.map((t, k) => (
        <span key={t} className={'rot-item' + (k === i ? ' on' : k === (i + TASKS.length - 1) % TASKS.length ? ' out' : '')} aria-hidden={k !== i}>
          {Array.from(t).map((ch, j) => <span key={j} className="ch" style={{ '--j': j }}>{ch === ' ' ? '\u00a0' : ch}</span>)}
        </span>
      ))}
    </span>
  );
}

function Hero() {
  return (
    <section id="inicio" className="hero" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-stage">
        <div id="hero-anchor" className="hero-anchor" data-anchor8="" data-mode="mirar" data-say="¡Hola!" aria-hidden="true" />
        <h1 id="h-hero" className="in-2"><span className="line">8 <Rotator /></span><span className="soft line">Sin ver tus datos.</span></h1>
        <p className="hero-sub in-3">
          Un agente de IA que usa tu ERP, tu correo o la app del banco como lo harías tú.
          Cada dato sensible le llega como un token; el valor real nunca sale de tu máquina.
        </p>
        <div className="cta in-4">
          <a className="btn btn-white" href="https://demo.priv8.es" target="_blank" rel="noopener">Ver la demo</a>
          <a className="btn btn-ghost" href="#problema">Mira cómo trabaja</a>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- productos */
/* ---------------------------------------------------------------- confianza y preguntas */
const FAQ = [
  ['¿Tengo que integrar algo en mis sistemas?', 'No. 8 trabaja sobre las pantallas que ya usas: el navegador para tu ERP o tu CRM y el móvil para las apps. Lee la estructura de la pantalla, no los píxeles.'],
  ['¿Qué recibe exactamente el proveedor del modelo?', 'Tokens como ‹IBAN_1-propio› y la interfaz. La tabla que traduce cada token a su valor real se queda en tu máquina o en el móvil. El TJUE admitió en 2025 que datos seudonimizados pueden no ser personales para quien no puede reidentificarlos; tu empresa sigue siendo responsable de los suyos.'],
  ['¿Y si un dato sensible se escapa sin tokenizar?', 'El bloqueo final revisa cada petición que sale hacia la nube. Si encuentra un patrón sensible, como un IBAN válido o un DNI, la petición no sale y queda registrado.'],
  ['¿Quién aprueba los pagos?', 'Siempre una persona. Pagar, firmar o enviar quedan retenidos hasta que alguien dice que sí, y la autenticación del banco la hace siempre el usuario.'],
  ['¿Queda constancia de lo que hizo?', 'Sí. Un registro firmado y encadenado guarda qué recibió el modelo, qué se bloqueó y quién aprobó cada paso.'],
  ['¿Puede 8 recomendar inversiones?', 'No. El asesoramiento financiero es una actividad regulada. 8 ejecuta lo que decides; si le pides consejo, te dice que no puede.'],
];
function Faq() {
  return (
    <section id="faq" className="block block-paper" aria-labelledby="h-faq">
      <div className="wrap faq-grid">
        <div className="block-head">
          <Spot className="spot-inline" mode="duda" say="Pregunta. No me ofendo." />
          <p className="eyebrow">Preguntas</p>
          <h2 id="h-faq">Lo que te preguntaría <span className="soft">tu responsable de seguridad.</span></h2>
        </div>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q} onToggle={(e) => { if (e.currentTarget.open) mood('curiosidad', 1400); }}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- la demo y pie */
function Cierre() {
  return (
    <section id="contacto" className="block block-cobalt close" aria-labelledby="h-close">
      <div className="wrap close-grid">
        <div className="block-head">
          <Spot className="spot-inline" mode="alegria" say="¿Me ves trabajar?" />
          <h2 id="h-close">Mírala en marcha. <span className="soft">Sin que la IA vea un dato.</span></h2>
          <p className="lead">Los dos trámites de principio a fin: lo que ves tú y lo que ve el modelo.</p>
          <div className="cta"><a className="btn btn-white" href="https://demo.priv8.es" target="_blank" rel="noopener">Ver la demo</a></div>
        </div>
      </div>
    </section>
  );
}

function Footer({ pal }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-mid">
          <div className="foot-brand">
            <a className="foot-logo" href="#inicio" aria-label="Priv8, volver arriba">
              <Eight className="foot-eight" mode="mirar" fg={pal.band} cut="#FFFFFF" label="8" />
              <span>Priv8</span>
            </a>
            <p>Privacidad para agentes de IA que usan pantallas. El modelo trabaja con tokens; los datos se quedan contigo.</p>
          </div>
          <nav className="foot-cols" aria-label="Pie">
            <div><b>Producto</b><a href="#problema">Qué ve</a><a href="#como">Cómo funciona</a><a href="#producto">Para empresas</a><a href="#producto">Priv8 en el móvil</a><a href="#integrar">Integración</a></div>
            <div><b>Confianza</b><a href="#garantias">Garantías</a><a href="#cumplimiento">Cumplimiento</a><a href="#faq">Preguntas</a></div>
            <div><b>Empezar</b><a href="https://demo.priv8.es" target="_blank" rel="noopener">Ver la demo</a><a href="#comparar">Por qué Priv8</a></div>
          </nav>
        </div>
        {/* firma de quien lo hace, como en open2agents.com: el vector de laaabs, centrado y discreto */}
        <div className="foot-by-row">
          <a className="foot-by" href="https://laaabs.com" target="_blank" rel="noopener" aria-label="by laaabs" style={{ '--by': `url(${byLaaabs})` }} />
        </div>
        {/* firma final: 8, el mismo que te ha acompañado por la web, aterriza aquí a la izquierda del nombre */}
        <div className="foot-word">
          <Spot className="spot-foot" mode="mirar" />
          <span>Priv8</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const pal = PALETTE.light;
  const [intro, setIntro] = useState(() => document.documentElement.classList.contains('intro'));
  useEffect(() => {
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    const root = document.documentElement;
    root.classList.add('js');
    if (still || !root.classList.contains('intro')) { root.classList.remove('intro'); setIntro(false); return undefined; }
    /* durante la bienvenida no se puede bajar: ni rueda, ni dedo, ni teclas de desplazamiento */
    const block = (e) => { e.preventDefault(); };
    const keys = (e) => { if ([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) e.preventDefault(); };
    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('keydown', keys);
    const release = () => { window.removeEventListener('wheel', block); window.removeEventListener('touchmove', block); window.removeEventListener('keydown', keys); };
    const end = () => { release(); window.scrollTo(0, 0); root.classList.remove('intro'); root.classList.add('landed'); setIntro(false); };
    const t = setTimeout(end, 2650);
    return () => { clearTimeout(t); release(); };
  }, []);
  /* sección visible, para la barra */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('main > section[id]'));
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) setSection(e.target.id); }), { rootMargin: '-45% 0px -45% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  /* aparición al entrar en pantalla, en los bloques normales */
  useEffect(() => {
    const els = document.querySelectorAll('.block .block-head, .block .swap-in, .block .demos, .block .faq');
    els.forEach((el) => el.classList.add('rv'));
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Blend from="--band" to="--paper" seed={1} overlay />
        <SeeScene />
        <WhyNow />
        <Blend from="--paper" to="--band" seed={3} />
        <HowArch />
        <Guarantees />
        <Blend from="--band" to="--paper" seed={5} />
        <Products />
        <Developers />
        <Blend from="--paper" to="--band" seed={6} />
        <Compare />
        <Compliance />
        <Blend from="--band" to="--paper" seed={7} />
        <Faq />
        <Blend from="--paper" to="--band" seed={8} />
        <Cierre />
        <Blend from="--band" to="--paper" seed={9} />
      </main>
      <Footer pal={pal} />
      <Companion pal={pal} intro={intro} />
    </>
  );
}
