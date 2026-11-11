// Completa dist/ después de `vite build` con todo lo que enlaza demo.priv8.es. Nada de esto se guarda en git
// dentro de apps/demo-site: se copia en cada build.
//
//   /consola/              build estática de apps/console con BASE_PATH=/consola/: los casos grabados de data/casos.json
//                          (?feed=sesion-<caso>, con sus fotogramas en /consola/sesion-*/), ?feed=sin-protocolo y ?demo
//   /correo/               build estática de apps/inbox-sim (la bandeja), con BASE_PATH=/correo/
//   /erp/                  build estática de apps/erp-sim (Alba Core) con la sesión de la demo ya abierta
//   /equipo/<usuario>.png  foto de perfil de GitHub de cada persona del equipo (si no hay red, iniciales)
//   /apk/                  APK de depuración: app Priv8 y los tres bancos (./gradlew assembleDebug)
//   /archivos.json         tamaño de cada archivo copiado, para las tarjetas
//
// PRIV8_APK=skip no compila las APK y copia las que ya haya. Gradle necesita JAVA_HOME (JDK 17) y ANDROID_HOME.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const ROOT = resolve(SITE, '../..');
const DIST = join(SITE, 'dist');
const MAX = 25 * 1024 * 1024; // límite por archivo de Cloudflare Pages
const log = (m) => console.log(`[assemble] ${m}`);
const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

if (!existsSync(join(DIST, 'index.html'))) throw new Error('Falta dist/index.html: ejecuta antes `vite build`.');

// 1. las tres apps web bajo su ruta. Sin agente detrás: son las mismas pantallas, para verlas y usarlas a mano.
const APPS = [
  ['apps/console', 'consola', {}],
  ['apps/inbox-sim', 'correo', {}],
  ['apps/erp-sim', 'erp', { VITE_ALBA_DEMO: '1', VITE_ALBA_SESION: 'admin.alba' }],
];
for (const [dir, ruta, env] of APPS) {
  const cwd = join(ROOT, dir);
  if (!existsSync(join(cwd, 'node_modules'))) run('pnpm install --frozen-lockfile', cwd);
  run(`pnpm exec vite build --outDir "${join(DIST, ruta)}" --emptyOutDir`, cwd, { BASE_PATH: `/${ruta}/`, ...env });
  log(`${dir} en /${ruta}/`);
}
// Cada caso del catálogo (#187) tiene que llegar con su grabación: sin ella, su pestaña de la web saldría vacía.
const CASOS = JSON.parse(readFileSync(join(ROOT, 'data/casos.json'), 'utf8')).casos;
for (const f of ['sin-protocolo.json', 'con-protocolo.json', 'demo.json', 'sesion-b2b.json', ...CASOS.map((c) => `${c.feed}.json`)]) {
  if (!existsSync(join(DIST, 'consola', f))) throw new Error(`La consola no trae ${f}`);
}
// Las rutas profundas (/correo/bandeja, /erp/facturas...) las sirve el middleware con el index.html de su app
// (functions/_middleware.js): _redirects no vale porque se aplicaría también a los archivos.

// 2. Las grabaciones de la web (public/, ya copiadas por vite): la captura de cada caso de empresa y, de cada caso del
//    móvil, su vídeo del emulador, su póster y lo que vio el modelo (public/movil/<caso>.json).
const SITIO = readFileSync(join(SITE, 'src/contenido.js'), 'utf8');
for (const id of [...SITIO.matchAll(/id: '(b2[bc]-[a-z-]+)'/g)].map((m) => m[1])) {
  if (id.startsWith('b2c') && !existsSync(join(DIST, `movil/${id}.json`))) { log(`AVISO: ${id} sin grabación; la web no lo enseña`); continue; }
  const archivos = id.startsWith('b2b') ? [`casos/${id}.jpg`] : [`movil/${id}.json`, `movil/${id}.jpg`];
  if (id.startsWith('b2c') && existsSync(join(DIST, `movil/${id}.json`))) {
    archivos.push(JSON.parse(readFileSync(join(DIST, `movil/${id}.json`), 'utf8')).video);
  }
  if (id.startsWith('b2c')) archivos.push('movil/index.html');
  for (const f of archivos) if (!existsSync(join(DIST, f))) throw new Error(`La web no trae ${f} (caso ${id})`);
}

// 3. APK
const APKS = [
  ['apps/android-8', 'app/build/outputs/apk/debug/app-debug.apk', 'priv8-8.apk'],
  ['apps/banks-sim', 'build/outputs/apk/alcor/debug/banks-sim-alcor-debug.apk', 'banca-alcor.apk'],
  ['apps/banks-sim', 'build/outputs/apk/brezo/debug/banks-sim-brezo-debug.apk', 'brezo-banco.apk'],
  ['apps/banks-sim', 'build/outputs/apk/nimbo/debug/banks-sim-nimbo-debug.apk', 'nimbo-broker.apk'],
];
if (process.env.PRIV8_APK !== 'skip') {
  for (const dir of new Set(APKS.map(([d]) => d))) {
    try { run('./gradlew -q assembleDebug', join(ROOT, dir)); }
    catch { log(`AVISO: falló ./gradlew assembleDebug en ${dir}; se copian las APK que ya existan`); }
  }
}
mkdirSync(join(DIST, 'apk'), { recursive: true });
for (const [dir, out, name] of APKS) {
  const src = join(ROOT, dir, out);
  if (existsSync(src)) { cpSync(src, join(DIST, 'apk', name)); log(`apk/${name}`); }
  else log(`AVISO: falta ${dir}/${out}; la tarjeta saldrá como «No incluido en esta build»`);
}

// 4. fotos del equipo, copiadas para no enlazar a GitHub desde la página
const EQUIPO = ['aaangelmartin', 'rrojjo', 'alvaarocl', 'marcoobarroso'];
mkdirSync(join(DIST, 'equipo'), { recursive: true });
for (const u of EQUIPO) {
  try {
    const r = await fetch(`https://github.com/${u}.png?size=200`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) throw new Error(String(r.status));
    writeFileSync(join(DIST, 'equipo', `${u}.png`), Buffer.from(await r.arrayBuffer()));
  } catch (e) { log(`AVISO: sin foto de ${u} (${e.message}); salen sus iniciales`); }
}

// 5. tamaños para las tarjetas y comprobación del límite por archivo
const sizes = {};
const walk = (d) => readdirSync(d).forEach((n) => {
  const p = join(d, n); const s = statSync(p);
  if (s.isDirectory()) return walk(p);
  const rel = relative(DIST, p).split('\\').join('/');
  if (s.size > MAX) throw new Error(`${rel} pesa más de 25 MiB, el límite de Cloudflare Pages`);
  if (/^(apk|docs|equipo)\//.test(rel)) sizes[rel] = s.size;
});
walk(DIST);
writeFileSync(join(DIST, 'archivos.json'), JSON.stringify(sizes, null, 2));
log(`archivos.json con ${Object.keys(sizes).length} archivos`);

// 6. ni un punto medio en lo publicado (norma de estilo de la marca)
const conPunto = [];
const busca = (d) => readdirSync(d).forEach((n) => {
  const p = join(d, n);
  if (statSync(p).isDirectory()) return busca(p);
  if (/\.(html|js|css|json|svg|txt)$/.test(n) && readFileSync(p, 'utf8').includes('\u00b7')) conPunto.push(relative(DIST, p));
});
busca(DIST);
if (conPunto.length) throw new Error(`Punto medio en: ${conPunto.join(', ')}`);
log('sin puntos medios');
