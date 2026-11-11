// Pruebas del middleware de contraseña, sin dependencias: node scripts/middleware.test.mjs
import assert from 'node:assert/strict';
import { appDe, onRequest } from '../functions/_middleware.js';

const next = async () => new Response('ok', { headers: { 'Content-Type': 'application/octet-stream' } });
const ctx = (env, auth, path = '/') => ({
  env, next,
  request: new Request('https://demo.priv8.es' + path, { headers: auth ? { Authorization: auth } : {} }),
});
const basic = (s) => 'Basic ' + btoa(s);
const PW = { DEMO_PASSWORD: 'p8-jurado' };

const cases = [
  ['sin variable, abierto', ctx({}, null), 200],
  ['sin credenciales', ctx(PW, null), 401],
  ['contraseña mala', ctx(PW, basic('jurado:mala')), 401],
  ['contraseña buena', ctx(PW, basic('jurado:p8-jurado')), 200],
  ['usuario vacío', ctx(PW, basic(':p8-jurado')), 200],
  ['cabecera rota', ctx(PW, 'Basic %%%'), 401],
  ['otro esquema', ctx(PW, 'Bearer p8-jurado'), 401],
  ['contraseña con dos puntos', ctx({ DEMO_PASSWORD: 'a:b' }, basic('u:a:b')), 200],
];
for (const [name, c, want] of cases) {
  const r = await onRequest(c);
  assert.equal(r.status, want, name);
  if (want === 401) assert.match(r.headers.get('WWW-Authenticate'), /^Basic realm=/, name);
}

const apk = await onRequest(ctx({}, null, '/apk/priv8-8.apk'));
assert.equal(apk.headers.get('Content-Type'), 'application/vnd.android.package-archive');
assert.equal(apk.headers.get('X-Robots-Tag'), 'noindex, nofollow');
const locked = await onRequest(ctx(PW, basic('x:p8-jurado')));
assert.equal(locked.headers.get('Cache-Control'), 'private, no-store');
// rutas profundas de las apps: el index.html de cada una
assert.equal(appDe('/correo/bandeja'), 'correo');
assert.equal(appDe('/correo/correo/3'), 'correo');
assert.equal(appDe('/erp/facturas/alta'), 'erp');
assert.equal(appDe('/correo/assets/index-x.js'), null);
assert.equal(appDe('/correo/factura-octubre.pdf'), null);
assert.equal(appDe('/correo/'), null);
assert.equal(appDe('/docs/entregables/x'), null);
const pedidos = [];
const ASSETS = { fetch: async (req) => { pedidos.push(new URL(req.url).pathname); return new Response('<html>'); } };
const deep = await onRequest({ env: { ASSETS }, next, request: new Request('https://demo.priv8.es/erp/facturas') });
assert.equal(deep.status, 200);
assert.deepEqual(pedidos, ['/erp/']);
console.log(`middleware: ${cases.length + 10} pruebas en verde`);
