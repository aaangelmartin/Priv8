// Lo que ve 8, en grande (#154).
//
//   Web: la vista de 8 que manda el adaptador (frame con vista '8'): una página espejo con
//        la pestaña de 8 censurada en el DOM. Se pinta tal cual, sin nada encima: los tokens,
//        «nunca sale», los marcadores, el cursor de 8 y su bocadillo ya están en la página.
//   Android: la pantalla otra vez, con lo que vio el modelo de cada elemento en su sitio.
//   Sin fotogramas (reproducciones, sin núcleo): el esquema de Vivo.jsx.
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

// Decodifica el último fotograma y lo pinta en un lienzo: sin parpadeos entre uno y otro.
function Lienzo({ frame, width, height }) {
  const canvas = useRef(null)
  const turno = useRef(0)
  const ultimo = useRef(null)
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
    if (!frame?.img) return
    const n = ++turno.current
    const im = new Image()
    im.src = `data:${frame.mime || 'image/jpeg'};base64,${frame.img}`
    im.decode().then(() => { if (n === turno.current) { ultimo.current = im; pintar(im) } }).catch(() => {})
  }, [frame?.img]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { pintar(ultimo.current) }, [width, height]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} className="vista-lienzo" style={{ width, height }} role="img" aria-label="Lo que ve 8: la pantalla con los datos cambiados por tokens" />
}

function chipDe(frame) {
  if (frame.paused) return { tono: 'aviso', texto: '8 mira a otro lado' }
  if (!frame.fresh) return { tono: 'neutro', texto: 'Aún sin leer' }
  return { tono: 'cobalto', texto: 'Censurado en el DOM' }
}

export function VistaWeb({ frame, cabecera = true }) {
  const stage = useRef(null)
  const t = useTamano(stage)
  const { width, height } = encaja(frame.w, frame.h, t.w, t.h - (cabecera ? CABECERA : 0))
  const chip = chipDe(frame)
  return (
    <div className="escenario vista-escenario" ref={stage}>
      {width > 0 && (
        <div className="ventana vista-ventana" style={{ width }} aria-label={`Lo que ve 8: ${nombreApp(frame.app)} ${nombrePantalla(frame.screen)}`}>
          {cabecera && (
            <div className="ventana-cab">
              <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
              <b className="ventana-app">{nombreApp(frame.app)}</b>
              {frame.screen && <span className="ventana-pantalla">{nombrePantalla(frame.screen)}</span>}
              <span className="sp" />
              <span className={`vista-chip t-${chip.tono}`}>{chip.texto}</span>
            </div>
          )}
          <Lienzo frame={frame} width={width} height={height} />
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

// La pantalla de 8 que toca según lo que haya llegado.
export function PantallaViva({ frame, rep, demo, sin }) {
  if (!demo && esVista8(frame)) return <VistaWeb frame={frame} />
  if (!demo && rep?.pantalla && esMovil(rep.pantalla) && cajasMovil(rep.pantalla)) return <MovilDe8 screen={rep.pantalla} />
  return <PantallaDe8 rep={rep} modo="ocho" sin={sin} />
}
