import { useEffect, useRef, useState } from 'react';
import Eight from './eight/Eight.jsx';
import Nav from './Nav.jsx';
import Companion from './Companion.jsx';
import Field, { Blend } from './Field.jsx';
import { SeeScene, Spot } from './Story.jsx';
import { WhyNow, HowCase, Products } from './Sections.jsx';
import { HowArch, Guarantees, Developers, Compare, Compliance, Team } from './More.jsx';
import { mood, setSection } from './companion.js';
import { PALETTE } from './useTheme.js';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* ---------------------------------------------------------------- portada */
/* Lo que hace 8, rotando en el titular: una tarea cada vez, entra desde abajo y sale por arriba. */
const TASKS = ['registra facturas.', 'paga a proveedores.', 'llama al banco.', 'contesta correos.', 'concilia cuentas.', 'hace tus trámites.'];
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
          <a className="btn btn-white" href="#contacto">Pide una demo</a>
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
  ['¿Qué recibe exactamente el proveedor del modelo?', 'Tokens como ‹IBAN_1·propio› y la interfaz. La tabla que traduce cada token a su valor real se queda en tu máquina o en el móvil. El TJUE admitió en 2025 que datos seudonimizados pueden no ser personales para quien no puede reidentificarlos; tu empresa sigue siendo responsable de los suyos.'],
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

/* ---------------------------------------------------------------- pide una demo y pie */
const NEEDS = ['Facturas y pagos a proveedores', 'Atención al cliente y reclamaciones', 'Agentes para los clientes de mi banco', 'Otro proceso'];
function DemoForm({ compact = false }) {
  const [sent, setSent] = useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); mood('agradecer', 2600); };
  if (sent) return (<div className="sent" role="status"><b>Gracias.</b><p>Esta versión de la web todavía no envía el formulario. Lo conectamos en cuanto tengamos dirección de contacto.</p></div>);
  const p = compact ? 'g-' : 'f-';
  return (
    <form className={'lead-form' + (compact ? ' compact' : '')} onSubmit={submit}>
      {!compact && <label htmlFor={p + 'name'}>Nombre<input id={p + 'name'} name="name" autoComplete="name" required /></label>}
      {!compact && <label htmlFor={p + 'company'}>Empresa<input id={p + 'company'} name="company" autoComplete="organization" required /></label>}
      <label htmlFor={p + 'email'}>Correo del trabajo<input id={p + 'email'} name="email" type="email" autoComplete="email" required placeholder={compact ? 'tu@empresa.com' : undefined} /></label>
      {!compact && (
        <label htmlFor={p + 'need'}>Qué quieres automatizar
          <select id={p + 'need'} name="need" defaultValue={NEEDS[0]}>{NEEDS.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
      )}
      <button type="submit" className="btn btn-white">Pedir la demo</button>
    </form>
  );
}

function Cierre() {
  return (
    <section id="contacto" className="block block-cobalt close" aria-labelledby="h-close">
      <div className="wrap close-grid">
        <div className="block-head">
          <Spot className="spot-inline" mode="alegria" say="¿Me enseñas tu proceso?" />
          <h2 id="h-close">Enséñanos un proceso. <span className="soft">Te lo devolvemos hecho.</span></h2>
          <p className="lead">Treinta minutos con tus pantallas, o con las nuestras si todavía no quieres compartir nada. Sin integrar nada y sin que la IA vea un dato.</p>
        </div>
        <DemoForm />
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
            <div><b>Producto</b><a href="#problema">Qué ve</a><a href="#como">Cómo funciona</a><a href="#producto">Para empresas</a><a href="#producto">8 en el móvil</a><a href="#integrar">Integración</a></div>
            <div><b>Confianza</b><a href="#garantias">Garantías</a><a href="#caso">Un caso real</a><a href="#cumplimiento">Cumplimiento</a><a href="#faq">Preguntas</a></div>
            <div><b>Empezar</b><a href="#contacto">Pide una demo</a><a href="#comparar">Por qué Priv8</a><a href="#equipo">Equipo</a></div>
          </nav>
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
    const t = setTimeout(end, 2050);
    return () => { clearTimeout(t); release(); };
  }, []);
  /* sección visible, para la barra */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('main > section[id]'));
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) setSection(e.target.id); }), { rootMargin: '-45% 0px -45% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  /* una sección, una pantalla: si el contenido de un bloque no cabe en su alto, se reduce con zoom lo justo */
  useEffect(() => {
    const fit = () => {
      const wide = document.documentElement.clientWidth > 900;
      document.querySelectorAll('.block').forEach((b) => {
        const w = b.querySelector(':scope > .wrap'); if (!w) return;
        w.style.zoom = '';
        if (!wide) return;
        const cs = getComputedStyle(b);
        const reserve = b.id === 'faq' ? 120 : 0; /* sitio para la respuesta que se abra */
        const avail = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - reserve;
        const h = w.scrollHeight;
        if (h > avail) w.style.zoom = String(Math.max(0.55, avail / h));
      });
    };
    fit();
    const later = () => setTimeout(fit, 60);
    window.addEventListener('resize', later);
    document.addEventListener('click', later);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    const t = setTimeout(fit, 800);
    return () => { clearTimeout(t); window.removeEventListener('resize', later); document.removeEventListener('click', later); };
  }, []);
  /* aparición al entrar en pantalla, en los bloques normales */
  useEffect(() => {
    const els = document.querySelectorAll('.block .block-head, .block .swap-in, .block .demos, .block .faq, .lead-form');
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
        <Blend from="--paper" to="--band" seed={2} />
        <WhyNow />
        <Blend from="--band" to="--paper" seed={3} />
        <HowArch />
        <Guarantees />
        <Blend from="--paper" to="--band" seed={4} />
        <HowCase />
        <Blend from="--band" to="--paper" seed={5} />
        <Products />
        <Developers />
        <Blend from="--paper" to="--band" seed={6} />
        <Compare />
        <Blend from="--band" to="--paper" seed={7} />
        <Compliance />
        <Faq />
        <Team />
        <Blend from="--paper" to="--band" seed={8} />
        <Cierre />
        <Blend from="--band" to="--paper" seed={9} />
      </main>
      <Footer pal={pal} />
      <Companion pal={pal} intro={intro} />
    </>
  );
}
