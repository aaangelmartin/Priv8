import { useEffect, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';
import Field, { Blend } from '@landing/Field.jsx';
import byLaaabs from '@landing/by-laaabs.svg';
import { VIDEO_B2C, VIDEOS_B2B, CONSOLA_B2B, APKS, INSTALAR, ENLACES, EQUIPO, REPO } from './contenido.js';

const SECCIONES = [['videos', 'Vídeos'], ['prueba', 'Pruébalo tú'], ['enlaces', 'Enlaces'], ['equipo', 'Equipo']];
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
function Head({ eyebrow, title, soft, lead }) {
  return (
    <div className="dhead">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title} <span className="soft">{soft}</span></h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

function Video({ title, time, what, base }) {
  return (
    <figure className="dvid">
      <div className="dvideo-frame">
        {/* #t= pide un fotograma con contenido como portada, sin imagen aparte */}
        <video controls preload="metadata" playsInline aria-label={`Vídeo: ${title}`}>
          <source src={`${base}.webm#t=1`} type="video/webm" />
          <source src={`${base}.mp4#t=1`} type="video/mp4" />
        </video>
      </div>
      <figcaption><b>{title}</b><span>{what}</span><i>{time}</i></figcaption>
    </figure>
  );
}

/* Una fila: título, una línea y una sola acción (toda la fila es el enlace). */
function Row({ title, what, href, label, download, off }) {
  if (off) return <li className="drow is-off"><div><b>{title}</b><span>{label}</span></div></li>;
  return (
    <li>
      <a className="drow" href={href} {...(download ? { download: '' } : ext(href))}>
        <div><b>{title}</b><span>{what}</span></div>
        <em>{label}</em>
      </a>
    </li>
  );
}

/* ---------------------------------------------------------------- secciones */
function Hero() {
  /* la portada de la web, con sus mismas clases y medidas (apps/landing .hero): mismo alto, márgenes, titular y 8 */
  return (
    <section id="inicio" className="hero" data-tone="cobalt" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-stage">
        <div className="hero-anchor dhero-eight"><Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8, el agente de Priv8" /></div>
        <h1 id="h-hero"><span className="line">Toda la demo.</span></h1>
        <p className="hero-sub">Los vídeos, las pantallas para probarlo y los enlaces del proyecto.</p>
        <div className="cta">
          <a className="btn btn-white" href="#videos">Ver los vídeos</a>
        </div>
      </div>
    </section>
  );
}

function Videos() {
  return (
    <section id="videos" className="dblock" data-tone="paper" aria-labelledby="h-videos">
      <div className="wrap">
        <Head eyebrow="Vídeos" title="La demo," soft="en dos minutos." />
        <div className="prod-grid">
          <article className="prod">
            <p className="eyebrow">B2B</p>
            <h3>Priv8 para empresas</h3>
            <p>La factura de un proveedor, registrada en el ERP sin que el modelo vea los datos.</p>
            <div className="dvids">{VIDEOS_B2B.map((v) => <Video key={v.base} {...v} />)}</div>
          </article>
          <article className="prod">
            <p className="eyebrow">B2C</p>
            <h3>8 en tu móvil</h3>
            <p>«¿Cuánto tengo entre mis bancos?» y «Pasa 200 € al bróker», por voz.</p>
            {VIDEO_B2C
              ? <div className="dvids"><Video title="Vídeo B2C" time="" what="8 en el emulador." base={VIDEO_B2C} /></div>
              : <div className="dslot" role="note"><b>Vídeo B2C</b><span>Pendiente de grabar.</span></div>}
          </article>
        </div>
      </div>
    </section>
  );
}

function Prueba({ archivos }) {
  return (
    <section id="prueba" className="dblock" data-tone="paper" aria-labelledby="h-prueba">
      <div className="wrap">
        <Head eyebrow="Pruébalo tú" title="Las mismas pantallas," soft="para usarlas a mano." />
        <div className="prod-grid">
          <article className="prod">
            <p className="eyebrow">B2B</p>
            <h3>Priv8 para empresas</h3>
            <p>Una sesión real de 8, grabada y reproducida en la consola: lo que ves tú junto a lo que ve el modelo, el razonamiento, el chat y la confirmación.</p>
            <div className="dcta"><a className="btn btn-cobalt" href={CONSOLA_B2B.href}>Abrir la consola</a></div>
          </article>
          <article className="prod">
            <p className="eyebrow">B2C</p>
            <h3>8 en tu móvil</h3>
            <p>Las cuatro apps para un emulador de Android Studio. Usuarios y claves inventados.</p>
            <ul className="drows">
              {APKS.map((a) => {
                const s = size(archivos, a.file);
                return <Row key={a.href} {...a} download off={!s.ok} label={s.ok ? (s.label ? `Descargar, ${s.label}` : 'Descargar') : s.label} />;
              })}
            </ul>
            <pre className="dcmd"><code>{INSTALAR}</code></pre>
          </article>
        </div>
      </div>
    </section>
  );
}

const Flecha = ({ out }) => (
  <svg className="dl-arrow" viewBox="0 0 24 24" aria-hidden="true">
    <path d={out ? 'M8 16 16 8M9 8h7v7' : 'M5 12h13M13 6l6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Enlaces() {
  return (
    <section id="enlaces" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-enlaces">
      <div className="wrap">
        <Head eyebrow="Enlaces" title="Todo," soft="en una lista." />
        <div className="dlinks">
          {ENLACES.map((g) => (
            <div key={g.group} className="dl-group">
              <h3>{g.group}</h3>
              <ul>
                {g.items.map((l) => {
                  const out = !!l.href && /^https?:/.test(l.href);
                  const body = (<><span className="dl-tag">{l.tag}</span><span className="dl-txt"><b>{l.title}</b><span>{l.what}</span></span></>);
                  return (
                    <li key={l.title}>
                      {l.href
                        ? <a className="dl-row" href={l.href} {...ext(l.href)}>{body}<Flecha out={out} /></a>
                        : <div className="dl-row is-off">{body}<span className="dl-soon">Próximamente</span></div>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Equipo({ archivos }) {
  return (
    <section id="equipo" className="dblock dblock-cobalt" data-tone="cobalt" aria-labelledby="h-equipo">
      <div className="wrap">
        <Head eyebrow="Equipo" title="Cuatro personas," soft="cuatro caminos." />
        <ul className="dteam">
          {EQUIPO.map((p) => {
            const foto = archivos && archivos[`equipo/${p.user}.png`];
            return (
              <li key={p.user}>
                {foto
                  ? <img className="dface" src={`/equipo/${p.user}.png`} alt="" width="56" height="56" />
                  : <span className="dface dinit" aria-hidden="true">{p.name.split(' ').map((w) => w[0]).join('')}</span>}
                <div><b>{p.name}</b><span>{p.role}</span><a href={`https://github.com/${p.user}`} target="_blank" rel="noopener">@{p.user}</a></div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* El pie de la web, igual: logo y frase, columnas, la firma de laaabs y el nombre grande con 8. */
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
            <div><b>Demo</b><a href="#videos">Vídeos</a><a href="#prueba">Pruébalo tú</a><a href="#enlaces">Enlaces</a></div>
            <div><b>Más</b><a href="#equipo">Equipo</a></div>
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
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Blend from="--band" to="--paper" seed={1} overlay />
        <Videos />
        <Prueba archivos={archivos} />
        <Blend from="--paper" to="--mist" seed={2} />
        <Enlaces />
        <Blend from="--mist" to="--band" seed={3} />
        <Equipo archivos={archivos} />
        <Blend from="--band" to="--paper" seed={5} />
      </main>
      <Footer />
    </>
  );
}
