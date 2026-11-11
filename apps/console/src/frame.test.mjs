// node src/frame.test.mjs  (sin dependencias)
import assert from 'node:assert/strict'
import { cajaDe, capas, conFotogramas, encaja, enPorcentaje, esMovilFrame, recorte, tapa, urlsDe, velo } from './frame.js'

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

const frame = {
  type: 'frame', session: 'b2b', app: 'alba-core', screen: 'factura.alta', fresh: true, paused: null, w: 1100, h: 760,
  rects: [
    { id: 'e1', x: 0, y: 0, w: 1100, h: 760, cls: 'verde', token: null, text: 'contenedor' },
    { id: 'e2', x: 20, y: 20, w: 300, h: 30, cls: 'verde', token: null, text: 'Alta de factura' },
    { id: 'e3', x: 20, y: 80, w: 300, h: 40, cls: 'ambar', token: '‹IBAN_1-maestro›', text: '‹IBAN_1-maestro›' },
    { id: 'e4', x: 10, y: 70, w: 600, h: 200, cls: 'ambar', token: '‹PERSONA_1›', text: 'Hola ‹PERSONA_1›' },
    { id: 'e5', x: 20, y: 300, w: 300, h: 40, cls: 'rojo', token: null, text: null },
    { id: 'e6', x: 20, y: 360, w: 300, h: 40, cls: 'verde', token: null, text: null },
  ],
}

// Lo verde con texto se ve nítido; los contenedores grandes y lo verde sin texto, no.
const { nitidos, tapados } = capas(frame)
assert.deepEqual(nitidos.map((r) => r.id), ['e2'])
// Se tapa lo ámbar y lo rojo, de mayor a menor (lo de dentro, encima).
assert.deepEqual(tapados.map((r) => r.id), ['e4', 'e3', 'e5'])
assert.deepEqual(capas(null), { nitidos: [], tapados: [] })

assert.deepEqual(tapa(frame.rects[2]), { tipo: 'token', texto: '‹IBAN_1-maestro›' })
assert.deepEqual(tapa(frame.rects[3]), { tipo: 'token', texto: 'Hola ‹PERSONA_1›' })
assert.deepEqual(tapa(frame.rects[4]), { tipo: 'nunca', texto: 'nunca sale' })

// El velo: pantalla sin leer o en pausa.
assert.equal(velo(frame), null)
assert.equal(velo({ ...frame, fresh: false, rects: [] }), 'sin_leer')
assert.equal(velo({ ...frame, paused: 'autenticacion' }), 'pausa')
assert.equal(velo(null), null)

assert.deepEqual(enPorcentaje({ x: 110, y: 76, w: 550, h: 38 }, frame), { left: '10%', top: '10%', width: '50%', height: '5%' })
assert.deepEqual(enPorcentaje({ x: 150, y: 100, w: 50, h: 50 }, { x: 100, y: 50, w: 200, h: 100 }), { left: '25%', top: '50%', width: '25%', height: '50%' })

// Recorte: lo que ocupan los elementos, con margen; entero si no hay cajas o lo ocupan casi todo.
assert.deepEqual(recorte(frame), { x: 0, y: 0, w: 1100, h: 760 }) // e1 ocupa todo
const erp = { w: 1100, h: 760, rects: [{ x: 300, y: 200, w: 400, h: 30 }, { x: 320, y: 400, w: 200, h: 40 }] }
assert.deepEqual(recorte(erp), { x: 272, y: 168, w: 456, h: 304 })
assert.deepEqual(recorte({ w: 1100, h: 760, rects: [] }), { x: 0, y: 0, w: 1100, h: 760 })
assert.deepEqual(recorte(null), { x: 0, y: 0, w: 0, h: 0 })

assert.equal(cajaDe(frame, 'e3').token, '‹IBAN_1-maestro›')
assert.equal(cajaDe(frame, 'zz'), null)
assert.equal(cajaDe(null, 'e3'), null)

assert.equal(esMovilFrame(frame), false)
assert.equal(esMovilFrame({ app: 'es.priv8.banks.alcor', w: 1080, h: 2400 }), true)

console.log('frame: ok')
