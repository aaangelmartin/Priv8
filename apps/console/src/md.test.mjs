// node src/md.test.mjs  (sin dependencias)
import assert from 'node:assert/strict'
import { bloques, partes, plano } from './md.js'

assert.deepEqual(partes('**Plan:** reviso ‹IBAN_1-correo›'), [{ b: true, t: 'Plan:' }, { b: false, t: ' reviso ‹IBAN_1-correo›' }])
assert.deepEqual(partes('sin `código` ni __marcas__'), [{ b: false, t: 'sin código ni marcas' }])
assert.deepEqual(partes('**suelto'), [{ b: false, t: 'suelto' }])

assert.deepEqual(bloques('**Plan:** reviso\n1. Abro el correo\n2. Escribo ‹IMPORTE_1-positivo›\n\nListo.'), [
  { tipo: 'p', partes: [{ b: true, t: 'Plan:' }, { b: false, t: ' reviso' }] },
  { tipo: 'ol', items: [[{ b: false, t: 'Abro el correo' }], [{ b: false, t: 'Escribo ‹IMPORTE_1-positivo›' }]] },
  { tipo: 'p', partes: [{ b: false, t: 'Listo.' }] },
])
// Lista en una sola línea, y viñetas.
assert.deepEqual(bloques('Haré esto: 1. Abro 2. Registro').map((b) => b.tipo), ['p', 'ol'])
assert.deepEqual(bloques('- uno\n* dos').map((b) => [b.tipo, b.items?.length]), [['ul', 2]])
assert.deepEqual(bloques(''), [])
assert.equal(plano('**Hecho.** He registrado 1. la factura'), 'Hecho. He registrado 1. la factura')
console.log('md ok')
