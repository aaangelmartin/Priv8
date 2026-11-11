/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';

/* Los casos preparados (#187): uno por grabación, en el catálogo común de data/casos.json (lo leen también el panel
   local y los grabadores). Cada uno abre la consola real reproduciendo su sesión grabada (?feed=...). */
import catalogo from '../../../data/casos.json';

export const CASOS = catalogo.casos.map((c) => ({ ...c, href: `/consola/?feed=${c.feed}` }));
export const VERTICALES = [
  { id: 'b2b', title: 'Priv8 para empresas', what: 'La factura de un proveedor, en un ERP antiguo y el correo.' },
  { id: 'b2c', title: '8 en tu móvil', what: 'Tres bancos en el emulador de Android, por voz.' },
];

export const APKS = [
  { title: 'Priv8', what: 'La app de 8.', href: '/apk/priv8-8.apk', file: 'apk/priv8-8.apk' },
  { title: 'Banca Alcor', what: 'angel.martin, Alcor-2026, SMS 482913', href: '/apk/banca-alcor.apk', file: 'apk/banca-alcor.apk' },
  { title: 'Brezo Banco', what: 'amartin, Brezo-2026, SMS 730518', href: '/apk/brezo-banco.apk', file: 'apk/brezo-banco.apk' },
  { title: 'Nimbo Bróker', what: 'angel.m, Nimbo-2026, SMS 215664', href: '/apk/nimbo-broker.apk', file: 'apk/nimbo-broker.apk' },
];

export const INSTALAR = `adb install -r -g priv8-8.apk
adb install -r banca-alcor.apk
adb install -r brezo-banco.apk
adb install -r nimbo-broker.apk
adb shell settings put secure enabled_accessibility_services \\
  es.priv8.ocho/.Priv8AccessibilityService
adb shell settings put secure accessibility_enabled 1`;

/* La presentación del jurado la preparan Marco y Álvaro. Cuando esté publicada, poner aquí su dirección. */
export const PRESENTACION_URL = null;

/* Enlaces, en dos grupos. Cada uno: etiqueta corta, título, una línea y la dirección. `pending` sale en lugar del
   enlace mientras no exista. */
export const ENLACES = [
  { group: 'La demo', items: [
    { tag: 'Consola', title: 'Registrar la factura', what: 'B2B: una sesión real grabada, lo que ves tú junto a lo que ve el modelo.', href: '/consola/?feed=sesion-b2b-factura' },
    { tag: 'Consola', title: 'Pasa 200 € al bróker', what: 'B2C: confirmación por voz y 8 mirando a otro lado.', href: '/consola/?feed=sesion-b2c-broker' },
    { tag: 'Consola', title: 'Sin protocolo', what: 'El mismo trámite sin Priv8 CUA: el modelo recibe los datos reales.', href: '/consola/?feed=sin-protocolo' },
    { tag: 'Jurado', title: 'Presentación', what: 'La del jurado.', href: PRESENTACION_URL, pending: true },
  ] },
  { group: 'El proyecto', items: [
    { tag: 'Código', title: 'Repositorio', what: 'GitHub, con el README para ejecutarlo.', href: REPO },
    { tag: 'Web', title: 'priv8.es', what: 'Qué ve 8, cómo funciona y para quién es.', href: 'https://priv8.es' },
    { tag: 'MCP', title: 'Con tu Claude Code', what: 'mcp.priv8.es, con tu modelo y tu clave.', href: 'https://mcp.priv8.es' },
  ] },
];

/* Córrelo en tu máquina: los pasos, cada uno con su orden y su enlace al README. */
const README = `${REPO}#`;
export const PASOS = [
  { n: '1', title: 'Clona y prepara', what: 'Python con uv; Node y pnpm para las apps web.', cmd: 'git clone https://github.com/aaangelmartin/Priv8\ncd Priv8 && uv sync && make web-install',
    link: { label: 'Instalación', href: `${README}instalación` } },
  { n: '2', title: 'Sin clave, ya funciona', what: 'El núcleo real con respuestas grabadas del modelo: cero valores reales al modelo.', cmd: 'make demo',
    link: { label: 'Sin claves', href: `${README}1-sin-claves` } },
  { n: '3', title: 'Tu clave, en .env', what: 'Para 8 en vivo con Claude. Límites de gasto por encargo y por sesión.', cmd: 'cp .env.example .env',
    link: { label: '.env.example', href: `${REPO}/blob/main/.env.example` } },
  { n: '4', title: 'Doble clic y listo', what: 'Demo Priv8.command abre el panel: B2B o B2C con un botón y estos mismos casos en un clic.', cmd: 'make panel',
    link: { label: 'Demo Priv8.command', href: `${REPO}/blob/main/Demo%20Priv8.command` } },
];
export const MAS = [
  { tag: 'B2C', title: 'El emulador', what: 'scripts/movil.sh prepara el AVD, las APK y los puertos.', href: `${README}3-b2c-en-el-emulador` },
  { tag: 'MCP', title: 'En tu Claude Code', what: 'Priv8 CUA como servidor MCP, con una línea.', href: 'https://mcp.priv8.es' },
  { tag: 'Grabar', title: 'Tus propios casos', what: 'make grabar-casos graba todos los casos de esta página.', href: `${REPO}/tree/main/apps/console#readme` },
];

export const EQUIPO = [
  { name: 'Ángel Martín', user: 'aaangelmartin', role: 'Agente, Android, voz y diseño' },
  { name: 'Pablo Rojo', user: 'rrojjo', role: 'Núcleo del protocolo' },
  { name: 'Álvaro Carpintero', user: 'alvaarocl', role: 'ERP, correo, consola y telefonía' },
  { name: 'Marco Barroso', user: 'marcoobarroso', role: 'App 8 y bancos simulados' },
];
