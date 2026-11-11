import { useEffect, useRef, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';
import Field, { Blend } from '@landing/Field.jsx';
import byLaaabs from '@landing/by-laaabs.svg';
import Reproductor from './Movil.jsx';
import { EMPRESAS, MOVIL, PASOS, APKS, INSTALAR, ENLACES, REPO, README_URL } from './contenido.js';

const SECCIONES = [['empresas', 'Para empresas'], ['movil', 'En el móvil'], ['correlo', 'Córrelo tú'], ['enlaces', 'Enlaces']];
const ext = (href) => (/^https?:/.test(href) ? { target: '_blank', rel: 'noopener' } : {});

/* Tamaños de lo que copió scripts/assemble.mjs. En `pnpm dev` no existe: no se enseñan tamaños ni avisos. */
function useArchivos() {
  const [a, setA] = useState(null);
  useEffect(() => {
    fetch('/archivos.json').then((r) => (r.ok ? r.json() : null)).then(setA, () => setA(null));
  }, []);
  return a;
}
const mb = (n) => (n / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' MB';
function size(archivos, file) {
  if (!file || !archivos) return { ok: true, label: null };
  const n = archivos[file];
  return n ? { ok: true, label: mb(n) } : { ok: false, label: 'No incluido en esta build' };
}

/* ---------------------------------------------------------------- barra */
function Nav() {
  const [onWhite, setOnWhite] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const nav = document.querySelector('.nav'); if (!nav) return;
      const r = nav.getBoundingClientRect();
      const y = r.top + r.height / 2;
      /* como en la web: el color depende de la sección de debajo; en una transición, de la mitad que toca */
      const el = document.elementsFromPoint(document.documentElement.clientWidth / 2, y)
        .find((e) => !nav.contains(e) && e.closest('[data-tone], .blend'));
      if (!el) return setOnWhite(false);
      const blend = el.closest('.blend');
      if (blend) {
        const br = blend.getBoundingClientRect();
        const side = (y - br.top) / Math.max(1, br.height) < 0.5 ? blend.dataset.from : blend.dataset.to;
        return setOnWhite(side === '--paper' || side === '--mist');
      }
      setOnWhite(el.closest('[data-tone]').dataset.tone === 'paper');
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(check); };
    ask(); window.addEventListener('scroll', ask, { passive: true }); window.addEventListener('resize', ask);
    return () => { window.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); cancelAnimationFrame(raf); };
  }, []);
  return (
    <nav className={`nav${onWhite ? ' on-white' : ''}`} aria-label="Principal">
      <a className="brand" href="#inicio" aria-label="Priv8 Demo, inicio">
        <Eight className="nav-eight" mode="mirar" fg={onWhite ? '#FFFFFF' : '#2D45D6'} cut={onWhite ? '#2D45D6' : '#FFFFFF'} label="8" />
        <span className="word">Priv8</span>
        <span className="d-badge">Demo</span>
      </a>
      <ul className="links">
        {SECCIONES.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
      </ul>
      <div className="tools">
        <button type="button" className="menu-btn" aria-expanded={open} aria-controls="nav-menu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((o) => !o)}>
          <span /><span />
        </button>
      </div>
      <div id="nav-menu" className={'nav-menu' + (open ? ' open' : '')} hidden={!open}>
        {SECCIONES.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>)}
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------------- piezas */
function Head({ id, eyebrow, title, soft, lead }) {
  return (
    <div className="block-head">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id}>{title} <span className="soft">{soft}</span></h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}
function useCopiar(texto) {
  const [estado, setEstado] = useState('idle');
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  const go = async () => {
    setEstado((await copiar(texto)) ? 'ok' : 'err');
    clearTimeout(t.current);
    t.current = setTimeout(() => setEstado('idle'), 2000);
  };
  return [estado, go];
}
const etiquetaCopiar = (e) => (e === 'ok' ? 'Copiado' : e === 'err' ? 'Cópialo a mano' : 'Copiar');

/* aparición al entrar en pantalla, como en la web */
function useAparecer() {
  useEffect(() => {
    const els = document.querySelectorAll('.dblock .block-head, .dblock .rv-in');
    els.forEach((el) => el.classList.add('rv'));
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ---------------------------------------------------------------- secciones */
function Hero() {
  /* la portada de la web, con sus mismas clases y medidas (apps/landing .hero) */
  return (
    <section id="inicio" className="hero" data-tone="cobalt" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-stage">
        <div className="hero-anchor dhero-eight"><Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8, el agente de Priv8" /></div>
        <h1 id="h-hero"><span className="line">La demo, de verdad.</span></h1>
        <p className="hero-sub">Cada caso, ejecutado entero con las apps y el núcleo reales, y grabado tal cual.</p>
        <div className="cta">
          <a className="btn btn-white" href="#empresas">Priv8 para empresas</a>
          <a className="btn btn-ghost" href="#movil">Priv8 en el móvil</a>
        </div>
      </div>
    </section>
  );
}

/* Una tarjeta de caso: la captura real arriba, el título, una línea y el botón. */
function Tarjeta({ c, onClick, activa, retrato }) {
  const cuerpo = (
    <>
      <span className={`ct-img${retrato ? ' retrato' : ''}`}><img src={c.img} alt="" loading="lazy" /></span>
      <span className="ct-txt">
        <b className="ct-t">{c.titulo}</b>
        <span className="ct-l">{c.linea}</span>
        {c.nota && <span className="ct-nota">{c.nota}</span>}
      </span>
      <span className="more ct-ver">{activa ? 'Viéndolo' : 'Ver el caso'}</span>
    </>
  );
  return (
    <li className="rv-in">
      {onClick
        ? <button type="button" className={`ct${activa ? ' activa' : ''}`} aria-pressed={activa} onClick={onClick}>{cuerpo}</button>
        : <a className="ct" href={c.href} target="_blank" rel="noopener">{cuerpo}</a>}
    </li>
  );
}

function Empresas() {
  return (
    <section id="empresas" className="dblock" data-tone="paper" aria-labelledby="h-empresas">
      <div className="wrap">
        <Head id="h-empresas" eyebrow="Priv8 para empresas" title="El ERP y el correo de siempre." soft="8 solo ve tokens."
          lead="Grabado en la consola real: las pantallas de Alba Core y del correo junto a lo que ve 8." />
        <ul className="cts">{EMPRESAS.map((c) => <Tarjeta key={c.id} c={c} />)}</ul>
      </div>
    </section>
  );
}

function Movil() {
  const [sel, setSel] = useState(MOVIL[0].id);
  const caso = MOVIL.find((c) => c.id === sel);
  const player = useRef(null);
  const elegir = (id) => {
    setSel(id);
    requestAnimationFrame(() => player.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <section id="movil" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-movil">
      <div className="wrap">
        <Head id="h-movil" eyebrow="Priv8 en el móvil" title="Tus bancos, por voz." soft="Sin ver las cuentas."
          lead="Grabado en el emulador. A un lado el móvil; al otro, lo que recibe el modelo en ese momento." />
        <ul className="cts cts-4">{MOVIL.map((c) => <Tarjeta key={c.id} c={c} retrato activa={c.id === sel} onClick={() => elegir(c.id)} />)}</ul>
        <div ref={player} className="mv-caja rv-in">
          <div className="mv-cab">
            <p className="mv-pedido">{caso.pedido}</p>
          </div>
          <Reproductor caso={caso} />
        </div>
      </div>
    </section>
  );
}

function Apps({ archivos }) {
  return (
    <section id="apps" className="dblock" data-tone="paper" aria-labelledby="h-apps">
      <div className="wrap">
        <Head id="h-apps" eyebrow="Para el emulador" title="Las cuatro apps." soft="Datos inventados."
          lead="Android 14. Instálalas y entra en cada banco con estos datos." />
        <ul className="apks-lista rv-in">
          {APKS.map((a) => {
            const t = size(archivos, a.file);
            const cuerpo = (
              <>
                <span className="apk-icono" style={a.color ? { background: a.color } : undefined}>
                  {a.ocho ? <Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8" /> : <b>{a.title.charAt(0)}</b>}
                </span>
                <b className="apk-nombre">{a.title}</b>
                {a.acceso
                  ? <span className="apk-acceso"><span>Usuario {a.acceso[0]}</span><span>Clave {a.acceso[1]}</span><span>SMS {a.acceso[2]}</span></span>
                  : <span className="apk-acceso"><span>{a.what}</span></span>}
                <span className={`apk-baja${t.ok ? '' : ' off'}`}>{t.ok ? `Descargar${t.label ? ` ${t.label}` : ''}` : 'No incluida'}</span>
              </>
            );
            return <li key={a.href}>{t.ok ? <a className="apk" href={a.href} download="">{cuerpo}</a> : <div className="apk is-off">{cuerpo}</div>}</li>;
          })}
        </ul>
        <details className="dinstalar rv-in">
          <summary>Instalarlas con adb</summary>
          <pre className="dcmd"><code>{INSTALAR}</code></pre>
        </details>
      </div>
    </section>
  );
}

function Paso({ n, title, text, cmd, mode }) {
  const [estado, go] = useCopiar(cmd);
  return (
    <li className="step step-row rv-in">
      <div className="step-top">
        <span className="step-n" aria-hidden="true">{n}</span>
        <Eight className="step-eight" mode={estado === 'ok' ? 'listo' : mode} fg="#2D45D6" cut="#F4F6FD" label="8" />
      </div>
      <div className="step-body">
        <h3>{title}</h3>
        <p className="step-text">{text}</p>
      </div>
      <div className="cmd">
        <code>{cmd.split('\n').map((l, i) => <span key={i} className="cmd-l"><span className="cmd-prompt" aria-hidden="true">$</span>{l}</span>)}</code>
        <button type="button" className={`copy copy-${estado}`} onClick={go} aria-label={`Copiar el paso ${n}`}>{etiquetaCopiar(estado)}</button>
        <span className="sr" role="status" aria-live="polite">{estado === 'ok' ? 'Copiado al portapapeles' : ''}</span>
      </div>
    </li>
  );
}

function Correlo() {
  return (
    <section id="correlo" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-correlo">
      <div className="wrap">
        <Head id="h-correlo" eyebrow="Córrelo en tu máquina" title="Cuatro órdenes." soft="Las mismas de la demo."
          lead="macOS o Linux, con uv y make. Para el móvil, Android Studio." />
        <ol className="pasos">{PASOS.map((p) => <Paso key={p.n} {...p} />)}</ol>
        <p className="more-row rv-in"><a className="more" href={README_URL} target="_blank" rel="noopener">Todo en el README</a></p>
      </div>
    </section>
  );
}

function Enlaces() {
  return (
    <section id="enlaces" className="dblock dblock-cobalt" data-tone="cobalt" aria-labelledby="h-enlaces">
      <div className="wrap">
        <Head id="h-enlaces" eyebrow="Enlaces" title="Lo demás," soft="aquí." />
        <ul className="enl rv-in">
          {ENLACES.map((l) => (
            <li key={l.title}>
              <a href={l.href} {...ext(l.href)}><b>{l.title}</b><span>{l.what}</span></a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="foot" data-tone="paper">
      <div className="wrap">
        <div className="foot-mid">
          <div className="foot-brand">
            <a className="foot-logo" href="#inicio" aria-label="Priv8, volver arriba">
              <Eight className="foot-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
              <span>Priv8</span>
            </a>
            <p>Privacidad para agentes de IA que usan pantallas. El modelo trabaja con tokens; los datos se quedan contigo.</p>
          </div>
          <nav className="foot-cols" aria-label="Pie">
            <div><b>Demo</b><a href="#empresas">Para empresas</a><a href="#movil">En el móvil</a><a href="#correlo">Córrelo tú</a></div>
            <div><b>Fuera</b><a href="https://priv8.es">priv8.es</a><a href={REPO} target="_blank" rel="noopener">GitHub</a></div>
          </nav>
        </div>
        <div className="foot-by-row">
          <a className="foot-by" href="https://laaabs.com" target="_blank" rel="noopener" aria-label="by laaabs" style={{ '--by': `url(${byLaaabs})` }} />
        </div>
        <div className="foot-word" aria-hidden="true">
          <div className="spot-foot"><Eight mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" /></div>
          <span>Priv8</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const archivos = useArchivos();
  useAparecer();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Blend from="--band" to="--paper" seed={1} overlay />
        <Empresas />
        <Blend from="--paper" to="--mist" seed={2} />
        <Movil />
        <Blend from="--mist" to="--paper" seed={3} />
        <Apps archivos={archivos} />
        <Blend from="--paper" to="--mist" seed={4} />
        <Correlo />
        <Blend from="--mist" to="--band" seed={5} />
        <Enlaces />
        <Blend from="--band" to="--paper" seed={6} />
      </main>
      <Footer />
    </>
  );
}
