/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';
const README = `${REPO}/blob/main/README.md`;

/* Vídeo de la demo B2C. Cuando exista, poner aquí su ruta sin extensión (con .mp4 y, si hay, .webm al lado), por
   ejemplo '/docs/entregables/video/b2c'; assemble.mjs ya copia docs/entregables/video entero. */
export const VIDEO_B2C = null;

export const VIDEOS_B2B = [
  { title: 'Sin protocolo', time: '39 s', what: 'El modelo recibe los datos reales.', base: '/docs/entregables/video/sin-protocolo' },
  { title: 'Con Priv8 CUA', time: '41 s', what: 'Solo tokens; el cambio de IBAN queda bloqueado.', base: '/docs/entregables/video/con-protocolo' },
];

/* Pruébalo tú. B2B: las pantallas de la demo, alojadas aquí sin agente. */
export const PRUEBA_B2B = [
  { title: 'Correo', what: 'La bandeja con la factura del proveedor y el cambio de IBAN.', href: '/correo/' },
  { title: 'Alba Core', what: 'El ERP, con la sesión de la demo ya abierta.', href: '/erp/' },
  { title: 'Consola con protocolo', what: 'Reproducción de la factura: lo que ve 8, en tokens.', href: '/consola/?feed=con-protocolo' },
  { title: 'Consola sin protocolo', what: 'La misma factura, con todo en claro.', href: '/consola/?feed=sin-protocolo' },
  { title: 'Consola, ensayo', what: 'Las confirmaciones las apruebas tú.', href: '/consola/?demo' },
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

/* Enlaces: todo en una lista, una línea cada uno. `video` apunta al MP4; `pending` sale como «próximamente». */
export const ENLACES = [
  { group: 'Demo', items: [
    { title: 'Vídeo B2B, sin protocolo', note: 'MP4, 39 s', href: '/docs/entregables/video/sin-protocolo.mp4' },
    { title: 'Vídeo B2B, con Priv8 CUA', note: 'MP4, 41 s', href: '/docs/entregables/video/con-protocolo.mp4' },
    { title: 'Vídeo B2C', note: 'MP4', href: VIDEO_B2C && `${VIDEO_B2C}.mp4`, pending: 'Pendiente de grabar' },
    { title: 'Correo', note: '/correo/', href: '/correo/' },
    { title: 'Alba Core', note: '/erp/', href: '/erp/' },
    { title: 'Consola con protocolo', note: '/consola/', href: '/consola/?feed=con-protocolo' },
    { title: 'Consola sin protocolo', note: '/consola/', href: '/consola/?feed=sin-protocolo' },
  ] },
  { group: 'Proyecto', items: [
    { title: 'Repositorio', note: 'GitHub', href: REPO },
    { title: 'Web', note: 'priv8.es', href: 'https://priv8.es' },
    { title: 'Con tu Claude Code', note: 'mcp.priv8.es', href: 'https://mcp.priv8.es' },
    { title: 'Presentación', href: PRESENTACION_URL, pending: 'Próximamente' },
  ] },
];

export const VIVO = [
  { kind: 'Sin claves', time: '1 min', title: 'Las dos escenas, grabadas', what: 'El núcleo real con respuestas grabadas, en la terminal.', cmd: 'make demo', href: `${README}#las-dos-escenas-de-la-demo-sin-claves` },
  { kind: 'B2B en vivo', time: '10 min', title: 'ERP, correo y consola', what: 'Con Claude en vivo. Necesita ANTHROPIC_API_KEY.', cmd: 'make web-install\nmake demo-b2b', href: `${README}#b2b-en-vivo-erp-correo-y-consola` },
  { kind: 'B2C en vivo', time: '15 min', title: '8 en el móvil', what: 'Emulador, cuatro apps y 8 por voz. Necesita ANTHROPIC_API_KEY.', cmd: 'scripts/movil.sh\nmake agent-android', href: `${README}#android-b2c` },
  { kind: 'Claude Code', time: '10 min', title: 'Con tu Claude Code', what: 'Priv8 CUA como servidor MCP, con tu modelo y tu clave.', href: 'https://mcp.priv8.es', cta: 'Abrir mcp.priv8.es' },
];

export const EQUIPO = [
  { name: 'Ángel Martín', user: 'aaangelmartin', role: 'Agente, Android, voz y diseño' },
  { name: 'Pablo Rojo', user: 'rrojjo', role: 'Núcleo del protocolo' },
  { name: 'Álvaro Carpintero', user: 'alvaarocl', role: 'ERP, correo, consola y telefonía' },
  { name: 'Marco Barroso', user: 'marcoobarroso', role: 'App 8 y bancos simulados' },
];
