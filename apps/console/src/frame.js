// La pantalla de 8 en directo (#147, #154): funciones puras sobre el mensaje `frame` del núcleo
// y sobre la pantalla observada.
//
// Web: el frame trae la vista de 8 (vista: '8'), una página espejo que el adaptador censura
// en el DOM antes de pintarla: cada valor ámbar ya es su token y cada rojo «nunca sale». La
// consola la enseña tal cual, sin tapar nada encima.
// Android: el frame trae la pantalla real del móvil; la consola no la enseña. Vuelve a pintar
// la pantalla con lo que vio el modelo (los elementos observados, en su sitio), así que ahí
// tampoco existe el valor real.

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

// El frame es la vista de 8 censurada en el DOM (web): se enseña tal cual.
export const esVista8 = (frame) => frame?.vista === '8' && typeof frame.img === 'string' && frame.w > 0 && frame.h > 0

// Android: el frame es de un móvil.
export const esMovilFrame = (frame) => /^es\./.test(frame?.app ?? '') || (frame?.h ?? 0) > (frame?.w ?? 0) * 1.3

// Lo que va en la vista de 8 de un móvil: cada elemento observado en el sitio que ocupa en la
// pantalla real (bounds del snapshot, solo en local), con lo que leyó el modelo.
//   {w, h, cajas: [{id, x, y, w, h, role, cls, texto, label, contenedor}]}
// texto: el observado (tokens), null en lo rojo. Los contenedores (contienen a otros) no llevan
// texto: se pintan como zonas. De mayor a menor área, para que lo de dentro quede encima.
export function cajasMovil(screen) {
  const obs = screen?.observed
  const raw = screen?.raw
  if (!obs || !raw) return null
  const pos = new Map((raw.elements ?? []).filter((e) => Array.isArray(e.bounds) && e.bounds.length === 4).map((e) => [e.id, e.bounds]))
  let W = 0
  let H = 0
  for (const b of pos.values()) { W = Math.max(W, b[2]); H = Math.max(H, b[3]) }
  if (!W || !H) return null
  const cajas = []
  for (const el of obs.elements ?? []) {
    const b = pos.get(el.id)
    if (!b || b[2] <= b[0] || b[3] <= b[1]) continue
    cajas.push({ id: el.id, x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1], role: el.role, cls: el.cls ?? 'verde',
      texto: el.cls === 'rojo' ? null : el.text ?? null, label: el.label ?? null })
  }
  const dentro = (a, c) => a !== c && c.x >= a.x && c.y >= a.y && c.x + c.w <= a.x + a.w && c.y + c.h <= a.y + a.h
  for (const c of cajas) c.contenedor = cajas.some((o) => dentro(c, o))
  cajas.sort((a, b) => b.w * b.h - a.w * a.h)
  return { w: W, h: H, cajas }
}
