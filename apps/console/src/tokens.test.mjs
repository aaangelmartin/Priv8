// node apps/console/src/tokens.test.mjs
import assert from 'node:assert/strict'
import { alinear, partesDeToken, valoresDe } from './tokens.js'

assert.deepEqual(alinear('Factura F-2026-0412', 'Factura ‹FACTURA_1·correo›'),
  [{ texto: 'Factura ' }, { texto: 'F-2026-0412', token: '‹FACTURA_1·correo›' }])
assert.deepEqual(alinear('Registrar', 'Registrar'), [{ texto: 'Registrar' }])
assert.equal(alinear('otra cosa', 'Registrar'), null)
assert.equal(alinear('sin relación', 'Pague a ‹IBAN_1·correo› ya'), null)
// Varios tokens con texto multilínea en medio
const t = alinear('Paguen a ES42 9100\ny llamen al 611 222 333.', 'Paguen a ‹IBAN_1·correo›\ny llamen al ‹TEL_1·correo›.')
assert.deepEqual(t.filter((x) => x.token).map((x) => x.texto), ['ES42 9100', '611 222 333'])

const raw = { elements: [{ id: 'e1', text: 'ES91 2100', label: 'IBAN de pago' }, { id: 'e2', text: null }] }
const obs = { elements: [{ id: 'e1', text: '‹IBAN_2·maestro›', label: 'IBAN de pago' }, { id: 'e2', text: null }] }
assert.deepEqual(valoresDe(raw, obs), { '‹IBAN_2·maestro›': 'ES91 2100' })

assert.deepEqual(partesDeToken('‹IBAN_1·correo›'), { tipo: 'IBAN', n: '1', origen: 'correo' })
console.log('tokens: ok')
