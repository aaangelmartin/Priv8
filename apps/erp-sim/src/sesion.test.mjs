// node apps/erp-sim/src/sesion.test.mjs
import assert from 'node:assert/strict'
import { cerrarSesion, entrarComo, sesionInicial, trasReset } from './sesion.js'

const usuarios = [{ usuario: 'admin.alba' }]

// Sin sesión de la demo: lo guardado, tal cual (hoy: login).
assert.deepEqual(sesionInicial({}, '', usuarios), {})
assert.deepEqual(sesionInicial(null, undefined, usuarios), {})
assert.deepEqual(sesionInicial({ usuario: 'admin.alba' }, '', usuarios), { usuario: 'admin.alba' })

// Con la sesión de la demo: abierta desde el principio, sin perder las facturas guardadas.
assert.deepEqual(sesionInicial({}, 'admin.alba', usuarios), { usuario: 'admin.alba' })
assert.deepEqual(sesionInicial({ facturas: [1] }, 'admin.alba', usuarios), { facturas: [1], usuario: 'admin.alba' })

// Un usuario de la demo que no existe no abre nada.
assert.deepEqual(sesionInicial({}, 'otro', usuarios), {})

// Si la persona cerró la sesión, sigue cerrada: vuelve a pedir la clave.
const cerrada = { facturas: [1], ...cerrarSesion() }
assert.equal(sesionInicial(cerrada, 'admin.alba', usuarios).usuario, null)
// Y al entrar con su clave vuelve a valer la sesión recordada.
assert.equal(sesionInicial({ ...cerrada, ...entrarComo('admin.alba') }, 'admin.alba', usuarios).usuario, 'admin.alba')

assert.equal(trasReset('admin.alba'), '/facturas/alta')
assert.equal(trasReset(''), '/login')
console.log('sesion: ok')
