// Lo que ve 8, en grande (#154).
//
//   Web: la vista de 8 que manda el adaptador (frame con vista '8'): una página espejo con
//        la pestaña de 8 censurada en el DOM. Se pinta tal cual, sin nada encima: los tokens,
//        «nunca sale», los marcadores, el cursor de 8 y su bocadillo ya están en la página.
//   Android: la pantalla otra vez, con lo que vio el modelo de cada elemento en su sitio.
//   Sin fotogramas (reproducciones, sin núcleo): el esquema de Vivo.jsx.
//   Sesión grabada (?feed=sesion-b2b, #170): los mismos fotogramas, desde sus JPEG, y además
//        la ventana real que manejó 8 (PantallaReal).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Eight from './eight/Eight.jsx'
import { Tokens } from './piezas.jsx'
import { nombreApp, nombrePantalla } from './directo.js'
import { cajasMovil, encaja, esVista8 } from './frame.js'
import { esMovil } from './vivo.js'
import { PantallaDe8 } from './Vivo.jsx'

const COBALTO = '#2D45D6'
const CABECERA = 40

// Tamaño disponible de un elemento, al día.
function useTamano(ref) {
  const [t, setT] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => setT({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return t
}

const srcDe = (f) => (f.src ? `${import.meta.env.BASE_URL}${f.src}` : `data:${f.mime || 'image/jpeg'};base64,${f.img}`)
const decodificar = (f) => { const im = new Image(); im.src = srcDe(f); return im.decode().then(() => im) }

// Las dos imágenes de un par (#187), decodificadas juntas: las dos pantallas cambian en el mismo
// momento, nunca una antes que la otra. Hasta que el par nuevo está listo, siguen las del anterior;
// si uno tarda más que el siguiente, gana el más nuevo.
function useParListo(frame, real) {
  const [listo, setListo] = useState(null)
  const turno = useRef(0)
  const pintado = useRef(0)
  const activo = esVista8(frame) && !!real && (!!real.img || !!real.src)
  useEffect(() => {
    if (!activo) return
    const n = ++turno.current
    Promise.all([decodificar(frame), decodificar(real)])
      .then(([imOcho, imReal]) => { if (n > pintado.current) { pintado.current = n; setListo({ frame, real, imOcho, imReal }) } })
      .catch(() => {})
  }, [activo, frame, real]) // eslint-disable-line react-hooks/exhaustive-deps
  return activo ? listo : null
}

// Decodifica el último fotograma y lo pinta en un lienzo: sin parpadeos entre uno y otro. Con
// `imagen` (ya decodificada, la de un par), pinta esa y no decodifica nada.
function Lienzo({ frame, imagen = null, width, height, etiqueta = 'Lo que ve 8: la pantalla con los datos cambiados por tokens' }) {
  const canvas = useRef(null)
  const turno = useRef(0)
  const ultimo = useRef(null)
  const pintado = useRef(0)
  const pintar = (im) => {
    const c = canvas.current
    if (!c || !im || !width) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.round(width * dpr)
    const H = Math.round(height * dpr)
    if (c.width !== W) c.width = W
    if (c.height !== H) c.height = H
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(im, 0, 0, W, H)
  }
  useEffect(() => {
    if (!imagen) return
    ultimo.current = imagen
    pintar(imagen)
  }, [imagen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (imagen || (!frame?.img && !frame?.src)) return
    const n = ++turno.current
    const im = new Image()
    im.src = frame.src ? `${import.meta.env.BASE_URL}${frame.src}` : `data:${frame.mime || 'image/jpeg'};base64,${frame.img}`
    // Gana el más nuevo ya decodificado: si uno tarda (un JPEG que aún baja), no se queda en blanco.
    im.decode().then(() => { if (n > pintado.current) { pintado.current = n; ultimo.current = im; pintar(im) } }).catch(() => {})
  }, [frame?.img, frame?.src, imagen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { pintar(ultimo.current) }, [width, height]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} className="vista-lienzo" style={{ width, height }} role="img" aria-label={etiqueta} />
}

function chipDe(frame) {
  if (frame.paused) return { tono: 'aviso', texto: '8 mira a otro lado' }
  if (!frame.fresh) return { tono: 'neutro', texto: 'Aún sin leer' }
  return { tono: 'cobalto', texto: 'Censurado en el DOM' }
}

export function VistaWeb({ frame, imagen = null, cabecera = true, real = false, rotulo = null, nota = 'Pantalla real', chip: conChip = true }) {
  const stage = useRef(null)
  const t = useTamano(stage)
  const { width, height } = encaja(frame.w, frame.h, t.w, t.h - (cabecera ? CABECERA : 0))
  const chip = real ? { tono: 'aviso', texto: nota } : chipDe(frame)
  return (
    <div className="escenario vista-escenario" ref={stage}>
      {width > 0 && (
        <div className="ventana vista-ventana" style={{ width }} aria-label={`Lo que ve 8: ${nombreApp(frame.app)} ${nombrePantalla(frame.screen)}`}>
          {cabecera && (
            <div className="ventana-cab">
              {rotulo
                ? <span className={`rotulo ${real ? 'r-real' : 'r-ocho'}`}>{rotulo}</span>
                : <span className="puntos" aria-hidden="true"><i /><i /><i /></span>}
              <b className="ventana-app">{nombreApp(frame.app)}</b>
              {frame.screen && <span className="ventana-pantalla">{nombrePantalla(frame.screen)}</span>}
              <span className="sp" />
              {conChip && <span className={`vista-chip t-${chip.tono}`}>{chip.texto}</span>}
            </div>
          )}
          <Lienzo frame={frame} imagen={imagen} width={width} height={height}
            etiqueta={real ? 'La ventana real que maneja 8, con los datos ficticios de la demo' : undefined} />
        </div>
      )}
    </div>
  )
}

// Android: cada elemento observado, en su sitio, con lo que leyó el modelo.
export function MovilDe8({ screen }) {
  const stage = useRef(null)
  const t = useTamano(stage)
  const m = cajasMovil(screen)
  const obs = screen?.observed
  if (!m) return <div className="escenario" ref={stage} />
  const BISEL = 10
  const { width, height } = encaja(m.w, m.h, t.w - BISEL * 2, t.h - BISEL * 2 - 24)
  const k = width / m.w
  return (
    <div className="escenario movil-escenario" ref={stage}>
      {width > 0 && (
        <>
          <div className="movil-real" style={{ width: width + BISEL * 2 }} aria-label={`Lo que ve 8 en el móvil: ${nombreApp(obs.app)} ${nombrePantalla(obs.screen)}`}>
            <div className="movil-lienzo" style={{ width, height }}>
              {m.cajas.map((c) => {
                const alto = c.h * k
                const fs = Math.max(8, Math.min(15, alto * 0.42))
                const estilo = { left: c.x * k, top: c.y * k, width: c.w * k, height: alto, fontSize: fs }
                if (c.contenedor) return <span key={c.id} className="mv zona" style={estilo} />
                const texto = c.texto ?? (c.role === 'button' ? c.label : null)
                return (
                  <span key={c.id} className={`mv r-${c.role} c-${c.cls}`} style={estilo}>
                    {c.cls === 'rojo' ? <em>nunca sale</em> : texto ? <Tokens text={texto} /> : null}
                  </span>
                )
              })}
              {obs.paused && (
                <div className="movil-velo">
                  <Eight className="real-velo-eight" mode="apartar" fg={COBALTO} cut="#EEF2FB" label="8" />
                  <b>8 mira a otro lado</b>
                </div>
              )}
            </div>
          </div>
          <span className="movil-leyenda">Lo que ve 8: la pantalla otra vez, solo con lo que leyó el modelo</span>
        </>
      )}
    </div>
  )
}

// Lo que ves tú y lo que ve el modelo, juntas (#170): la pestaña real que maneja 8 (con sus
// valores, su cursor y sus bocadillos) y la vista de 8 censurada en el DOM. Lado a lado si hay
// sitio a lo ancho; una encima de otra si el hueco es más alto que ancho (pantallas estrechas).
// La real solo llega por el canal local (o, en la web de la demo, de una sesión grabada con
// datos ficticios).
export function DosPantallas({ frame, real, nota, rep, valores }) {
  const caja = useRef(null)
  const t = useTamano(caja)
  const fila = t.w >= t.h * 1.1
  const pantalla = rep?.pantalla
  const movil = !!pantalla && esMovil(pantalla)
  const pausa = !!pantalla?.observed?.paused
  // Web (#187): las dos del mismo par, decodificadas juntas; mientras llega el siguiente, las del
  // anterior en las dos.
  const enPar = esVista8(frame) && !!real
  const par = useParListo(frame, real)
  const esperaTu = <div className="escenario real-espera"><p>Lo que ves tú aparece en cuanto 8 empieza a trabajar.</p></div>
  const esperaOcho = <div className="escenario real-espera"><p>Lo que ve el modelo aparece con la primera pantalla.</p></div>
  // Sin fotogramas (Android sin captura, una reproducción provisional): las dos pantallas en
  // esquema, la de la persona con los valores y la del modelo con los tokens (#187).
  const izquierda = enPar
    ? (par ? <VistaWeb frame={{ ...par.real, vista: 'real' }} imagen={par.imReal} real nota={nota} chip={false} /> : esperaTu)
    : real
    ? <VistaWeb frame={{ ...real, vista: 'real' }} real nota={nota} chip={false} />
    : pantalla
      ? <PantallaDe8 rep={rep} modo="tu" valores={valores} />
      : esperaTu
  const derecha = enPar
    ? (par ? <VistaWeb frame={par.frame} imagen={par.imOcho} chip={false} /> : esperaOcho)
    : esVista8(frame)
    ? <VistaWeb frame={frame} chip={false} />
    : pantalla
      ? (movil && real && cajasMovil(pantalla) ? <MovilDe8 screen={pantalla} /> : <PantallaDe8 rep={rep} modo="ocho" valores={valores} />)
      : esperaOcho
  return (
    <div className="dos-miradas">
      <h3 className="miradas-titulo">La misma pantalla, <span>dos miradas</span></h3>
      <div className={`dos-pantallas ${fila ? 'en-fila' : 'en-columna'} ${movil ? 'de-movil' : ''}`} ref={caja}>
        <section className="mirada m-tu" aria-label="Lo que ves tú: datos reales">
          <Mirada tipo="tu" nota={nota} />
          <div className="mirada-pantalla">{izquierda}</div>
        </section>
        <section className="mirada m-ocho" aria-label="Lo que ve el modelo: solo tokens">
          <Mirada tipo="ocho" />
          <div className="mirada-pantalla">
            {derecha}
            {pausa && !esVista8(frame) && (
              <div className="velo-lado" role="status">
                <Eight className="velo-lado-eight" mode="apartar" fg={COBALTO} cut="#FFFFFF" label="8 mira a otro lado" />
                <b>8 mira a otro lado</b>
                <span>Mientras pones la clave o el código, no lee la pantalla.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// La cabecera de cada mirada (#187): quién mira y qué le llega. Tú, con los datos reales; el
// modelo, con la cara de 8 de «tokenizado» (los ojos en dos asteriscos) y solo tokens.
function Mirada({ tipo, nota }) {
  if (tipo === 'tu') {
    return (
      <header className="mirada-cab t-tu">
        <span className="mirada-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="currentColor" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" /></svg>
        </span>
        <span className="mirada-txt"><b>Lo que ves tú</b><span>Datos reales</span></span>
        {nota && <span className="mirada-nota">{nota}</span>}
      </header>
    )
  }
  return (
    <header className="mirada-cab t-ocho">
      <span className="mirada-ico" aria-hidden="true"><Eight mode="nove" fg="#FFFFFF" cut={COBALTO} label="8 con los datos tapados" /></span>
      <span className="mirada-txt"><b>Lo que ve el modelo</b><span>Solo tokens</span></span>
    </header>
  )
}

// La pantalla de 8 que toca según lo que haya llegado.
export function PantallaViva({ frame, rep, demo, sin }) {
  if (!demo && esVista8(frame)) return <VistaWeb frame={frame} />
  if (!demo && rep?.pantalla && esMovil(rep.pantalla) && cajasMovil(rep.pantalla)) return <MovilDe8 screen={rep.pantalla} />
  return <PantallaDe8 rep={rep} modo="ocho" sin={sin} />
}
