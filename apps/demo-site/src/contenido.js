/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';

/* Vídeo de la demo B2C. Cuando exista, poner aquí su ruta sin extensión (con .mp4 y, si hay, .webm al lado), por
   ejemplo '/docs/entregables/video/b2c'; assemble.mjs ya copia docs/entregables/video entero. */
export const VIDEO_B2C = null;

export const VIDEOS_B2B = [
  { title: 'Sin protocolo', time: '39 s', what: 'El modelo recibe los datos reales.', base: '/docs/entregables/video/sin-protocolo' },
  { title: 'Con Priv8 CUA', time: '41 s', what: 'Solo tokens; el cambio de IBAN queda bloqueado.', base: '/docs/entregables/video/con-protocolo' },
];

/* Pruébalo tú. B2B: una sola acción, la consola reproduciendo una sesión real grabada (make grabar-sesion): lo que ves
   tú y lo que ve el modelo, el chat con 8 y la confirmación, como en el portátil de la demo. */
export const CONSOLA_B2B = { title: 'Consola de la demo', href: '/consola/?feed=sesion-b2b' };

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

/* La presentación del jurado, en la web (apps/landing/pitch). El PDF está en docs/entregables/priv8-presentacion.pdf. */
export const PRESENTACION_URL = 'https://priv8.es/pitch/';

/* Enlaces, en dos grupos. Cada uno: etiqueta corta, título, una línea y la dirección. `pending` sale en lugar del
   enlace mientras no exista. */
export const ENLACES = [
  { group: 'La demo', items: [
    { tag: 'Vídeo', title: 'B2B sin protocolo', what: 'El modelo recibe los datos reales. 39 s.', href: '/docs/entregables/video/sin-protocolo.mp4' },
    { tag: 'Vídeo', title: 'B2B con Priv8 CUA', what: 'Solo tokens; el cambio de IBAN, bloqueado. 41 s.', href: '/docs/entregables/video/con-protocolo.mp4' },
    { tag: 'Vídeo', title: 'B2C, 8 en el móvil', what: 'Por voz, en el emulador.', href: VIDEO_B2C && `${VIDEO_B2C}.mp4`, pending: true },
    { tag: 'App', title: 'Consola de la demo', what: 'Una sesión real grabada: lo que ves tú y lo que ve el modelo.', href: '/consola/?feed=sesion-b2b' },
  ] },
  { group: 'El proyecto', items: [
    { tag: 'Código', title: 'Repositorio', what: 'GitHub, con el README para ejecutarlo.', href: REPO },
    { tag: 'Web', title: 'priv8.es', what: 'Qué ve 8, cómo funciona y para quién es.', href: 'https://priv8.es' },
    { tag: 'MCP', title: 'Con tu Claude Code', what: 'mcp.priv8.es, con tu modelo y tu clave.', href: 'https://mcp.priv8.es' },
    { tag: 'Jurado', title: 'Presentación', what: 'La del jurado, con 8 en directo. priv8.es/pitch', href: PRESENTACION_URL },
  ] },
];


export const EQUIPO = [
  { name: 'Ángel Martín', user: 'aaangelmartin', role: 'Agente, Android, voz y diseño' },
  { name: 'Pablo Rojo', user: 'rrojjo', role: 'Núcleo del protocolo' },
  { name: 'Álvaro Carpintero', user: 'alvaarocl', role: 'ERP, correo, consola y telefonía' },
  { name: 'Marco Barroso', user: 'marcoobarroso', role: 'App 8 y bancos simulados' },
];
