/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';
const README = `${REPO}#`;

/* Los casos salen del catálogo común (data/casos.json, #187), que leen también el panel local y los grabadores. */
import catalogo from '../../../data/casos.json';
const delCatalogo = (id) => catalogo.casos.find((c) => c.id === id) ?? {};

/* Priv8 para empresas: cada caso abre la consola real reproduciendo su sesión grabada (?feed=...), con las pantallas
   reales de Alba Core y del correo junto a la vista de 8. `img`: un fotograma real de esa grabación. */
export const EMPRESAS = [
  { id: 'b2b-factura', titulo: 'Registrar la factura', linea: 'Lee el correo del proveedor, rellena el alta en Alba Core con tokens y espera tu sí.' },
  { id: 'b2b-respuesta', titulo: 'Contestar al proveedor', linea: 'Escribe la respuesta sin ver ningún dato y no la envía hasta que la apruebas.' },
  { id: 'b2b-iban', titulo: 'Cambio de IBAN bloqueado', linea: 'El IBAN que llega por correo no entra en el campo de pago. Salta la alarma de fraude.',
    nota: 'Simula un modelo engañado por el correo.' },
].map((c) => ({ ...c, pedido: delCatalogo(c.id).pedido, href: `/consola/?feed=${delCatalogo(c.id).feed}`, img: `/casos/${c.id}.jpg` }));

/* Priv8 en el móvil: cada caso es una grabación del emulador (vídeo) con lo que recibió el modelo en cada paso
   (public/movil/<id>.json, scripts/grabar_movil_video.py). */
export const MOVIL = [
  { id: 'b2c-saldo', titulo: '¿Cuánto tengo?', linea: 'Recorre los tres bancos y suma sin ver los saldos. La cifra la dice la voz del móvil.' },
  { id: 'b2c-broker', titulo: 'Pasa 200 € al bróker', linea: 'Prepara la transferencia, te pide confirmación y mira a otro lado mientras pones el código.' },
  { id: 'b2c-asesoria', titulo: '¿En qué invierto?', linea: 'No da consejo de inversión: la petición no llega al modelo.' },
  { id: 'b2c-clave', titulo: 'La clave nunca sale', linea: 'En la entrada del banco, usuario y clave no llegan al modelo. Entras tú.' },
].map((c) => ({ ...c, pedido: delCatalogo(c.id).pedido, datos: `/movil/${c.id}.json`, img: `/movil/${c.id}.jpg` }));

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

/* Córrelo en tu máquina (Priv8 para empresas): las mismas órdenes del README. */
export const PASOS_EMPRESAS = [
  { n: 1, title: 'Prepara', text: 'Python con uv; Node y pnpm para las apps web.',
    cmd: 'git clone https://github.com/aaangelmartin/Priv8\ncd Priv8 && uv sync && make web-install' },
  { n: 2, title: 'Sin clave', text: 'El núcleo real con las respuestas del modelo grabadas. Al final, cero valores reales enviados.',
    cmd: 'make demo' },
  { n: 3, title: 'En directo, con un botón', text: 'Con tu clave en .env, doble clic en Demo Priv8.command en macOS, o el panel desde la terminal.',
    cmd: 'cp .env.example .env\nmake panel' },
];
export const README_URL = `${README}ejecución`;

/* Enlaces del final: una fila de píldoras. */
export const ENLACES = [
  { title: 'Presentación', href: 'https://priv8.es/pitch' },
  { title: 'priv8.es', href: 'https://priv8.es' },
  { title: 'mcp.priv8.es', href: 'https://mcp.priv8.es' },
  { title: 'Repositorio', href: REPO },
  { title: 'Especificación', href: `${REPO}/blob/main/docs/SPEC.md` },
  { title: 'Alba Core', href: '/erp/' },
  { title: 'El correo', href: '/correo/' },
];
