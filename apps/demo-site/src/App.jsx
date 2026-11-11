import { useEffect, useRef, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';
import Field, { Blend } from '@landing/Field.jsx';
import byLaaabs from '@landing/by-laaabs.svg';
import { EMPRESAS, MOVIL, PASOS_EMPRESAS, APKS, INSTALAR, ENLACES, REPO, README_URL } from './contenido.js';

const SECCIONES = [['casos', 'Los casos'], ['correlo', 'Córrelo tú'], ['enlaces', 'Enlaces']];
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
function Head({ id, title, soft, lead }) {
  return (
    <div className="block-head">
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

/* Una tarjeta de caso: la captura real a un lado, el título, una línea y el botón. */
function Tarjeta({ c, onClick, activa, retrato }) {
  const cuerpo = (
    <>
      <span className={`ct-img${retrato ? ' retrato' : ''}`}><img src={c.img} alt="" loading="lazy" /></span>
      <span className="ct-txt">
        <b className="ct-t">{c.titulo}</b>
        <span className="ct-l">{c.linea}</span>
        {c.nota && <span className="ct-nota">{c.nota}</span>}
        <span className="more ct-ver">{activa ? 'Viéndolo' : 'Ver el caso'}</span>
      </span>
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

/* Cabecera de cada columna: el nombre de la vertical en Sora, con su segunda línea suave. */
function ColHead({ id, title, soft, lead }) {
  return (
    <div className="col-head rv-in">
      <h3 id={id}>{title} <span className="soft">{soft}</span></h3>
      {lead && <p className="col-lead">{lead}</p>}
    </div>
  );
}

/* Solo los casos del móvil que tienen grabación real en esta build (public/movil/<caso>.json). */
function useGrabados() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    Promise.all(MOVIL.map((c) => fetch(c.datos, { method: 'HEAD' }).then((r) => r.ok && (r.headers.get('content-type') || '').includes('json'), () => false)))
      .then((v) => setOk(MOVIL.filter((_, i) => v[i])));
  }, []);
  return ok;
}

function ColEmpresas() {
  return (
    <div id="empresas" className="col" aria-labelledby="h-empresas">
      <ColHead id="h-empresas" title="Priv8 para empresas." soft="El ERP y el correo de siempre."
        lead="Grabado en la consola real: las pantallas de Alba Core y del correo junto a lo que ve 8." />
      <ul className="cts">{EMPRESAS.map((c) => <Tarjeta key={c.id} c={c} />)}</ul>
    </div>
  );
}

function ColMovil() {
  const grabados = useGrabados();
  const hay = grabados && grabados.length > 0;
  return (
    <div id="movil" className="col" aria-labelledby="h-movil">
      <ColHead id="h-movil" title="Priv8 en el móvil." soft="Tus bancos, por voz."
        lead="Grabado en el emulador: el móvil junto a lo que recibe el modelo en cada momento." />
      {hay && <ul className="cts">{grabados.map((c) => <Tarjeta key={c.id} c={c} />)}</ul>}
      {grabados && !hay && <p className="col-lead">Esta build no trae grabaciones del móvil.</p>}
    </div>
  );
}

function Casos() {
  return (
    <section id="casos" className="dblock" data-tone="paper" aria-labelledby="h-casos">
      <div className="wrap">
        <Head id="h-casos" title="Dos verticales." soft="El mismo núcleo."
          lead="Procesos de empresa sobre un ERP antiguo y tus bancos en el móvil, con las mismas piezas del protocolo." />
        <div className="duo">
          <ColEmpresas />
          <ColMovil />
        </div>
      </div>
    </section>
  );
}

function Cmd({ cmd, label }) {
  const [estado, go] = useCopiar(cmd);
  return (
    <div className="cmd">
      <code>{cmd.split('\n').map((l, i) => <span key={i} className="cmd-l"><span className="cmd-prompt" aria-hidden="true">$</span>{l}</span>)}</code>
      <button type="button" className={`copy copy-${estado}`} onClick={go} aria-label={`Copiar: ${label}`}>{etiquetaCopiar(estado)}</button>
      <span className="sr" role="status" aria-live="polite">{estado === 'ok' ? 'Copiado al portapapeles' : ''}</span>
    </div>
  );
}

function Paso({ n, title, text, cmd, children }) {
  return (
    <li className="paso">
      <span className="paso-n" aria-hidden="true">{n}</span>
      <div className="paso-body">
        <h4>{title}</h4>
        <p>{text}</p>
        {children}
        {cmd && <Cmd cmd={cmd} label={title} />}
      </div>
    </li>
  );
}

function Apk({ a, archivos }) {
  const t = size(archivos, a.file);
  const cuerpo = (
    <>
      <span className="apk-cab">
        <span className="apk-icono" style={a.color ? { background: a.color } : undefined}>
          {a.ocho ? <Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8" /> : <b>{a.title.charAt(0)}</b>}
        </span>
        <b className="apk-nombre">{a.title}</b>
      </span>
      {a.acceso
        ? <span className="apk-acceso"><span>Usuario <b>{a.acceso[0]}</b></span><span>Clave <b>{a.acceso[1]}</b></span><span>SMS <b>{a.acceso[2]}</b></span></span>
        : <span className="apk-acceso"><span>{a.what}</span></span>}
      <span className={`apk-baja${t.ok ? '' : ' off'}`}>{t.ok ? `Descargar${t.label ? ` ${t.label}` : ''}` : 'No incluida'}</span>
    </>
  );
  return <li>{t.ok ? <a className="apk" href={a.href} download="">{cuerpo}</a> : <div className="apk is-off">{cuerpo}</div>}</li>;
}

function Correlo({ archivos }) {
  return (
    <section id="correlo" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-correlo">
      <div className="wrap">
        <Head id="h-correlo" title="Córrelo tú." soft="Lo mismo que has visto."
          lead="Datos inventados. Para empresas, macOS o Linux con uv y make; para el móvil, el emulador de Android Studio." />
        <div className="duo duo-run">
          <div className="col col-card rv-in" aria-labelledby="h-run-empresas">
            <ColHead id="h-run-empresas" title="Para empresas." soft="En tu máquina." />
            <ol className="pasos">{PASOS_EMPRESAS.map((p) => <Paso key={p.n} {...p} />)}</ol>
            <p className="col-more"><a className="more" href={README_URL} target="_blank" rel="noopener">Todo en el README</a></p>
          </div>
          <div className="col col-card rv-in" aria-labelledby="h-run-movil">
            <ColHead id="h-run-movil" title="En el móvil." soft="Las cuatro apps." />
            <ol className="pasos">
              <Paso n={1} title="Descárgalas" text="La app de 8 y los tres bancos, con su usuario, su clave y su código SMS.">
                <ul className="apks-lista">{APKS.map((a) => <Apk key={a.href} a={a} archivos={archivos} />)}</ul>
              </Paso>
              <Paso n={2} title="Instálalas con adb" text="En un AVD de Android 14. La última orden activa el servicio de accesibilidad de 8." cmd={INSTALAR} />
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function Enlaces() {
  return (
    <section id="enlaces" className="dblock dblock-cobalt" data-tone="cobalt" aria-labelledby="h-enlaces">
      <div className="wrap">
        <Head id="h-enlaces" title="Lo demás." soft="A un clic." />
        <div className="enl rv-in">
          {ENLACES.map((g) => (
            <div key={g.grupo} className="enl-g">
              <h3 className="enl-h">{g.grupo}</h3>
              <ul>
                {g.items.map((l) => (
                  <li key={l.title}><a href={l.href} {...ext(l.href)}><b>{l.title}</b><span>{l.note}</span></a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
        <Casos />
        <Blend from="--paper" to="--mist" seed={2} />
        <Correlo archivos={archivos} />
        <Blend from="--mist" to="--band" seed={3} />
        <Enlaces />
        <Blend from="--band" to="--paper" seed={4} />
      </main>
      <Footer />
    </>
  );
}
