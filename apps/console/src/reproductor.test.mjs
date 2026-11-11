// node src/reproductor.test.mjs
import assert from 'node:assert/strict'
import { crearReloj, delPar, emparejar, esSesion, migrar, paresIncoherentes, proximos, tramo, valida } from './reproductor.js'

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

// 4x y saltar a un momento: cuenta como reinicio y respeta la pausa
reloj.velocidad(4)
assert.equal(reloj.estado.velocidad, 4)
reloj.alternar() // pausa
const r0 = reloj.estado.reinicios
reloj.saltar(6.5)
assert.equal(reloj.t, 6.5)
assert.equal(reloj.estado.enMarcha, false)
assert.equal(reloj.estado.reinicios, r0 + 1)
reloj.avanzar(0.2)
assert.equal(reloj.t, 6.5, 'en pausa, el salto no avanza')
reloj.saltar(-3)
assert.equal(reloj.t, 0)
reloj.saltar(99)
assert.equal(reloj.t, 10)
assert.equal(reloj.estado.terminado, true)

// ---- pares de fotogramas (#187) ----

// Grabación nueva: cada momento entrega el último par de su tramo, con las dos pantallas juntas.
const conPares = {
  formato: 'priv8-sesion/1',
  duracion: 10,
  eventos: [{ at: 0, msg: { type: 'screen' } }, { at: 3, msg: { type: 'task_request', text: 'x' } }],
  pares: [
    { at: 0, par: 1, real: { src: 's/r0001.jpg', w: 1100, h: 760, par: 1 }, ocho: { src: 's/v0001.jpg', w: 1100, h: 760, par: 1, vista: '8' } },
    { at: 1, par: 2, real: { src: 's/r0002.jpg', w: 1100, h: 760, par: 2 }, ocho: { src: 's/v0002.jpg', w: 1100, h: 760, par: 2, vista: '8' } },
    { at: 1.2, par: 3, real: { src: 's/r0003.jpg', w: 1100, h: 760, par: 3 }, ocho: { src: 's/v0003.jpg', w: 1100, h: 760, par: 3, vista: '8' } },
  ],
  real: [],
}
assert.equal(paresIncoherentes(conPares), null)
r = tramo(conPares, 0, 0, 0.5, 0)
assert.equal(r.par.par, 1)
r = tramo(conPares, r.i, r.j, 1.5, r.k)
assert.equal(r.par.par, 3, 'solo cuenta el último par del tramo')
r = tramo(conPares, r.i, r.j, 2.5, r.k)
assert.equal(r.par, null, 'sin par nuevo: la consola sigue con el anterior en las dos')
const dp = delPar(conPares.pares[1])
assert.equal(dp.frame.src, 's/v0002.jpg')
assert.equal(dp.real.src, 's/r0002.jpg')
assert.equal(dp.frame.par, dp.real.par)
assert.equal(dp.frame.vista, '8')
assert.equal(dp.real.vista, 'real')
assert.deepEqual(proximos(conPares, 0.5, 1), ['s/r0002.jpg', 's/v0002.jpg', 's/r0003.jpg', 's/v0003.jpg'])

// Lo que el comprobador no deja pasar: un par con un lado de otro paso, fuera de orden, una
// vista de 8 suelta o una pestaña real suelta junto a los pares.
const mal = (f) => { const d = structuredClone(conPares); f(d); return paresIncoherentes(d) }
assert.match(mal((d) => { d.pares[1].real.par = 3 }), /pasos distintos/)
assert.match(mal((d) => { d.pares[2].at = 0.5 }), /antes que el anterior/)
assert.match(mal((d) => { d.pares[2].par = 2; d.pares[2].real.par = 2; d.pares[2].ocho.par = 2 }), /id creciente/)
assert.match(mal((d) => { delete d.pares[0].ocho.src }), /no tiene la vista de 8/)
assert.match(mal((d) => { d.pares[0].real.w = 900 }), /distinto tamaño/)
assert.match(mal((d) => { d.eventos.push({ at: 2, msg: { type: 'frame', vista: '8', src: 'x' } }) }), /sueltos/)
assert.match(mal((d) => { d.real = [{ at: 1, src: 'r' }] }), /suelta/)
assert.match(paresIncoherentes(sesion), /sin pares/) // el formato anterior, sin migrar

// Grabación anterior: cada real con la vista de 8 más cercana, sin volver atrás; el par sale
// cuando existen los dos.
const vistas = [0, 0.2, 2.25, 2.45, 2.66].map((at, n) => ({ at, msg: { type: 'frame', vista: '8', src: `v${n + 1}` } }))
const reales = [0, 2.24, 2.53, 2.84].map((at, n) => ({ at, src: `r${n + 1}`, w: 1100, h: 760 }))
const ps = emparejar(vistas, reales)
assert.deepEqual(ps.map((p) => [p.real.src, p.ocho.src]), [['r1', 'v1'], ['r2', 'v3'], ['r3', 'v4'], ['r4', 'v5']])
assert.deepEqual(ps.map((p) => p.at), [0, 2.25, 2.53, 2.84])
assert.ok(ps.every((p, n) => p.par === n + 1 && p.real.par === p.par && p.ocho.par === p.par))
assert.deepEqual(emparejar(vistas.slice(0, 2), []).map((p) => [p.real, p.ocho.src]), [[null, 'v1'], [null, 'v2']])
const m = migrar(sesion)
assert.equal(m.migrado, true)
assert.deepEqual(m.pares.map((p) => [p.real.src, p.ocho.src]),
  [['sesion-b2b/r0001.jpg', 'sesion-b2b/v0001.jpg'], ['sesion-b2b/r0002.jpg', 'sesion-b2b/v0001.jpg'], ['sesion-b2b/r0003.jpg', 'sesion-b2b/v0002.jpg']])
assert.ok(!m.eventos.some((e) => e.msg.type === 'frame'), 'los fotogramas sueltos salen de eventos')
assert.deepEqual(m.real, [])
assert.match(paresIncoherentes(m), /a 1\.50 s/) // r0003 (6 s) y v0002 (4,5 s): demasiado lejos
assert.equal(migrar(conPares), conPares, 'lo que ya tiene pares no cambia')
const android = { formato: 'priv8-sesion/1', duracion: 1, eventos: [{ at: 0, msg: { type: 'screen' } }], real: [{ at: 0, src: 'm.jpg' }] }
assert.equal(migrar(android), android, 'Android: sin vista de 8, sus capturas siguen sueltas')
assert.equal(paresIncoherentes(android), null)

console.log('reproductor: ok')
