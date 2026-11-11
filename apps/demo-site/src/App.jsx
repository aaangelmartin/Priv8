import { useEffect, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';
import Field, { Blend } from '@landing/Field.jsx';
import byLaaabs from './by-laaabs.svg';
import { VER, VIDEOS, LEER, APKS, INSTALAR, VIVO, EQUIPO } from './contenido.js';

const Tok = ({ children }) => <span className="tok">{children}</span>;
const SECCIONES = [['ver', 'Míralo'], ['leer', 'Léelo'], ['instalar', 'Instálalo'], ['vivo', 'En vivo'], ['equipo', 'Equipo']];

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
      <a className="brand" href="#inicio" aria-label="Priv8 demo, inicio">
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
function Ext({ href, ext, className, children, disabled }) {
  if (disabled) return <span className={className + ' is-off'} aria-disabled="true">{children}</span>;
  return <a className={className} href={href} {...(ext ? { target: '_blank', rel: 'noopener' } : {})}>{children}</a>;
}

function Card({ c, archivos }) {
  const s = size(archivos, c.file);
  return (
    <article className={'dcard' + (c.tone ? ' t-' + c.tone : '')}>
      <header className="dcard-top">
        <span className="dcard-kind">{c.kind}</span>
        <span className="dcard-time">{c.time}</span>
      </header>
      <h3>{c.title}</h3>
      <p>{c.what}</p>
      {c.sample && (
        <div className="dpair" aria-label={`El valor ${c.sample[0]} llega al modelo como ${c.sample[1]}`}>
          <span className="real">{c.sample[0]}</span><span className="arrow" aria-hidden="true" /><Tok>{c.sample[1]}</Tok>
        </div>
      )}
      {c.cmd && <pre className="dcmd"><code>{c.cmd}</code></pre>}
      {c.needs && <p className="dcard-needs">Necesita {c.needs}.</p>}
      <footer className="dcard-act">
        <Ext className="dbtn" href={c.href} ext={c.ext || /^https?:/.test(c.href)} disabled={!s.ok}>{c.cta || 'Ver en el README'}</Ext>
        {s.label && <span className={'dsize' + (s.ok ? '' : ' off')}>{s.label}</span>}
      </footer>
    </article>
  );
}

function Video({ v }) {
  return (
    <article className="dcard dvideo">
      <div className="dvideo-frame">
        <video controls preload="metadata" playsInline aria-label={`Vídeo: ${v.title}`}>
          {/* #t= pide el primer fotograma con contenido como portada, sin imagen aparte */}
          <source src={`${v.base}.webm#t=1`} type="video/webm" />
          <source src={`${v.base}.mp4#t=1`} type="video/mp4" />
        </video>
      </div>
      <header className="dcard-top">
        <span className="dcard-kind">Vídeo</span>
        <span className="dcard-time">{v.time}</span>
      </header>
      <h3>{v.title}</h3>
      <p>{v.what}</p>
    </article>
  );
}

function Head({ eyebrow, title, soft, lead }) {
  return (
    <div className="dhead">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title} <span className="soft">{soft}</span></h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- secciones */
function Hero() {
  return (
    <section id="inicio" className="dhero" data-tone="cobalt" aria-labelledby="h-hero">
      <Field />
      <div className="wrap dhero-in">
        <div className="dhero-eight"><Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8, el agente de Priv8" /></div>
        <p className="eyebrow">Hackathon de finanzas, Madrid Engineering Week</p>
        <h1 id="h-hero">Todo lo de la demo, <span className="soft">en un sitio.</span></h1>
        <p className="dhero-sub">Las reproducciones de la consola, los vídeos, los documentos y las apps del móvil. Todo estático, sin claves.</p>
        <div className="cta">
          <a className="btn btn-white" href="/consola/?feed=sin-protocolo">Empieza por la consola</a>
        </div>
        <nav className="dindex" aria-label="Secciones">
          {SECCIONES.map(([id, label], i) => <a key={id} href={`#${id}`}><b>{i + 1}</b>{label}</a>)}
        </nav>
      </div>
    </section>
  );
}

function Ver({ archivos }) {
  return (
    <section id="ver" className="dblock" data-tone="paper" aria-labelledby="h-ver">
      <div className="wrap">
        <Head eyebrow="Míralo" title="El mismo trámite," soft="con y sin Priv8."
          lead="La consola de auditoría real, con los mensajes grabados del núcleo." />
        <div className="dgrid g3">{VER.map((c) => <Card key={c.href} c={c} archivos={archivos} />)}</div>
        <div className="dgrid g2 dgap">{VIDEOS.map((v) => <Video key={v.base} v={v} />)}</div>
      </div>
    </section>
  );
}

function Leer({ archivos }) {
  return (
    <section id="leer" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-leer">
      <div className="wrap">
        <Head eyebrow="Léelo" title="Los entregables," soft="en el orden de las bases." />
        <div className="dgrid g4">{LEER.map((c) => <Card key={c.title} c={c} archivos={archivos} />)}</div>
      </div>
    </section>
  );
}

function Instalar({ archivos }) {
  return (
    <section id="instalar" className="dblock" data-tone="paper" aria-labelledby="h-instalar">
      <div className="wrap">
        <Head eyebrow="Instálalo" title="Las apps del móvil," soft="para el emulador."
          lead="Builds de depuración para un emulador de Android Studio. Los datos de acceso son inventados." />
        <div className="dgrid g4">
          {APKS.map((a) => {
            const s = size(archivos, a.file);
            return (
              <article key={a.pkg} className="dcard dapk">
                <header className="dcard-top"><span className="dcard-kind">APK</span><span className="dcard-time">1 min</span></header>
                <h3>{a.title}</h3>
                <p>{a.what}</p>
                <code className="dpkg">{a.pkg}</code>
                {a.login && (
                  <dl className="dlogin">
                    <div><dt>Usuario</dt><dd>{a.login[0]}</dd></div>
                    <div><dt>Clave</dt><dd>{a.login[1]}</dd></div>
                    <div><dt>Código SMS</dt><dd>{a.login[2]}</dd></div>
                  </dl>
                )}
                <footer className="dcard-act">
                  <Ext className="dbtn" href={a.href} disabled={!s.ok}>Descargar</Ext>
                  {s.label && <span className={'dsize' + (s.ok ? '' : ' off')}>{s.label}</span>}
                </footer>
              </article>
            );
          })}
        </div>
        <div className="dsplit">
          <div>
            <h3>Instalar y activar a 8</h3>
            <p>Con el emulador en marcha y las cuatro APK en la carpeta actual. Para que 8 maneje los bancos hace falta además el núcleo en el portátil: es la demo B2C en vivo.</p>
          </div>
          <pre className="dcmd big"><code>{INSTALAR}</code></pre>
        </div>
      </div>
    </section>
  );
}

function Vivo() {
  return (
    <section id="vivo" className="dblock dblock-cobalt" data-tone="cobalt" aria-labelledby="h-vivo">
      <div className="wrap">
        <Head eyebrow="En vivo" title="Con el agente de verdad," soft="en tu máquina."
          lead="Usan Claude con una clave de API, así que no hay un agente alojado aquí: corren en el Mac de quien presenta, o en el tuyo." />
        <div className="dgrid g4">{VIVO.map((c) => <Card key={c.title} c={c} />)}</div>
      </div>
    </section>
  );
}

function Equipo() {
  return (
    <section id="equipo" className="dblock" data-tone="paper" aria-labelledby="h-equipo">
      <div className="wrap">
        <Head eyebrow="Equipo" title="Cuatro personas," soft="cuatro caminos." />
        <ul className="dteam">
          {EQUIPO.map((p) => (
            <li key={p.user}>
              <span className="dinit" aria-hidden="true">{p.name.split(' ').map((w) => w[0]).join('')}</span>
              <div><b>{p.name}</b><span>{p.role}</span><a href={`https://github.com/${p.user}`} target="_blank" rel="noopener">@{p.user}</a></div>
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
        </div>
        <div className="foot-word" aria-hidden="true">
          <Eight className="foot-word-eight" mode="mirar" fg="#2D45D6" cut="#FFFFFF" label="8" />
          <span>Priv8</span>
        </div>
        <div className="foot-by-row">
          <a className="foot-by" href="https://laaabs.com" target="_blank" rel="noopener" aria-label="by laaabs" style={{ '--by': `url(${byLaaabs})` }} />
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
        <Ver archivos={archivos} />
        <Blend from="--paper" to="--mist" seed={2} />
        <Leer archivos={archivos} />
        <Blend from="--mist" to="--paper" seed={4} />
        <Instalar archivos={archivos} />
        <Blend from="--paper" to="--band" seed={3} />
        <Vivo />
        <Blend from="--band" to="--paper" seed={5} />
        <Equipo />
      </main>
      <Footer />
    </>
  );
}
