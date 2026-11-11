// La pantalla real de 8 en directo (#147): los píxeles de la pestaña o del móvil que maneja 8,
// tal como llegan del núcleo (mensaje frame, solo local).
//
//   Lo que ves:  el fotograma tal cual, con el cursor de 8 que ya pinta la página.
//   Lo que ve 8: el mismo fotograma, velado; lo verde con texto se ve nítido, cada caja ámbar
//                queda tapada por lo que leyó el modelo (sus tokens) y cada roja por «nunca sale».
//                Si 8 aún no ha leído la pantalla, o mira a otro lado, se vela entera.
//
// Encima van el foco de vivo.js (el anillo y el aviso de bloqueo o espera) y la última línea
// del razonamiento.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Eight from './eight/Eight.jsx'
import { Tokens } from './piezas.jsx'
import { nombreApp, nombrePantalla } from './directo.js'
import { cajaDe, capas, encaja, enPorcentaje, esMovilFrame, recorte, tapa, velo } from './frame.js'

const COBALTO = '#2D45D6'
const BLANCO = '#FFFFFF'
const VELO = { pausa: '8 mira a otro lado', sin_leer: '8 aún no ha leído esta pantalla' }
const VELO_SUB = {
  pausa: 'Aquí escribes tú: la clave, el código o la confirmación no llegan al modelo.',
  sin_leer: 'Hasta que la lea, al modelo no le llega nada de ella.',
}
const PAUSA = { autenticacion: 'autenticación', dialogo_sistema: 'diálogo del sistema', confirmacion: 'confirmación de 8' }
const CABECERA = 40 // alto de la barra de la ventana (px)
const BISEL = 10 // marco del móvil (px)
const LEYENDA = 30 // la línea bajo el móvil (px)

// Decodifica el último fotograma; si llega otro mientras tanto, gana el último.
function useImagen(frame) {
  const [img, setImg] = useState(null)
  const turno = useRef(0)
  useEffect(() => {
    if (!frame?.img) return
    const n = ++turno.current
    const im = new Image()
    im.src = `data:${frame.mime || 'image/jpeg'};base64,${frame.img}`
    im.decode().then(() => { if (n === turno.current) setImg(im) }).catch(() => {})
  }, [frame?.img, frame?.mime])
  return img
}

// c: la parte del fotograma que se enseña (recorte), en el espacio de las cajas.
function dibujar(canvas, img, frame, c, modo, size) {
  if (!canvas || !img || !size.width) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = Math.round(size.width * dpr)
  const H = Math.round(size.height * dpr)
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const kx = img.naturalWidth / frame.w // px de la imagen por px de las cajas
  const ky = img.naturalHeight / frame.h
  const todo = () => ctx.drawImage(img, c.x * kx, c.y * ky, c.w * kx, c.h * ky, 0, 0, W, H)
  if (modo !== 'ocho') { todo(); return }
  // Lo que ve 8: todo velado, y nítido solo lo verde que el modelo lee.
  ctx.save()
  ctx.filter = `blur(${Math.max(3, Math.round(4 * dpr))}px)`
  todo()
  ctx.restore()
  ctx.fillStyle = 'rgba(238, 242, 251, .7)'
  ctx.fillRect(0, 0, W, H)
  if (velo(frame)) return
  const dx = W / c.w
  const dy = H / c.h
  for (const r of capas(frame).nitidos) {
    ctx.drawImage(img, r.x * kx, r.y * ky, r.w * kx, r.h * ky, (r.x - c.x) * dx, (r.y - c.y) * dy, r.w * dx, r.h * dy)
  }
}

// La tapa de una caja ámbar o roja, con el tamaño de letra de la caja.
function Tapa({ r, c, k, valores, escrito }) {
  // Mientras 8 escribe en el campo, la tapa ya lleva lo que escribe (sus tokens).
  const t = escrito && r.cls !== 'rojo' ? { tipo: 'token', texto: escrito } : tapa(r)
  const alto = r.h * k
  const fs = Math.max(8.5, Math.min(13, alto * 0.5))
  const varias = alto > fs * 2.6
  return (
    <span
      className={`tapa t-${t.tipo} ${varias ? 'varias' : ''}`}
      style={{ ...enPorcentaje(r, c), fontSize: `${fs}px`, borderRadius: Math.min(8, alto / 3) }}
      title={t.tipo === 'nunca' ? 'Nunca sale: 8 no lo lee' : 'Lo que lee 8'}
    >
      {t.tipo === 'nunca' ? <em>nunca sale</em>
        : t.texto ? <span className="tapa-txt"><Tokens text={t.texto} valores={valores} /></span>
          : <span className="tapa-vacio">vacío</span>}
    </span>
  )
}

const MIRADA = { type: [-0.55, 0.6, -6], bloqueo: [-0.4, 0.5, 0], espera: [-0.4, 0.55, 0] }
const CARA = { type: 'hablar', bloqueo: 'enfado', espera: 'esperar', ok: 'asentir', oraculo: 'pensar' }
// En web la página ya pinta el cursor de 8; encima solo van los avisos que no están en la página.
const SOLO_AVISO = new Set(['bloqueo', 'espera', 'oraculo', 'ok'])

export function PantallaReal({ frame, rep, modo, valores }) {
  const movil = esMovilFrame(frame)
  const stage = useRef(null)
  const canvas = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const img = useImagen(frame)
  // En web se enseña lo que ocupan los elementos (Alba Core es una ventana pequeña en un
  // escritorio vacío); mientras 8 no lee la pantalla nueva se queda el recorte anterior de la app.
  const ultimo = useRef({})
  let c = { x: 0, y: 0, w: frame.w, h: frame.h }
  if (!movil) {
    const nuevo = frame.rects.length ? recorte(frame) : null
    if (nuevo) ultimo.current[frame.app] = nuevo
    c = nuevo ?? ultimo.current[frame.app] ?? c
    if (c.x + c.w > frame.w || c.y + c.h > frame.h) c = { x: 0, y: 0, w: frame.w, h: frame.h }
  }

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const medir = () => {
      const w = el.clientWidth - (movil ? BISEL * 2 : 0)
      const h = el.clientHeight - (movil ? BISEL * 2 + LEYENDA : CABECERA)
      setSize(encaja(c.w, c.h, w, h))
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [c.w, c.h, movil])

  useEffect(() => { dibujar(canvas.current, img, frame, c, modo, size) }, [img, frame, c.x, c.y, c.w, c.h, modo, size]) // eslint-disable-line react-hooks/exhaustive-deps

  const k = size.width / c.w
  const v = modo === 'ocho' ? velo(frame) : null
  const { tapados } = capas(frame)
  const foco = rep?.foco
  const caja = cajaDe(frame, foco?.id)
  const verFoco = caja && (movil || SOLO_AVISO.has(foco.gesto))
  const ultima = rep?.lineas?.[rep.lineas.length - 1]
  const ambar = frame.rects.filter((r) => r.cls === 'ambar').length
  const rojo = frame.rects.filter((r) => r.cls === 'rojo').length

  const lienzo = (
    <div className="real-lienzo" style={{ width: size.width, height: size.height }}>
      <canvas ref={canvas} className="real-canvas" style={{ width: size.width, height: size.height }} aria-hidden="true" />
      {modo === 'ocho' && !v && tapados.map((r) => <Tapa key={r.id} r={r} c={c} k={k} valores={valores} escrito={rep?.escrito?.[r.id]?.texto} />)}
      {v && (
        <div className="real-velo" role="status">
          <Eight className="real-velo-eight" mode={v === 'pausa' ? 'apartar' : 'pensar'} fg={COBALTO} cut="#EEF2FB" label="8" />
          <b>{VELO[v]}</b>
          <span>{v === 'pausa' && frame.paused ? `En pausa por ${PAUSA[frame.paused] ?? frame.paused}. ` : ''}{VELO_SUB[v]}</span>
        </div>
      )}
      {verFoco && (
        <div
          className={`real-foco t-${foco.tono ?? 'cobalto'} g-${foco.gesto} ${(caja.y - c.y + caja.h) * k > size.height * 0.62 ? 'arriba' : ''}`}
          style={{ left: (caja.x - c.x) * k - 5, top: (caja.y - c.y) * k - 5, width: caja.w * k + 10, height: caja.h * k + 10 }}
          aria-hidden="true"
        >
          {movil && (
            <span className="cursor8">
              <Eight mode={CARA[foco.gesto] ?? 'mirar'} look={MIRADA[foco.gesto] ?? [-0.5, 0.45, 0]} fg={BLANCO} cut={COBALTO} label="cursor de 8" />
            </span>
          )}
          {foco.aviso && <span key={`a${foco.n}`} className="aviso-foco">{foco.aviso}</span>}
        </div>
      )}
      {ultima && !(verFoco && foco.aviso) && (
        <p key={ultima.n} className={`real-paso t-${ultima.tono}`} aria-live="polite">
          <b>{ultima.titulo}</b>
          {ultima.texto && ultima.tipo !== 'dice' && ultima.tipo !== 'encargo' && (
            <span><Tokens text={ultima.texto} valores={valores} mostrar={modo === 'tu' ? 'real' : 'token'} /></span>
          )}
        </p>
      )}
    </div>
  )

  const leyenda = modo === 'ocho'
    ? (v ? 'Lo que ve 8: nada' : `Lo que ve 8: ${ambar} ${ambar === 1 ? 'token' : 'tokens'}, ${rojo} nunca ${rojo === 1 ? 'sale' : 'salen'}`)
    : 'Pantalla real, solo en local'

  if (movil) {
    return (
      <div className="escenario real-escenario movil-real-escenario" ref={stage}>
        <div className="movil-real" aria-label={`Móvil de 8 en directo: ${nombreApp(frame.app)} ${nombrePantalla(frame.screen)}`}>
          {lienzo}
        </div>
        <span className="real-leyenda movil-leyenda">{leyenda}</span>
      </div>
    )
  }
  return (
    <div className="escenario real-escenario" ref={stage}>
      <div className="ventana real-ventana" style={{ width: size.width || undefined }} aria-label={`Pantalla de 8 en directo: ${nombreApp(frame.app)} ${nombrePantalla(frame.screen)}`}>
        <div className="ventana-cab">
          <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
          <b className="ventana-app">{nombreApp(frame.app)}</b>
          {frame.screen && <span className="ventana-pantalla">{nombrePantalla(frame.screen)}</span>}
          <span className="sp" />
          <span className={`real-chip ${modo === 'ocho' ? 'ocho' : ''}`}>{leyenda}</span>
        </div>
        {lienzo}
      </div>
    </div>
  )
}
