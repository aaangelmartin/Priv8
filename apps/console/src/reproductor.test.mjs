// node src/reproductor.test.mjs
import assert from 'node:assert/strict'
import { crearReloj, esSesion, proximos, tramo, valida } from './reproductor.js'

const sesion = {
  formato: 'priv8-sesion/1',
  duracion: 10,
  eventos: [
    { at: 0, msg: { type: 'screen', n: 1 } },
    { at: 1, msg: { type: 'frame', src: 'sesion-b2b/v0001.jpg' } },
    { at: 2, msg: { type: 'task_request', text: 'Registra la factura' } },
    { at: 4.5, msg: { type: 'frame', src: 'sesion-b2b/v0002.jpg' } },
  ],
  real: [
    { at: 0.5, src: 'sesion-b2b/r0001.jpg' },
    { at: 1.5, src: 'sesion-b2b/r0002.jpg' },
    { at: 6, src: 'sesion-b2b/r0003.jpg' },
  ],
}

// solo las sesiones grabadas usan el reproductor
assert.equal(esSesion('sesion-b2b'), true)
assert.equal(esSesion('con-protocolo'), false)
assert.equal(esSesion(null), false)
assert.equal(valida(sesion), true)
assert.equal(valida([{ at: 1, msg: {} }]), false)

// cada tramo entrega los mensajes en orden y solo el último fotograma real
let r = tramo(sesion, 0, 0, 1.6)
assert.deepEqual(r.msgs.map((m) => m.type), ['screen', 'frame'])
assert.equal(r.real.src, 'sesion-b2b/r0002.jpg')
r = tramo(sesion, r.i, r.j, 3)
assert.deepEqual(r.msgs.map((m) => m.type), ['task_request'])
assert.equal(r.real, null)
r = tramo(sesion, r.i, r.j, 99)
assert.equal(r.msgs.length, 1)
assert.equal(r.real.src, 'sesion-b2b/r0003.jpg')

// se descargan antes los fotogramas de los próximos segundos
assert.deepEqual(proximos(sesion, 2, 3), ['sesion-b2b/v0002.jpg'])
assert.deepEqual(proximos(sesion, 3.5, 3), ['sesion-b2b/v0002.jpg', 'sesion-b2b/r0003.jpg'])

// el reloj: velocidad, pausa, salto máximo, fin y reinicio
const reloj = crearReloj()
reloj.cargar(10)
reloj.avanzar(0.2)
assert.equal(reloj.t, 0.2)
reloj.velocidad(2)
reloj.avanzar(0.1)
assert.ok(Math.abs(reloj.t - 0.4) < 1e-9)
reloj.velocidad(3) // no existe: se queda en 2x
assert.equal(reloj.estado.velocidad, 2)
reloj.avanzar(5) // una pestaña en segundo plano no salta: cuenta 0,25 s
assert.ok(Math.abs(reloj.t - 0.9) < 1e-9)
reloj.alternar()
reloj.avanzar(0.2)
assert.ok(Math.abs(reloj.t - 0.9) < 1e-9, 'en pausa no avanza')
reloj.alternar()
for (let k = 0; k < 100; k++) reloj.avanzar(0.25)
assert.equal(reloj.t, 10)
assert.equal(reloj.estado.terminado, true)
assert.equal(reloj.estado.enMarcha, false)
const antes = reloj.estado.reinicios
reloj.alternar() // al final, reproducir vuelve a empezar
assert.equal(reloj.t, 0)
assert.equal(reloj.estado.enMarcha, true)
assert.equal(reloj.estado.reinicios, antes + 1)

console.log('reproductor: ok')
