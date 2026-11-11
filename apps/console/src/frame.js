// La pantalla real de 8 (#147): funciones puras sobre el mensaje `frame` del núcleo.
//
// Un frame trae la imagen de la pestaña o del móvil que maneja 8 (valores reales, solo
// en local) y las cajas de los elementos de la última observación, con su clase y lo que
// leyó el modelo. w y h son el espacio de las cajas; la imagen puede ser más pequeña.

// ws://127.0.0.1:8700/events por defecto; ?ws=ws://127.0.0.1:8790/events para probar otro
// núcleo sin tocar la demo. Solo se aceptan 127.0.0.1 y localhost: el canal lleva datos reales.
const WS_OK = /^ws:\/\/(127\.0\.0\.1|localhost)(:\d{2,5})?\/events$/
export function urlsDe(search = '') {
  const pedido = new URLSearchParams(search).get('ws')
  const ws = pedido && WS_OK.test(pedido) ? pedido : 'ws://127.0.0.1:8700/events'
  return { ws, verify: ws.replace(/^ws:/, 'http:').replace(/\/events$/, '/verify') }
}

// La URL del canal para la consola: pide también los fotogramas.
export const conFotogramas = (ws) => `${ws}${ws.includes('?') ? '&' : '?'}frames=1`

// Tamaño que cabe en (maxW, maxH) con la proporción w:h.
export function encaja(w, h, maxW, maxH) {
  if (!(w > 0 && h > 0 && maxW > 0 && maxH > 0)) return { width: 0, height: 0 }
  const k = Math.min(maxW / w, maxH / h)
  return { width: Math.floor(w * k), height: Math.floor(h * k) }
}

// Por qué «lo que ve 8» tapa la pantalla entera, o null si se ve con sus cajas.
//   pausa: 8 mira a otro lado (autenticación, diálogo del sistema, su confirmación)
//   sin_leer: la pantalla ha cambiado y 8 aún no la ha leído
export function velo(frame) {
  if (!frame) return null
  if (frame.paused) return 'pausa'
  if (!frame.fresh) return 'sin_leer'
  return null
}

const area = (r) => r.w * r.h

// Qué se dibuja en «lo que ve 8»:
//   nitidos: cajas verdes con texto, que se ven tal cual (los contenedores grandes no
//            cuentan: dejarían ver lo que no está marcado)
//   tapados: cajas ámbar (su token o el texto con tokens) y rojas («nunca sale»), de mayor
//            a menor para que las de dentro queden encima
export function capas(frame) {
  const rects = Array.isArray(frame?.rects) ? frame.rects : []
  const total = (frame?.w ?? 0) * (frame?.h ?? 0)
  const nitidos = rects.filter((r) => r.cls === 'verde' && r.text && total > 0 && area(r) < total * 0.5)
  const tapados = rects.filter((r) => r.cls === 'ambar' || r.cls === 'rojo').sort((a, b) => area(b) - area(a))
  return { nitidos, tapados }
}

// Lo que pone la tapa de una caja: el texto que leyó el modelo (con tokens) o su token.
export function tapa(r) {
  if (r.cls === 'rojo') return { tipo: 'nunca', texto: 'nunca sale' }
  const texto = r.text ?? r.token ?? ''
  return { tipo: 'token', texto: texto || r.token || '' }
}

// Una caja del frame en porcentajes de lo que se enseña (el recorte, o el frame entero).
export function enPorcentaje(r, c) {
  const ox = c.x ?? 0
  const oy = c.y ?? 0
  return {
    left: `${((r.x - ox) / c.w) * 100}%`, top: `${((r.y - oy) / c.h) * 100}%`,
    width: `${(r.w / c.w) * 100}%`, height: `${(r.h / c.h) * 100}%`,
  }
}

// La parte del fotograma que se enseña: lo que ocupan los elementos que lee 8, con margen.
// Alba Core dibuja una ventana antigua pequeña en medio de un escritorio vacío: así se ve
// grande. Sin cajas, o si ocupan casi todo, el fotograma entero. Redondeado a 8 px para que
// no tiemble entre fotogramas.
export function recorte(frame, margen = 28) {
  const entero = { x: 0, y: 0, w: frame?.w ?? 0, h: frame?.h ?? 0 }
  const rects = (Array.isArray(frame?.rects) ? frame.rects : []).filter((r) => r.w > 0 && r.h > 0)
  if (!rects.length || !(entero.w > 0 && entero.h > 0)) return entero
  const x0 = Math.max(0, Math.floor((Math.min(...rects.map((r) => r.x)) - margen) / 8) * 8)
  const y0 = Math.max(0, Math.floor((Math.min(...rects.map((r) => r.y)) - margen) / 8) * 8)
  const x1 = Math.min(entero.w, Math.ceil((Math.max(...rects.map((r) => r.x + r.w)) + margen) / 8) * 8)
  const y1 = Math.min(entero.h, Math.ceil((Math.max(...rects.map((r) => r.y + r.h)) + margen) / 8) * 8)
  const c = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  if (c.w * c.h > entero.w * entero.h * 0.8 || c.w < 120 || c.h < 120) return entero
  return c
}

export const cajaDe =(frame, id) => (id && Array.isArray(frame?.rects) ? frame.rects.find((r) => r.id === id) ?? null : null)

// Android: el frame es de un móvil.
export const esMovilFrame = (frame) => /^es\./.test(frame?.app ?? '') || (frame?.h ?? 0) > (frame?.w ?? 0) * 1.3
