// Completa dist/ después de `vite build` con todo lo que enlaza demo.priv8.es. Nada de esto se guarda en git
// dentro de apps/demo-site: se copia en cada build.
//
//   /consola/              build estática de apps/console con BASE_PATH=/consola/ (?feed=sin-protocolo, ?feed=con-protocolo, ?demo)
//   /docs/entregables/     PDF de una cara, diapositivas (HTML y PDF), sus fuentes y los vídeos
//   /brand/logo/           logos que usan las diapositivas y la página en HTML (rutas ../../brand/logo/)
//   /apk/                  APK de depuración: app Priv8 y los tres bancos (./gradlew assembleDebug)
//   /archivos.json         tamaño de cada archivo copiado, para las tarjetas
//
// PRIV8_APK=skip no compila las APK y copia las que ya haya. Gradle necesita JAVA_HOME (JDK 17) y ANDROID_HOME.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

// 1. consola bajo /consola/
const CONSOLE = join(ROOT, 'apps/console');
if (!existsSync(join(CONSOLE, 'node_modules'))) run('pnpm install --frozen-lockfile', CONSOLE);
run(`pnpm exec vite build --outDir "${join(DIST, 'consola')}" --emptyOutDir`, CONSOLE, { BASE_PATH: '/consola/' });
for (const f of ['sin-protocolo.json', 'con-protocolo.json', 'demo.json']) {
  if (!existsSync(join(DIST, 'consola', f))) throw new Error(`La consola no trae ${f}`);
}
log('consola en /consola/');

// 2. entregables y logos
cpSync(join(ROOT, 'docs/entregables'), join(DIST, 'docs/entregables'), { recursive: true });
cpSync(join(ROOT, 'brand/logo'), join(DIST, 'brand/logo'), { recursive: true });
log('entregables en /docs/entregables/ y logos en /brand/logo/');

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

// 4. tamaños para las tarjetas y comprobación del límite por archivo
const sizes = {};
const walk = (d) => readdirSync(d).forEach((n) => {
  const p = join(d, n); const s = statSync(p);
  if (s.isDirectory()) return walk(p);
  const rel = relative(DIST, p).split('\\').join('/');
  if (s.size > MAX) throw new Error(`${rel} pesa más de 25 MiB, el límite de Cloudflare Pages`);
  if (rel.startsWith('apk/') || rel.startsWith('docs/')) sizes[rel] = s.size;
});
walk(DIST);
writeFileSync(join(DIST, 'archivos.json'), JSON.stringify(sizes, null, 2));
log(`archivos.json con ${Object.keys(sizes).length} archivos`);
