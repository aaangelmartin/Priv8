// La pantalla de 8 en directo: la pantalla en la que está 8, su cursor moviéndose por ella
// y su razonamiento paso a paso. Todo sale de los mensajes que ya recibe la consola
// (pantallas con valores reales, solo en local, y eventos de auditoría con tokens).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Eight from './eight/Eight.jsx'
import { EnClaro, Md, Real, Tokens } from './piezas.jsx'
import { nombreApp, nombrePantalla } from './directo.js'
import { duracion, esMovil, focoDe, lineaDe, piensaTras, textoPlano } from './vivo.js'

const COBALTO = '#2D45D6'
const BLANCO = '#FFFFFF'
const MAX_LINEAS = 140

// ---------------------------------------------------------------- reproducción

// Recorre la secuencia de mensajes con su ritmo: cada paso se queda lo justo para verse
// (el cursor llega, pulsa, teclea) y, si llegan muchos de golpe, se acelera para no quedarse atrás.
export function useReproduccion(linea, valores) {
  const [st, setSt] = useState({ pantalla: null, foco: null, lineas: [], pensando: false, escrito: {}, cambio: 0, leyendo: 0, inicio: null, terminado: false })
  const c = useRef({ next: 1, busy: false, timer: null, foco: null, pantalla: null, clave: null, inicio: null, terminado: false })
  const lineaRef = useRef(linea)
  lineaRef.current = linea
  const valRef = useRef(valores)
  valRef.current = valores

  const aplicar = useCallback((item) => {
    const r = c.current
    if (item.k === 'screen') {
      const m = item.m
      const clave = `${m.observed?.app ?? m.raw?.app}|${m.observed?.screen ?? m.raw?.screen}`
      const otra = clave !== r.clave
      r.pantalla = m
      r.clave = clave
      // En la misma pantalla se queda el foco (sigue esperando o mirando lo mismo).
      if (otra) r.foco = null
      setSt((s) => ({ ...s, pantalla: m, escrito: {}, foco: r.foco, cambio: otra ? s.cambio + 1 : s.cambio }))
      return
    }
    const ev = item.ev
    const ln = lineaDe(ev, r.pantalla)
    if (ln?.tipo === 'encargo') { r.inicio = ev._rx ?? Date.now(); r.terminado = false }
    if (ln?.tipo === 'fin' || ln?.tipo === 'dice') r.terminado = true
    const foco = focoDe(ev, r.pantalla, r.foco)
    r.foco = foco ? { ...foco, n: item.n } : null
    setSt((s) => {
      const lineas = ln ? [...s.lineas, { ...ln, n: item.n, rx: ev._rx ?? Date.now(), t: r.inicio != null ? Math.max(0, (ev._rx ?? Date.now()) - r.inicio) : null }].slice(-MAX_LINEAS) : s.lineas
      const escrito = r.foco?.gesto === 'type' && r.foco.texto ? { ...s.escrito, [r.foco.id]: { texto: r.foco.texto, n: item.n } } : s.escrito
      return {
        ...s, lineas, escrito, foco: r.foco,
        pensando: !r.terminado && piensaTras(ev),
        leyendo: ev.kind === 'observe_sent' ? item.n : s.leyendo,
        inicio: r.inicio, terminado: r.terminado,
      }
    })
  }, [])

  const paso = useCallback(() => {
    const r = c.current
    const items = lineaRef.current
    const i = items.findIndex((x) => x.n >= r.next)
    if (i < 0) { r.busy = false; return }
    let k = i
    // Muy atrasada (un salto en la reproducción grabada, #187): lo viejo se aplica de golpe, sin animar.
    while (items.length - 1 - k > 10) { aplicar(items[k]); k += 1 }
    const item = items[k]
    r.next = item.n + 1
    r.busy = true
    aplicar(item)
    const atraso = items.length - 1 - k
    const d = duracion(item, valRef.current)
    r.timer = setTimeout(paso, atraso > 10 ? 30 : atraso > 4 ? d / 2.5 : d)
  }, [aplicar])

  useEffect(() => { if (!c.current.busy) paso() }, [linea, paso])
  useEffect(() => () => clearTimeout(c.current.timer), [])
  return st
}

// ---------------------------------------------------------------- tecleo

// Las letras van apareciendo; al terminar se pinta como cualquier valor (con su token si toca).
function Tecleo({ texto, n, modo, valores }) {
  const plano = textoPlano(texto, valores, modo === 'tu')
  const [i, setI] = useState(0)
  useEffect(() => {
    setI(0)
    const paso = Math.max(1, Math.ceil(plano.length / 32))
    const id = setInterval(() => setI((v) => { if (v + paso >= plano.length) { clearInterval(id); return plano.length } return v + paso }), 30)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])
  if (i >= plano.length) {
    return modo === 'tu' ? <mark className="dato escrito">{plano}</mark> : <Tokens text={texto} valores={valores} />
  }
  return <span className="tecleando">{plano.slice(0, i)}<i className="caret" aria-hidden="true" /></span>
}

// ---------------------------------------------------------------- elementos

function Contenido({ el, r, modo, valores, sin, escrito }) {
  if (escrito) return <Tecleo texto={escrito.texto} n={escrito.n} modo={modo} valores={valores} />
  if (modo === 'tu') {
    if (r.text === '' || (r.text == null && el.text === '')) return <span className="vacio-campo">vacío</span>
    return <Real real={r.text} observado={el.text} />
  }
  if (sin) return el.text === '' ? <span className="vacio-campo">vacío</span> : <EnClaro text={el.text} valores={el.claro} />
  if (el.text == null) return <span className="nunca">nunca sale</span>
  if (el.text === '') return <span className="vacio-campo">vacío</span>
  return <Tokens text={el.text} valores={valores} />
}

function Etiqueta({ el, r, modo, valores }) {
  if (!el.label) return null
  return modo === 'tu' ? <Real real={r.label ?? el.label} observado={el.label} /> : <Tokens text={el.label} valores={valores} />
}

const ROL_DATO = new Set(['text', 'cell', 'listitem', 'row', 'option', 'other', 'image', 'list'])

function Elemento({ el, r, modo, valores, sin, escrito, marca }) {
  const props = { el, r, modo, valores, sin, escrito }
  const cls = `el el-${el.role} c-${el.cls ?? 'verde'} ${marca ? `marcado m-${marca}` : ''}`
  const rojo = el.cls === 'rojo' && modo === 'ocho' && !sin
  switch (el.role) {
    case 'heading':
      return <h3 className={cls} data-el={el.id}><Contenido {...props} /></h3>
    case 'textbox':
    case 'select':
      return (
        <div className={cls} data-el={el.id}>
          <span className="el-etiqueta"><Etiqueta {...props} />{rojo && <em className="nunca-chip">nunca sale</em>}</span>
          <span className="el-campo"><Contenido {...props} /></span>
        </div>
      )
    case 'button':
    case 'tab':
    case 'menuitem':
      return <span className={cls} data-el={el.id}>{el.label && !el.text ? <Etiqueta {...props} /> : <Contenido {...props} />}</span>
    case 'link':
      return <span className={cls} data-el={el.id}><Contenido {...props} /></span>
    case 'checkbox':
    case 'radio':
    case 'switch':
      return <span className={cls} data-el={el.id}><i className="marca-caja" aria-hidden="true" /><Etiqueta {...props} /> <Contenido {...props} /></span>
    default:
      if (!ROL_DATO.has(el.role) && !el.label) return <p className={cls} data-el={el.id}><Contenido {...props} /></p>
      if (!el.label) return <p className={`${cls} el-parrafo`} data-el={el.id}><Contenido {...props} /></p>
      return (
        <div className={`${cls} el-dato`} data-el={el.id}>
          <span className="el-etiqueta"><Etiqueta {...props} />{rojo && <em className="nunca-chip">nunca sale</em>}</span>
          <span className="el-valor"><Contenido {...props} /></span>
        </div>
      )
  }
}

// ---------------------------------------------------------------- pantalla de 8

const ruta = (url) => { try { return new URL(url).pathname } catch { return null } }
const MIRADA = { type: [-0.55, 0.6, -6], bloqueo: [-0.4, 0.5, 0], espera: [-0.4, 0.55, 0] }
const CARA = { type: 'hablar', bloqueo: 'enfado', espera: 'esperar', ok: 'asentir', oraculo: 'pensar' }

export function PantallaDe8({ rep, modo, valores, sin }) {
  const { pantalla, foco, escrito, cambio, leyendo, pensando } = rep
  const obs = pantalla?.observed
  const movil = esMovil(pantalla)
  const scrollRef = useRef(null)
  const contRef = useRef(null)
  const [caja, setCaja] = useState(null)
  const reales = new Map((pantalla?.raw?.elements ?? []).map((e) => [e.id, e]))

  const medir = useCallback((desplazar) => {
    const cont = contRef.current
    const sc = scrollRef.current
    if (!cont || !sc) return
    const el = foco?.id ? cont.querySelector(`[data-el="${CSS.escape(foco.id)}"]`) : null
    if (!el) { setCaja((c) => (c ? { ...c, visible: false } : c)); return }
    const a = el.getBoundingClientRect()
    const b = cont.getBoundingClientRect()
    const pad = 7
    setCaja({ top: a.top - b.top - pad, left: a.left - b.left - pad, width: a.width + pad * 2, height: a.height + pad * 2, visible: true })
    if (desplazar) {
      const top = a.top - b.top
      if (top < sc.scrollTop + 10 || top + a.height > sc.scrollTop + sc.clientHeight - 30) {
        sc.scrollTo({ top: Math.max(0, top - sc.clientHeight * 0.3), behavior: 'smooth' })
      }
    }
  }, [foco])

  useLayoutEffect(() => { medir(true) }, [medir, cambio, modo, pantalla])
  useEffect(() => {
    const cont = contRef.current
    if (!cont || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir(false))
    ro.observe(cont)
    return () => ro.disconnect()
  }, [medir])

  const nombre = obs ? nombreApp(obs.app) : 'Sin pantalla'
  const sub = obs ? nombrePantalla(obs.screen) : ''
  const path = ruta(pantalla?.raw?.url)
  const els = obs?.elements ?? []

  const cuerpo = (
    <div className="ventana-cuerpo" ref={scrollRef}>
      <div className="ventana-cont" ref={contRef}>
        <div className="ventana-els" key={cambio}>
          {!obs && (
            <div className="vacio-ventana">
              <Eight className="vacio-eight" mode={pensando ? 'pensar' : 'mirar'} fg={COBALTO} cut={BLANCO} label="8" />
              <p>En cuanto 8 abra una pantalla, la verás aquí con su cursor.</p>
            </div>
          )}
          {obs?.paused && <p className="pausa-ventana">8 mira a otro lado: {obs.paused}</p>}
          {els.filter((el) => !(el.role === 'other' && el.text == null && !el.label && el.cls !== 'rojo')).map((el) => (
            <Elemento key={el.id} el={el} r={reales.get(el.id) ?? {}} modo={modo} valores={valores} sin={sin}
              escrito={escrito[el.id]} marca={foco?.id === el.id ? foco.gesto : null} />
          ))}
        </div>
        {leyendo > 0 && <span key={leyendo} className="barrido" aria-hidden="true" />}
        <div
          className={`foco ${caja?.visible ? 'visible' : ''} t-${foco?.tono ?? 'cobalto'} g-${foco?.gesto ?? 'mira'}`}
          style={caja ? { transform: `translate(${caja.left}px, ${caja.top}px)`, width: caja.width, height: caja.height } : undefined}
          aria-hidden="true"
        >
          {foco && ['tap', 'call', 'ok'].includes(foco.gesto) && <span key={foco.n} className="onda" />}
          <span className="cursor8">
            <Eight mode={CARA[foco?.gesto] ?? (pensando ? 'pensar' : 'mirar')} look={MIRADA[foco?.gesto] ?? [-0.5, 0.45, 0]} fg={BLANCO} cut={COBALTO} label="cursor de 8" />
          </span>
          {foco?.aviso && <span key={`a${foco.n}`} className="aviso-foco">{foco.aviso}</span>}
        </div>
      </div>
    </div>
  )

  if (movil) {
    return (
      <div className="escenario movil-escenario">
        <div className="movil" aria-label={`Móvil: ${nombre} ${sub}`}>
          <div className="movil-estado"><span>9:41</span><span className="isla" /><span>5G</span></div>
          <div className="movil-app"><b>{nombre}</b><span>{sub}</span></div>
          {cuerpo}
          <div className="movil-barra"><i /></div>
        </div>
      </div>
    )
  }
  return (
    <div className="escenario">
      <div className="ventana" aria-label={`Pantalla de 8: ${nombre} ${sub}`}>
        <div className="ventana-cab">
          <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
          <b className="ventana-app">{nombre}</b>
          {sub && <span className="ventana-pantalla">{sub}</span>}
          <span className="sp" />
          {path && <code className="ventana-url">{path}</code>}
        </div>
        {cuerpo}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- razonamiento

const mmssMs = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

// El texto del modelo aparece palabra a palabra (solo la línea más nueva).
function Aparece({ texto, valores, mostrar, vivo, alCrecer }) {
  const partes = String(texto).split(/(\s+)/)
  const [k, setK] = useState(vivo ? 0 : partes.length)
  useEffect(() => {
    if (!vivo) return
    const id = setInterval(() => setK((v) => { if (v >= partes.length) { clearInterval(id); return v } return v + 2 }), 45)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { if (vivo) alCrecer?.() }, [k, vivo, alCrecer])
  return <Tokens text={partes.slice(0, k).join('')} valores={valores} mostrar={mostrar} />
}

// Lo que ve 8: los tokens tal cual, sin el valor local ni siquiera al pasar por encima.
export function Razonamiento({ rep }) {
  const { lineas, pensando } = rep
  const valores = undefined
  const modo = 'ocho'
  const ref = useRef(null)
  const pegado = useRef(true)
  const arriba = useRef(0)
  const bajar = useCallback((suave = true) => {
    const el = ref.current
    if (el && pegado.current) el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'auto' })
  }, [])
  const crecer = useCallback(() => bajar(false), [bajar])
  useEffect(() => { bajar() }, [lineas.length, pensando, bajar])
  const mostrar = modo === 'tu' ? 'real' : 'token'
  const ultimo = lineas[lineas.length - 1]?.n

  return (
    <section className="razon" aria-label="Lo que piensa y hace 8">
      <header className="razon-cab">
        <span>Razonamiento y acciones</span>
        <span className="sp" />
        <span className="razon-n">{lineas.length ? `${lineas.length} pasos` : ''}</span>
      </header>
      <ol className="razon-lista" ref={ref} aria-live="polite"
        onScroll={(e) => {
          // Solo deja de seguir el final si la persona sube; vuelve a seguirlo al llegar abajo.
          const el = e.currentTarget
          if (el.scrollTop < arriba.current - 4) pegado.current = false
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) pegado.current = true
          arriba.current = el.scrollTop
        }}>
        {lineas.length === 0 && <li className="ln vacia">Aquí verás cada paso de 8: lo que lee, lo que decide, dónde pulsa y qué escribe.</li>}
        {lineas.map((l) => {
          const largo = l.tipo === 'encargo'
          return (
            <li key={l.n} className={`ln t-${l.tono} k-${l.tipo}`}>
              <span className="ln-t">{l.t != null ? mmssMs(l.t) : ''}</span>
              <i className="ln-p" aria-hidden="true" />
              <div className="ln-c">
                <b>{l.titulo}</b>
                {l.texto && (largo
                  ? <p className="ln-dice"><Aparece texto={l.texto} valores={valores} mostrar={mostrar} vivo={l.n === ultimo} alCrecer={crecer} /></p>
                  : l.tipo === 'piensa'
                    ? <Md texto={l.texto} className="ln-x ln-md" />
                    : <p className="ln-x"><Tokens text={l.texto} valores={valores} mostrar={mostrar} /></p>)}
                {l.sub && <span className="ln-s">{l.sub}</span>}
              </div>
            </li>
          )
        })}
        {pensando && (
          <li className="ln pensando" key="pensando">
            <span className="ln-t" />
            <i className="ln-p" aria-hidden="true" />
            <div className="ln-c"><b>pensando<span className="puntitos"><i /><i /><i /></span></b></div>
          </li>
        )}
      </ol>
    </section>
  )
}
