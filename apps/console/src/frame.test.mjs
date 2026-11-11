// node src/frame.test.mjs  (sin dependencias)
import assert from 'node:assert/strict'
import { cajasMovil, conFotogramas, encaja, esMovilFrame, esVista8, urlsDe } from './frame.js'

// URL del canal: por defecto :8700; ?ws= solo con 127.0.0.1 o localhost.
assert.deepEqual(urlsDe(''), { ws: 'ws://127.0.0.1:8700/events', verify: 'http://127.0.0.1:8700/verify' })
assert.deepEqual(urlsDe('?ws=ws://127.0.0.1:8790/events'), { ws: 'ws://127.0.0.1:8790/events', verify: 'http://127.0.0.1:8790/verify' })
assert.equal(urlsDe('?ws=ws://evil.example:8700/events').ws, 'ws://127.0.0.1:8700/events')
assert.equal(urlsDe('?ws=wss://127.0.0.1:8790/events').ws, 'ws://127.0.0.1:8700/events')
assert.equal(conFotogramas('ws://127.0.0.1:8700/events'), 'ws://127.0.0.1:8700/events?frames=1')

// Encajar con la proporción.
assert.deepEqual(encaja(1100, 760, 550, 1000), { width: 550, height: 380 })
assert.deepEqual(encaja(1080, 2400, 1000, 600), { width: 270, height: 600 })
assert.deepEqual(encaja(0, 760, 550, 1000), { width: 0, height: 0 })

// Solo la vista de 8 (censurada en el DOM) se enseña tal cual.
const web = { type: 'frame', session: 'b2b', app: 'alba-core', screen: 'factura.alta', fresh: true, w: 1100, h: 760, img: '/9j/', vista: '8', rects: [] }
assert.equal(esVista8(web), true)
assert.equal(esVista8({ ...web, vista: undefined }), false) // pantalla real (Android): nunca tal cual
assert.equal(esVista8(null), false)
// sesión grabada (#170): el fotograma trae la ruta de su JPEG en lugar de los píxeles
assert.equal(esVista8({ vista: '8', src: 'sesion-b2b/v0001.jpg', w: 1100, h: 760 }), true)
assert.equal(esVista8({ vista: '8', w: 1100, h: 760 }), false)
assert.equal(esMovilFrame({ app: 'es.priv8.banks.alcor', w: 1080, h: 2400 }), true)
assert.equal(esMovilFrame(web), false)

// Android: la pantalla otra vez, con lo que vio el modelo en el sitio de cada elemento.
const screen = {
  raw: { source: 'android', app: 'es.priv8.banks.alcor', elements: [
    { id: 'r0', role: 'other', bounds: [0, 0, 1080, 2400] },
    { id: 'r1', role: 'text', text: '200,00 €', bounds: [40, 300, 600, 360] },
    { id: 'r2', role: 'textbox', text: '1234', password: true, bounds: [40, 400, 600, 460] },
    { id: 'r4', role: 'button', label: 'Enviar', bounds: [40, 2000, 1040, 2120] },
  ] },
  observed: { app: 'es.priv8.banks.alcor', screen: 'revision', elements: [
    { id: 'r0', role: 'other', text: null, cls: 'verde' },
    { id: 'r1', role: 'text', text: '‹IMPORTE_1-positivo›', cls: 'ambar', tokens: ['‹IMPORTE_1-positivo›'] },
    { id: 'r2', role: 'textbox', text: null, cls: 'rojo' },
    { id: 'r4', role: 'button', label: 'Enviar', text: null, cls: 'verde' },
  ] },
}
const m = cajasMovil(screen)
assert.equal(m.w, 1080)
assert.equal(m.h, 2400)
assert.deepEqual(m.cajas.map((c) => c.id), ['r0', 'r4', 'r1', 'r2'])
assert.equal(m.cajas.find((c) => c.id === 'r0').contenedor, true)
assert.equal(m.cajas.find((c) => c.id === 'r1').texto, '‹IMPORTE_1-positivo›')
assert.equal(m.cajas.find((c) => c.id === 'r2').texto, null)
assert.ok(!JSON.stringify(m).includes('200,00') && !JSON.stringify(m).includes('1234')) // nunca el valor real
assert.equal(cajasMovil(null), null)
console.log('frame ok')
