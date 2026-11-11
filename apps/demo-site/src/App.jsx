import { useEffect, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';
import Field, { Blend } from '@landing/Field.jsx';
import byLaaabs from '@landing/by-laaabs.svg';
import Icono from '../../console/src/iconos.jsx';
import { CASOS, VERTICALES, PASOS, MAS, APKS, INSTALAR, ENLACES, REPO } from './contenido.js';

const SECCIONES = [['casos', 'Casos'], ['correlo', 'Córrelo tú'], ['enlaces', 'Enlaces']];
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

/* ---------------------------------------------------------------- secciones */
function Hero() {
  /* la portada de la web, con sus mismas clases y medidas (apps/landing .hero): mismo alto, márgenes, titular y 8 */
  return (
    <section id="inicio" className="hero" data-tone="cobalt" aria-labelledby="h-hero">
      <Field />
      <div className="wrap hero-stage">
        <div className="hero-anchor dhero-eight"><Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8, el agente de Priv8" /></div>
        <h1 id="h-hero"><span className="line">Toda la demo.</span></h1>
        <p className="hero-sub">Cada caso, grabado en la consola real. Y cómo correrlo en tu máquina.</p>
        <div className="cta">
          <a className="btn btn-white" href="#casos">Ver los casos</a>
          <a className="btn btn-ghost" href="#correlo">Córrelo tú</a>
        </div>
      </div>
    </section>
  );
}

/* El dato de cada caso: el valor real tachado, la flecha y el token que recibe el modelo; o el valor en rojo si le
   llega tal cual, o «nunca sale». */
function Dato({ d }) {
  if (!d) return <span className="cdato"><span className="cdato-nada"><Icono n="rechazado" />El modelo no recibe nada</span></span>;
  if (d.claro) return <span className="cdato"><span className="cdato-claro">{d.real}</span><i className="cdato-flecha mala" aria-hidden="true" /><span className="cdato-al">al modelo</span></span>;
  if (d.nunca) return <span className="cdato"><span className="cdato-real">{d.real}</span><i className="cdato-flecha" aria-hidden="true" /><span className="cdato-nunca">nunca sale</span></span>;
  return <span className="cdato"><span className="cdato-real">{d.real}</span><i className="cdato-flecha" aria-hidden="true" /><span className="tok">{d.tok}</span></span>;
}

/* Un caso: arriba la escena (lo que pides en un bocadillo, la cara de 8 y el camino que recorre), abajo el título,
   el dato y cómo acaba. Toda la tarjeta abre la consola reproduciéndolo, en otra pestaña. */
function Caso({ c }) {
  const v = c.visual;
  const [encima, setEncima] = useState(false);
  return (
    <li>
      <a className={`caso${c.id.includes('sin-protocolo') ? ' es-sin' : ''}`} href={c.href} target="_blank" rel="noopener" title={c.que}
        onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)} onFocus={() => setEncima(true)} onBlur={() => setEncima(false)}>
        <div className="caso-escena" aria-hidden="true">
          <div className="caso-pide">
            {c.pedido
              ? <p className="caso-bocadillo">{c.pedido}</p>
              : <p className="caso-bocadillo sin"><Icono n="real" />Sin Priv8 CUA</p>}
          </div>
          <div className="caso-ocho"><Eight mode={encima ? 'alegria' : v.cara} fg="#FFFFFF" cut="#2D45D6" label="8" /></div>
          <ol className="caso-camino">
            {v.camino.map((ico, i) => <li key={i} className={`n-${ico}`}><Icono n={ico} /></li>)}
            {v.fin && <li className={`caso-fin t-${v.fin.tono}`}><Icono n={v.fin.ico} /></li>}
          </ol>
        </div>
        <div className="caso-pie">
          <h4>{c.titulo}</h4>
          <Dato d={v.dato} />
          <div className="caso-acaba">
            {v.fin && <span className={`caso-chip t-${v.fin.tono}`}>{v.fin.txt}</span>}
            <span className="caso-abrir">Ver en la consola<Icono n="sale" /></span>
          </div>
        </div>
      </a>
    </li>
  );
}

/* Casos grabados: dos columnas, B2B y B2C; cada caso abre la consola real reproduciéndolo, en otra pestaña. */
function Casos() {
  return (
    <section id="casos" className="dblock" data-tone="paper" aria-labelledby="h-casos">
      <div className="wrap">
        <Head eyebrow="Casos grabados" title="Elige un caso." soft="Míralo en la consola." />
        <div className="casos">
          {VERTICALES.map((v) => (
            <div key={v.id} className={`casos-col v-${v.id}`}>
              <h3 className="casos-cab">
                <span className="casos-ico"><Icono n={v.ico} /></span>
                <span><b>{v.title}</b><span>{v.what}</span></span>
                <span className="casos-tag">{v.id.toUpperCase()}</span>
              </h3>
              <ul>{CASOS.filter((c) => c.vertical === v.id).map((c) => <Caso key={c.id} c={c} />)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Correlo({ archivos }) {
  return (
    <section id="correlo" className="dblock dblock-mist" data-tone="paper" aria-labelledby="h-correlo">
      <div className="wrap">
        <Head eyebrow="Córrelo en tu máquina" title="Cuatro pasos," soft="en tu portátil." />
        <ol className="flujo">
          {PASOS.map((p) => (
            <li key={p.n} className="flujo-paso">
              <span className="flujo-ico" aria-hidden="true"><Icono n={p.ico} /><b>{p.n}</b></span>
              <h3>{p.title}</h3>
              <pre className="dcmd"><code>{p.cmd}</code></pre>
              <a className="dlink" href={p.link.href} target="_blank" rel="noopener">{p.link.label}<Icono n="sale" /></a>
            </li>
          ))}
        </ol>
        <ul className="mas">
          {MAS.map((l) => (
            <li key={l.title}>
              <a className="mas-tile" href={l.href} target="_blank" rel="noopener" title={l.what}>
                <span className="mas-ico"><Icono n={l.ico} /></span>
                <span className="mas-txt"><b>{l.title}</b><span>{l.tag}</span></span>
                <Icono n="sale" className="ico mas-sale" />
              </a>
            </li>
          ))}
        </ul>
        <div className="apks">
          <div className="apks-cab">
            <span className="mas-ico"><Icono n="movil" /></span>
            <h3>Las apps para el emulador <span>Android 14, datos inventados</span></h3>
          </div>
          <ul className="apks-lista">
            {APKS.map((a) => {
              const t = size(archivos, a.file);
              const cuerpo = (
                <>
                  <span className="apk-icono" style={a.color ? { background: a.color } : undefined}>
                    {a.ocho ? <Eight mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8" /> : <b>{a.title.charAt(0)}</b>}
                  </span>
                  <b className="apk-nombre">{a.title}</b>
                  {a.acceso
                    ? <span className="apk-acceso"><span title="Usuario"><Icono n="persona" />{a.acceso[0]}</span><span title="Clave"><Icono n="llave" />{a.acceso[1]}</span><span title="Código SMS"><Icono n="movil" />{a.acceso[2]}</span></span>
                    : <span className="apk-acceso"><span>{a.what}</span></span>}
                  <span className={`apk-baja${t.ok ? '' : ' off'}`}><Icono n="descarga" />{t.ok ? (t.label ?? 'APK') : 'No incluida'}</span>
                </>
              );
              return <li key={a.href}>{t.ok ? <a className="apk" href={a.href} download="">{cuerpo}</a> : <div className="apk is-off">{cuerpo}</div>}</li>;
            })}
          </ul>
          <details className="dinstalar">
            <summary>Instalarlas a mano con adb</summary>
            <pre className="dcmd"><code>{INSTALAR}</code></pre>
          </details>
        </div>
      </div>
    </section>
  );
}

function Enlaces() {
  return (
    <section id="enlaces" className="dblock dblock-cobalt" data-tone="cobalt" aria-labelledby="h-enlaces">
      <div className="wrap">
        <Head eyebrow="Enlaces" title="Todo," soft="a un clic." />
        <div className="tiles-grupos">
          {ENLACES.map((g) => (
            <div key={g.group} className="tiles-grupo">
              <h3>{g.group}</h3>
              <ul className="tiles">
                {g.items.map((l) => {
                  const out = !!l.href && /^https?:/.test(l.href);
                  const body = (
                    <>
                      <span className="tile-ico"><Icono n={l.ico} /></span>
                      <span className="tile-tag">{l.tag}</span>
                      <b className="tile-t">{l.title}</b>
                      {l.href ? <Icono n={out ? 'sale' : 'flecha'} className="ico tile-flecha" /> : <span className="tile-pronto">Próximamente</span>}
                    </>
                  );
                  return (
                    <li key={l.title}>
                      {l.href
                        ? <a className="tile" href={l.href} title={l.what} {...ext(l.href)}>{body}</a>
                        : <div className="tile is-off" title={l.what}>{body}</div>}
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
        <Blend from="--mist" to="--band" seed={3} />
        <Enlaces />
        <Blend from="--band" to="--paper" seed={5} />
      </main>
      <Footer />
    </>
  );
}
