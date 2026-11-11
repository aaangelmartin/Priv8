// node src/directo.test.mjs  (sin dependencias)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estadoDe8, tareaActual, textoDeSegmentos } from './directo.js'

const ev = (kind, extra = {}, rx = 0) => ({ kind, session: 'b2b', _rx: rx, ...extra })

// Sin nada: espera un encargo.
assert.equal(estadoDe8({ audit: [] }).modo, 'mirar')
assert.equal(estadoDe8({ audit: [] }).titulo, 'Esperando tu encargo')
assert.equal(estadoDe8({ audit: [], status: 'reconectando' }).modo, 'sinconexion')

// Cada evento con su cara.
const etiquetas = { 'alba-core|factura.alta|e7': 'Importe' }
const leer = estadoDe8({ audit: [ev('observe_sent', { app: 'alba-core', screen: 'factura.alta', counts: { verde: 3, ambar: 6, rojo: 0 } })] })
assert.equal(leer.modo, 'leer')
assert.equal(leer.titulo, 'Leyendo Alba Core - alta de factura')
assert.equal(estadoDe8({ audit: [ev('oracle', { model_saw: 'oracle compare ‹IMPORTE_1-positivo› ‹IMPORTE_2-positivo›' })] }).titulo, 'Comprobando el importe sin verlo')
const escribe = estadoDe8({ audit: [ev('act', { app: 'alba-core', screen: 'factura.alta', model_saw: 'act type e7 ‹IMPORTE_1-positivo›' })], etiquetas })
assert.deepEqual([escribe.modo, escribe.titulo, escribe.detalle], ['hablar', 'Escribiendo «Importe»', '‹IMPORTE_1-positivo›'])
assert.equal(estadoDe8({ audit: [ev('blocked', { reason: 'destino' })] }).modo, 'enfado')
assert.equal(estadoDe8({ audit: [ev('held')] }).modo, 'esperar')
const pend = estadoDe8({ audit: [ev('held')], pending: [{ id: 'c1', summary: [{ voice: 'cloud', text: 'Registrar la factura' }, { voice: 'local', token: '‹FACTURA_1-correo›' }] }] })
assert.deepEqual([pend.modo, pend.detalle], ['esperar', 'Registrar la factura ‹FACTURA_1-correo›'])

// El encargo: recibido, inicio, pasos, respuesta y fin.
const audit = [
  ev('task', { detail: 'tarea recibida · app · 22 caracteres' }, 1000),
  ev('task', { detail: 'inicio · modelo · máx 20 pasos', model_saw: 'registrar factura' }, 1100),
  ev('task', { detail: 'paso 1 · tool_use', model_saw: 'observe {}' }, 2000),
  ev('observe_sent', { app: 'alba-core', screen: 'factura.alta' }, 2100),
  ev('task', { detail: 'paso 2 · tool_use', model_saw: 'act {"op": "type"}' }, 3000),
  ev('act', { model_saw: 'act type e7 ‹IMPORTE_1-positivo›' }, 3100),
]
let t = tareaActual(audit)
assert.deepEqual([t.inicio, t.pasos, t.terminada, t.encargo], [1000, 2, false, 'registrar factura'])
assert.equal(estadoDe8({ audit: audit.slice(0, 2) }).modo, 'atencion')
assert.equal(estadoDe8({ audit: audit.slice(0, 3) }).modo, 'pensar')
const fin = [...audit, ev('task', { detail: 'paso 3 · end_turn', model_saw: 'He registrado ‹FACTURA_1-correo›.' }, 4000), ev('task', { detail: 'fin · paso 3' }, 4001)]
t = tareaActual(fin)
assert.deepEqual([t.pasos, t.terminada, t.fin, t.respuesta], [3, true, 4000, 'He registrado ‹FACTURA_1-correo›.'])
const listo = estadoDe8({ audit: fin, ahora: 5000 })
assert.deepEqual([listo.modo, listo.detalle], ['listo', 'He registrado ‹FACTURA_1-correo›.'])
assert.equal(estadoDe8({ audit: fin, ahora: 60000 }).modo, 'mirar')
assert.equal(estadoDe8({ audit: fin, ahora: 60000, feed: true }).modo, 'listo')
// Un encargo nuevo empieza de cero.
t = tareaActual([...fin, ev('task', { detail: 'tarea recibida · app · 9 caracteres' }, 9000)])
assert.deepEqual([t.inicio, t.pasos, t.terminada], [9000, 0, false])
// Límite de pasos.
assert.equal(estadoDe8({ audit: [...audit, ev('task', { detail: 'límite de pasos · 20' }, 5000)], ahora: 5001 }).modo, 'duda')

// El feed grabado del trámite con protocolo acaba en «listo» con la respuesta de 8.
const feed = JSON.parse(readFileSync(new URL('../public/con-protocolo.json', import.meta.url))).map((x) => x.msg).filter((m) => m.type === 'audit').map((m, i) => ({ ...m.event, _rx: i * 100 }))
t = tareaActual(feed)
assert.ok(t.terminada && t.pasos === 18 && /registrado/.test(t.respuesta))

// Frases de voz mixta.
assert.equal(textoDeSegmentos([{ voice: 'cloud', text: 'Tienes' }, { voice: 'local', token: '‹IMPORTE_1-positivo›' }, { voice: 'cloud', text: '.' }]), 'Tienes ‹IMPORTE_1-positivo›.')

// Lo que razona 8 antes de actuar (#154) no es su respuesta: el encargo sigue en curso.
{
  const t = tareaActual([
    { kind: 'task', detail: 'inicio', model_saw: 'Registra la factura', _rx: 1 },
    { kind: 'task', detail: 'paso 1 - razona', model_saw: '**Plan:** abro el correo', _rx: 2 },
  ])
  assert.equal(t.terminada, false)
  assert.equal(t.respuesta, null)
}

console.log('directo: ok')
