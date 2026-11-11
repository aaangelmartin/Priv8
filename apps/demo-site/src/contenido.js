/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';

/* Los casos preparados (#187): uno por grabación, en el catálogo común de data/casos.json (lo leen también el panel
   local y los grabadores). Cada uno abre la consola real reproduciendo su sesión grabada (?feed=...). */
import catalogo from '../../../data/casos.json';

/* Cómo se dibuja cada caso en su tarjeta: la cara de 8 (un modo del motor de ojos), el camino que recorre (iconos de
   apps/console/src/iconos.jsx) y lo que pasa con el dato. `dato`: el valor real y el token que recibe el modelo;
   `claro`, si el modelo lo recibe tal cual; `nunca`, si no sale nunca. `fin`: cómo acaba, con su tono. */
const VISUAL = {
  'b2b-factura': { cara: 'leer', camino: ['correo', 'abre', 'oraculo'], dato: { real: '1.254,30 €', tok: '‹IMPORTE_1›' }, fin: { tono: 'aviso', ico: 'espera', txt: 'Espera tu confirmación' } },
  'b2b-respuesta': { cara: 'hablar', camino: ['correo', 'escribe', 'envia'], dato: { real: 'F-2026-0412', tok: '‹FACTURA_1›' }, fin: { tono: 'aviso', ico: 'espera', txt: 'Espera tu confirmación' } },
  'b2b-iban': { cara: 'enfado', camino: ['correo', 'abre', 'bloqueo'], dato: { real: 'ES42 9100 0005…', tok: '‹IBAN_1-correo›' }, fin: { tono: 'bad', ico: 'alarma', txt: 'Bloqueado y alarma' } },
  'b2b-sin-protocolo': { cara: 'miedo', camino: ['correo', 'abre', 'real'], dato: { real: 'ES91 2100 0418…', claro: true }, fin: { tono: 'bad', ico: 'real', txt: 'Datos reales al modelo' } },
  'b2c-saldo': { cara: 'pensar', camino: ['banco', 'banco', 'banco', 'oraculo'], dato: { real: '17.977,98 €', tok: '‹SUMA_1›' }, fin: { tono: 'ok', ico: 'dice', txt: 'La cifra, en voz local' } },
  'b2c-broker': { cara: 'apartar', camino: ['banco', 'escribe', 'espera', 'apartar'], dato: { real: '200 €', tok: '‹IMPORTE_1›' }, fin: { tono: 'aviso', ico: 'dice', txt: 'Confirmas por voz' } },
  'b2c-asesoria': { cara: 'negar', camino: ['encargo', 'bloqueo'], dato: null, fin: { tono: 'bad', ico: 'rechazado', txt: 'No llega al modelo' } },
  'b2c-clave': { cara: 'nuncasale', camino: ['banco', 'candado', 'apartar'], dato: { real: 'Alcor-2026', nunca: true }, fin: { tono: 'bad', ico: 'candado', txt: 'Nunca sale' } },
};

export const CASOS = catalogo.casos.map((c) => ({ ...c, href: `/consola/?feed=${c.feed}`, visual: VISUAL[c.id] ?? { cara: 'mirar', camino: [], dato: null, fin: null } }));
export const VERTICALES = [
  { id: 'b2b', title: 'Priv8 para empresas', what: 'ERP antiguo y correo', ico: 'abre' },
  { id: 'b2c', title: '8 en tu móvil', what: 'Tres bancos, por voz', ico: 'movil' },
];

/* `acceso`: usuario, clave y código SMS inventados de cada banco simulado. */
export const APKS = [
  { title: 'Priv8', what: 'La app de 8', href: '/apk/priv8-8.apk', file: 'apk/priv8-8.apk', ocho: true },
  { title: 'Banca Alcor', acceso: ['angel.martin', 'Alcor-2026', '482913'], href: '/apk/banca-alcor.apk', file: 'apk/banca-alcor.apk', color: '#1f6f5c' },
  { title: 'Brezo Banco', acceso: ['amartin', 'Brezo-2026', '730518'], href: '/apk/brezo-banco.apk', file: 'apk/brezo-banco.apk', color: '#8a4b2a' },
  { title: 'Nimbo Bróker', acceso: ['angel.m', 'Nimbo-2026', '215664'], href: '/apk/nimbo-broker.apk', file: 'apk/nimbo-broker.apk', color: '#3b4a8f' },
];

export const INSTALAR = `adb install -r -g priv8-8.apk
adb install -r banca-alcor.apk
adb install -r brezo-banco.apk
adb install -r nimbo-broker.apk
adb shell settings put secure enabled_accessibility_services \\
  es.priv8.ocho/.Priv8AccessibilityService
adb shell settings put secure accessibility_enabled 1`;

/* La presentación del jurado, en la web (apps/landing/pitch). El PDF está en docs/entregables/priv8-presentacion.pdf. */
export const PRESENTACION_URL = 'https://priv8.es/pitch/';

/* Enlaces, en dos grupos. Cada uno: etiqueta corta, título, una línea y la dirección. `pending` sale en lugar del
   enlace mientras no exista. */
export const ENLACES = [
  { group: 'La demo', items: [
    { ico: 'abre', tag: 'Consola', title: 'Registrar la factura', what: 'B2B: una sesión real grabada, lo que ves tú junto a lo que ve el modelo.', href: '/consola/?feed=sesion-b2b-factura' },
    { ico: 'movil', tag: 'Consola', title: 'Pasa 200 € al bróker', what: 'B2C: confirmación por voz y 8 mirando a otro lado.', href: '/consola/?feed=sesion-b2c-broker' },
    { ico: 'real', tag: 'Consola', title: 'Sin protocolo', what: 'El mismo trámite sin Priv8 CUA: el modelo recibe los datos reales.', href: '/consola/?feed=sin-protocolo' },
    { ico: 'presentacion', tag: 'Jurado', title: 'Presentación', what: 'La del jurado.', href: PRESENTACION_URL, pending: true },
  ] },
  { group: 'El proyecto', items: [
    { ico: 'codigo', tag: 'Código', title: 'Repositorio', what: 'GitHub, con el README para ejecutarlo.', href: REPO },
    { ico: 'web', tag: 'Web', title: 'priv8.es', what: 'Qué ve 8, cómo funciona y para quién es.', href: 'https://priv8.es' },
    { ico: 'enchufe', tag: 'MCP', title: 'Con tu asistente', what: 'mcp.priv8.es, con tu modelo y tu clave.', href: 'https://mcp.priv8.es' },
    { ico: 'jurado', tag: 'Jurado', title: 'Presentación', what: 'La del jurado, con 8 en directo. priv8.es/pitch', href: PRESENTACION_URL },
  ] },
];

/* Córrelo en tu máquina: los pasos, cada uno con su orden y su enlace al README. */
const README = `${REPO}#`;
export const PASOS = [
  { n: '1', ico: 'descarga', title: 'Clona y prepara', what: 'Python con uv; Node y pnpm para las apps web.', cmd: 'git clone https://github.com/aaangelmartin/Priv8\ncd Priv8 && uv sync && make web-install',
    link: { label: 'Instalación', href: `${README}instalación` } },
  { n: '2', ico: 'play', title: 'Sin clave, ya funciona', what: 'El núcleo real con respuestas grabadas del modelo: cero valores reales al modelo.', cmd: 'make demo',
    link: { label: 'Sin claves', href: `${README}1-sin-claves` } },
  { n: '3', ico: 'llave', title: 'Tu clave, en .env', what: 'Para 8 en vivo con Claude. Límites de gasto por encargo y por sesión.', cmd: 'cp .env.example .env',
    link: { label: '.env.example', href: `${REPO}/blob/main/.env.example` } },
  { n: '4', ico: 'pulsa', title: 'Doble clic y listo', what: 'Demo Priv8.command abre el panel: B2B o B2C con un botón y estos mismos casos en un clic.', cmd: 'make panel',
    link: { label: 'Demo Priv8.command', href: `${REPO}/blob/main/Demo%20Priv8.command` } },
];
export const MAS = [
  { ico: 'movil', tag: 'B2C', title: 'El emulador', what: 'scripts/movil.sh prepara el AVD, las APK y los puertos.', href: `${README}3-b2c-en-el-emulador` },
  { ico: 'enchufe', tag: 'MCP', title: 'En tu asistente', what: 'Priv8 CUA como servidor MCP, con una línea.', href: 'https://mcp.priv8.es' },
  { ico: 'graba', tag: 'Grabar', title: 'Tus propios casos', what: 'make grabar-casos graba todos los casos de esta página.', href: `${REPO}/tree/main/apps/console#readme` },
];

export const EQUIPO = [
  { name: 'Ángel Martín', user: 'aaangelmartin', role: 'Agente, Android, voz y diseño' },
  { name: 'Pablo Rojo', user: 'rrojjo', role: 'Núcleo del protocolo' },
  { name: 'Álvaro Carpintero', user: 'alvaarocl', role: 'ERP, correo, consola y telefonía' },
  { name: 'Marco Barroso', user: 'marcoobarroso', role: 'App 8 y bancos simulados' },
];
