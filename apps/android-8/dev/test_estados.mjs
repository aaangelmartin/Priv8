// Tests of assets/ocho/estados.js against the v1 contract examples.
// Run from the repository root: node apps/android-8/dev/test_estados.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const E = require('../app/src/main/assets/ocho/estados.js');
const ojos = readFileSync(new URL('../../../docs/ojos.html', import.meta.url), 'utf8');
const ex = (n) => JSON.parse(readFileSync(new URL(`../../../docs/contracts/examples/${n}`, import.meta.url), 'utf8'));

// The faces the engine knows (EMO in docs/ojos.html).
const CARAS = new Set([...ojos.matchAll(/k:'([a-z_]+)'/g)].map((m) => m[1]));
const caras = (plan) => (plan || []).map((p) => p.cara);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

const audit = (kind, extra = {}) => ({ type: 'audit', event: { kind, ...extra } });

t('every face used exists in docs/ojos.html', () => {
  const kinds = ['task', 'observe_sent', 'act', 'oracle', 'held', 'approval', 'paused', 'call'];
  const reasons = ['fuga', 'destino', 'rojo', 'presupuesto', 'sin_regla', 'token_desconocido', 'caducado', 'cancelado', 'adaptador', 'asesoria'];
  const plans = [
    ...kinds.map((k) => E.decidir(audit(k))),
    ...reasons.map((r) => E.decidir(audit('blocked', { reason: r }))),
    E.decidir(audit('observe_sent', { counts: { ambar: 2 } })),
    E.decidir(audit('observe_sent', { counts: { rojo: 1 } })),
    E.decidir(ex('events.voice.json')), E.decidir(ex('events.confirm-request.json')),
    E.decidir(ex('confirm.approval-ok.json')), E.decidir(ex('confirm.approval-caducado.json')),
    E.conexion('conectado'), E.conexion('sin_conexion'),
  ];
  for (const c of plans.flatMap(caras)) assert.ok(CARAS.has(c), `unknown face ${c}`);
  assert.ok(CARAS.has(E.REPOSO));
});

t('paused (key, fingerprint, OTP) looks away and stays', () => {
  assert.deepEqual(E.decidir(audit('paused')), [{ cara: 'apartar', ms: null }]);
});

t('a screen with tokens: reads, then asterisks', () => {
  assert.deepEqual(caras(E.decidir(audit('observe_sent', { counts: { verde: 3, ambar: 2, rojo: 0 } }))), ['leer', 'nove']);
  assert.deepEqual(caras(E.decidir(audit('observe_sent', { counts: { verde: 3, ambar: 0, rojo: 0 } }))), ['leer']);
});

t('blocked by red data closes the eyes; IBAN from an email gets angry', () => {
  assert.deepEqual(caras(E.decidir(audit('blocked', { reason: 'rojo' }))), ['nuncasale']);
  assert.deepEqual(caras(E.decidir(ex('events.audit.json'))), ['enfado']); // example: reason destino
});

t('asked for investment advice: the «no puedo» face (#43)', () => {
  assert.deepEqual(caras(E.decidir(ex('events.audit-asesoria.json'))), ['rechazar']);
  assert.match(ojos, /k:'rechazar',[^\n]*n:'No puedo'/);
  // The fixed sentence comes first as a voice message, all cloud: 8 speaks, then the face stays.
  assert.deepEqual(caras(E.decidir(ex('events.voice-no-puedo.json'))), ['hablar']);
});

t('confirmation: calls you, then waits; yes nods, no shakes', () => {
  assert.deepEqual(caras(E.decidir(ex('events.confirm-request.json'))), ['atencion', 'esperar']);
  assert.equal(E.decidir(ex('events.confirm-request.json'))[1].ms, null);
  assert.deepEqual(caras(E.decidir(ex('confirm.approval-ok.json'))), ['asentir']);
  assert.deepEqual(caras(E.decidir(ex('confirm.approval-caducado.json'))), ['negar']);
});

t('voice speaks for a bounded time', () => {
  const [p] = E.decidir(ex('events.voice.json'));
  assert.equal(p.cara, 'hablar');
  assert.ok(p.ms >= 1500 && p.ms <= 12000);
});

t('screen (real values) and unknown messages do not change the face', () => {
  assert.equal(E.decidir(ex('events.screen.json')), null);
  assert.equal(E.decidir({ type: 'otro' }), null);
  assert.equal(E.decidir(null), null);
  assert.equal(E.decidir(audit('voice_out')), null);
});

t('every contract example of the channel is handled without throwing', () => {
  const dir = new URL('../../../docs/contracts/examples/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.startsWith('events.'))) E.decidir(ex(f));
});

console.log(`\n${n} tests passed`);
