import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';
import Field, { Blend } from '@landing/Field.jsx';
import byLaaabs from '@landing/by-laaabs.svg';
import { CASOS, VERTICALES, PASOS, MAS, APKS, INSTALAR, ENLACES, EQUIPO, REPO } from './contenido.js';

const SECCIONES = [['casos', 'Casos'], ['correlo', 'Córrelo tú'], ['enlaces', 'Enlaces'], ['equipo', 'Equipo']];
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
        <p className="hero-sub">La consola de verdad con cada caso grabado dentro, y cómo correrlo en tu máquina.</p>
        <div className="cta">
          <a className="btn btn-white" href="#casos">Ver los casos</a>
          <a className="btn btn-ghost" href="#correlo">Córrelo tú</a>
        </div>
      </div>
    </section>
  );
}

/* La consola real dentro de la página, reproduciendo un caso. Se pinta a su tamaño de escritorio y se escala al
   ancho que haya: así se ve igual que en el portátil de la demo. */
function Consola({ caso }) {
  const ref = useRef(null);
  const [w, setW] = useState(1200);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const medir = () => setW(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [bw, bh] = w < 1000 ? [1280, 860] : [1440, 900];
  const k = w / bw;
  return (
    <div className="dconsola" ref={ref} style={{ height: Math.round(bh * k) }}>
      <iframe key={caso.id} src={caso.href} title={`Consola de Priv8: ${caso.titulo}`} loading="lazy"
        style={{ width: bw, height: bh, transform: `scale(${k})` }} />
    </div>
  );
}

function Casos() {
  const [vertical, setVertical] = useState('b2b');
  const lista = CASOS.filter((c) => c.vertical === vertical);
  const [id, setId] = useState(lista[0].id);
  const caso = CASOS.find((c) => c.id === id) ?? lista[0];
  const elegirVertical = (v) => { setVertical(v); setId(CASOS.find((c) => c.vertical === v).id); };
  return (
    <section id="casos" className="dblock" data-tone="paper" aria-labelledby="h-casos">
      <div className="wrap">
        <Head eyebrow="Casos grabados" title="La consola," soft="con todo dentro."
          lead="La consola de verdad, reproduciendo sesiones grabadas: lo que ves tú junto a lo que ve el modelo, el razonamiento de 8, sus confirmaciones y sus alarmas. Elige un caso." />
        <div className="dcasos">
          <div className="dverticales" role="tablist" aria-label="Vertical">
            {VERTICALES.map((v) => (
              <button key={v.id} type="button" role="tab" aria-selected={vertical === v.id} onClick={() => elegirVertical(v.id)}>
                <span className="dv-tag">{v.id.toUpperCase()}</span>
                <span className="dv-txt"><b>{v.title}</b><span>{v.what}</span></span>
              </button>
            ))}
          </div>
          <div className="dchips" role="tablist" aria-label="Casos">
            {lista.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={c.id === caso.id} className="dchip" onClick={() => setId(c.id)}>{c.titulo}</button>
            ))}
          </div>
          <div className="dcaso-info" key={caso.id}>
            {caso.pedido && <p className="dpedido"><span>Lo que pide la persona</span><b>«{caso.pedido}»</b></p>}
            <p className="dque">{caso.que}</p>
            <a className="dlink dabrir" href={caso.href} target="_blank" rel="noopener">Abrir a pantalla completa</a>
          </div>
          <Consola caso={caso} />
          <p className="dnota-consola">Abajo, reproducir y pausar, velocidad y la barra para saltar a cualquier momento. Las pestañas Alarmas, Pantalla y Registro siguen la grabación. Datos ficticios de la demo.</p>
        </div>
      </div>
    </section>
  );
}

function Correlo({ archivos }) {
  return (
    <section id="correlo" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-correlo">
      <div className="wrap">
        <Head eyebrow="Córrelo en tu máquina" title="Todo esto," soft="en tu portátil."
          lead="El mismo código, el mismo núcleo y las mismas apps. Sin clave ya funciona con respuestas grabadas; con la tuya, 8 piensa en vivo." />
        <ol className="dpasos">
          {PASOS.map((p) => (
            <li key={p.n} className="dpaso">
              <span className="dpaso-n" aria-hidden="true">{p.n}</span>
              <h3>{p.title}</h3>
              <p>{p.what}</p>
              <pre className="dcmd"><code>{p.cmd}</code></pre>
              <a className="dlink" href={p.link.href} target="_blank" rel="noopener">{p.link.label}</a>
            </li>
          ))}
        </ol>
        <div className="dmas">
          <ul className="dmas-links">
            {MAS.map((l) => (
              <li key={l.title}>
                <a className="dl-row" href={l.href} target="_blank" rel="noopener">
                  <span className="dl-tag">{l.tag}</span>
                  <span className="dl-txt"><b>{l.title}</b><span>{l.what}</span></span>
                  <Flecha out />
                </a>
              </li>
            ))}
          </ul>
          <div className="dapks">
            <h3>Las apps para el emulador</h3>
            <p>Android Studio, un emulador de Android 14 y estas cuatro APK. Usuarios y claves inventados.</p>
            <ul className="drows">
              {APKS.map((a) => {
                const t = size(archivos, a.file);
                return <Row key={a.href} {...a} download off={!t.ok} label={t.ok ? (t.label ? `Descargar, ${t.label}` : 'Descargar') : t.label} />;
              })}
            </ul>
            <details className="dinstalar">
              <summary>Instalarlas a mano con adb</summary>
              <pre className="dcmd"><code>{INSTALAR}</code></pre>
            </details>
          </div>
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
            <div><b>Demo</b><a href="#casos">Casos</a><a href="#correlo">Córrelo tú</a><a href="#enlaces">Enlaces</a></div>
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
        <Casos />
        <Blend from="--paper" to="--mist" seed={2} />
        <Correlo archivos={archivos} />
        <Enlaces />
        <Blend from="--mist" to="--band" seed={3} />
        <Equipo archivos={archivos} />
        <Blend from="--band" to="--paper" seed={5} />
      </main>
      <Footer />
    </>
  );
}
