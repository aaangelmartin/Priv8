// node src/vivo.test.mjs  (sin dependencias)
import assert from 'node:assert/strict'
import { duracion, esMovil, focoDe, leerAccion, lineaDe, objetivoDe, piensaTras, textoPlano } from './vivo.js'

// Funciona con los dos separadores de token: el antiguo (U+00B7) y ‹IBAN_1-correo›.
for (const sep of ['\u00b7', '-']) {
  const T = (s) => `‹${s.replace('|', sep)}›`
  const screen = {
    raw: { source: 'web', app: 'alba-core' },
    observed: {
      app: 'alba-core', screen: 'factura.alta', elements: [
        { id: 'e7', role: 'textbox', label: 'Importe', text: '', cls: 'ambar' },
        { id: 'e8', role: 'text', label: 'Importe del pedido', text: T('IMPORTE_1|positivo'), cls: 'ambar' },
        { id: 'e9', role: 'textbox', label: 'IBAN de pago', text: T('IBAN_2|maestro'), cls: 'ambar' },
        { id: 'e11', role: 'button', label: null, text: 'Registrar', cls: 'verde' },
        { id: 'f4', role: 'text', label: 'Teléfono', text: T('TEL_2|maestro'), cls: 'ambar', actions: ['call'] },
      ],
    },
  }

  // Acciones del modelo
  assert.deepEqual(leerAccion(`act type e7 ${T('IMPORTE_1|positivo')}`), { op: 'type', target: 'e7', text: T('IMPORTE_1|positivo') })
  assert.deepEqual(leerAccion('act tap e11'), { op: 'tap', target: 'e11', text: null })
  assert.equal(leerAccion('act open_app inbox').app, 'inbox')
  assert.equal(leerAccion('act type r2 Factura registrada. Gracias.').text, 'Factura registrada. Gracias.')
  assert.equal(leerAccion('observe {}'), null)
  assert.equal(objetivoDe(leerAccion(`act call ${T('TEL_1|correo')}`), screen), 'f4') // el que admite llamadas
  assert.equal(objetivoDe(leerAccion(`act call ${T('TEL_2|maestro')}`), screen), 'f4')

  // Líneas del razonamiento
  assert.equal(lineaDe({ kind: 'act', model_saw: 'act tap e11' }, screen).titulo, 'Pulsa «Registrar»')
  const escribe = lineaDe({ kind: 'act', model_saw: `act type e7 ${T('IMPORTE_1|positivo')}` }, screen)
  assert.deepEqual([escribe.titulo, escribe.texto], ['Escribe en «Importe»', T('IMPORTE_1|positivo')])
  assert.equal(lineaDe({ kind: 'blocked', reason: 'destino', model_saw: `act type e9 ${T('IBAN_1|correo')}`, detail: 'IBAN de origen correo no entra en pago.iban' }, screen).tono, 'bloqueo')
  assert.equal(lineaDe({ kind: 'held', model_saw: 'act tap e11' }, screen).sub, 'antes de: pulsa «Registrar»')
  assert.equal(lineaDe({ kind: 'observe_sent', app: 'alba-core', screen: 'factura.alta', counts: { verde: 3, ambar: 6, rojo: 0 } }).titulo, 'Observa Alba Core - alta de factura')
  assert.equal(lineaDe({ kind: 'task', detail: 'inicio - modelo - máx 20 pasos', model_saw: 'registra la factura' }).tipo, 'encargo')
  assert.equal(lineaDe({ kind: 'task', detail: 'tarea recibida - app' }), null)
  assert.equal(lineaDe({ kind: 'task', detail: 'paso 3 - tool_use', model_saw: 'act {"op":"tap"}', ms: { model: 2100 } }).sub, 'act | 2,1 s')
  assert.equal(lineaDe({ kind: 'task', detail: 'paso 9 - end_turn', model_saw: `He registrado ${T('FACTURA_1|correo')}` }).tipo, 'dice')
  // La respuesta final larga solo va entera en el chat.
  assert.equal(lineaDe({ kind: 'task', detail: 'paso 9 - end_turn', model_saw: 'He registrado la factura.' }).texto, null)
  assert.equal(lineaDe({ kind: 'oracle', model_saw: `oracle compare ${T('IMPORTE_1|positivo')} ${T('IMPORTE_1|positivo')}`, detail: 'igual' }).sub, 'responde: igual')

  // Foco del cursor
  assert.deepEqual(focoDe({ kind: 'act', model_saw: 'act tap e11' }, screen), { id: 'e11', gesto: 'tap', tono: 'cobalto', texto: null })
  assert.equal(focoDe({ kind: 'act', model_saw: `act type e7 ${T('IMPORTE_1|positivo')}` }, screen).gesto, 'type')
  assert.equal(focoDe({ kind: 'act', model_saw: 'act open_app inbox' }, screen), null)
  assert.equal(focoDe({ kind: 'blocked', reason: 'destino', model_saw: `act type e9 ${T('IBAN_1|correo')}` }, screen).tono, 'bloqueo')
  const espera = focoDe({ kind: 'held', model_saw: 'act tap e11' }, screen)
  assert.deepEqual([espera.id, espera.gesto, espera.aviso], ['e11', 'espera', 'Esperando tu confirmación'])
  assert.equal(focoDe({ kind: 'approval', approved_by: 'persona' }, screen, espera).tono, 'seguro')
  assert.equal(focoDe({ kind: 'oracle', model_saw: `oracle compare ${T('IMPORTE_1|positivo')}`, detail: 'igual' }, screen).id, 'e8')
  assert.equal(focoDe({ kind: 'observe_sent' }, screen, espera), null)

  // Tecleo con el valor real
  assert.equal(textoPlano(`Importe ${T('IMPORTE_1|positivo')}`, { [T('IMPORTE_1|positivo')]: '1.254,30 €' }), 'Importe 1.254,30 €')
  assert.equal(textoPlano(T('IMPORTE_1|positivo'), {}, true), T('IMPORTE_1|positivo'))
}

assert.equal(piensaTras({ kind: 'observe_sent' }), true)
assert.equal(piensaTras({ kind: 'act', model_saw: 'act tap e1' }), false)
assert.ok(duracion({ k: 'audit', ev: { kind: 'act', model_saw: 'act type r2 un texto bastante largo para teclear' } }) > duracion({ k: 'audit', ev: { kind: 'act', model_saw: 'act tap e1' } }))
assert.ok(duracion({ k: 'audit', ev: { kind: 'act', model_saw: `act type r2 ${'x'.repeat(500)}` } }) <= 1500)
assert.equal(esMovil({ raw: { source: 'android', app: 'es.priv8.banks.alcor' } }), true)
assert.equal(esMovil({ raw: { source: 'web', app: 'alba-core' }, observed: { app: 'alba-core' } }), false)
assert.equal(esMovil({ observed: { app: 'es.priv8.banks.brezo' } }), true)

console.log('vivo: ok')
