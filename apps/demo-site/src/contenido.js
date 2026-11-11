/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';
const README = `${REPO}/blob/main/README.md`;

export const VER = [
  {
    kind: 'Consola', time: '35 s', title: 'El trámite sin protocolo',
    what: 'Un agente normal registra la factura de un proveedor en el ERP. El modelo recibe 6 datos reales, marcados en rojo.',
    href: '/consola/?feed=sin-protocolo', cta: 'Abrir la reproducción', tone: 'bad',
  },
  {
    kind: 'Consola', time: '37 s', title: 'El mismo trámite con Priv8 CUA',
    what: 'La misma factura con el protocolo: el modelo solo ve tokens y el cambio de IBAN del correo queda bloqueado. 0 datos reales.',
    sample: ['ES43 9100 0001 5740 1234 5678', '‹IBAN_1-propio›'],
    href: '/consola/?feed=con-protocolo', cta: 'Abrir la reproducción', tone: 'ok',
  },
  {
    kind: 'Consola', time: '1 min', title: 'Ensayo con confirmaciones',
    what: 'El mismo flujo, pero las confirmaciones las apruebas o rechazas tú.',
    href: '/consola/?demo', cta: 'Abrir el ensayo',
  },
];

export const VIDEOS = [
  { title: 'Sin protocolo', time: '39 s', what: 'Todo en claro.', base: '/docs/entregables/video/sin-protocolo', file: 'docs/entregables/video/sin-protocolo.mp4' },
  { title: 'Con protocolo', time: '41 s', what: 'Solo tokens, bloqueos y confirmaciones.', base: '/docs/entregables/video/con-protocolo', file: 'docs/entregables/video/con-protocolo.mp4' },
];

export const LEER = [
  { kind: 'PDF', time: '2 min', title: 'Una cara', what: 'Problema, solución y valor diferencial en una página.', href: '/docs/entregables/priv8-una-cara.pdf', file: 'docs/entregables/priv8-una-cara.pdf', cta: 'Abrir el PDF' },
  { kind: 'PDF', time: '5 min', title: 'La presentación', what: 'Las nueve diapositivas del jurado.', href: '/docs/entregables/priv8-diapositivas.pdf', cta: 'Abrir el PDF', file: 'docs/entregables/priv8-diapositivas.pdf' },
  { kind: 'Web', time: '5 min', title: 'priv8.es', what: 'Qué ve 8, cómo funciona el protocolo y para quién es.', href: 'https://priv8.es', cta: 'Abrir la web', ext: true },
  { kind: 'Código', time: '10 min', title: 'El repositorio', what: 'Código, pruebas y el README con la instalación. Si no tienes acceso, pídeselo al equipo.', href: REPO, cta: 'Abrir en GitHub', ext: true },
];

export const APKS = [
  { title: 'Priv8', pkg: 'es.priv8.ocho', what: 'La app de 8: ojos, voz y el servicio que lee la pantalla.', href: '/apk/priv8-8.apk', file: 'apk/priv8-8.apk' },
  { title: 'Banca Alcor', pkg: 'es.priv8.banks.alcor', what: 'Cuenta nómina con un movimiento trampa.', href: '/apk/banca-alcor.apk', file: 'apk/banca-alcor.apk', login: ['angel.martin', 'Alcor-2026', '482913'] },
  { title: 'Brezo Banco', pkg: 'es.priv8.banks.brezo', what: 'Una cuenta online.', href: '/apk/brezo-banco.apk', file: 'apk/brezo-banco.apk', login: ['amartin', 'Brezo-2026', '730518'] },
  { title: 'Nimbo Bróker', pkg: 'es.priv8.banks.nimbo', what: 'Destino de «Pasa 200 € al bróker».', href: '/apk/nimbo-broker.apk', file: 'apk/nimbo-broker.apk', login: ['angel.m', 'Nimbo-2026', '215664'] },
];

export const INSTALAR = `adb install -r -g priv8-8.apk
adb install -r banca-alcor.apk
adb install -r brezo-banco.apk
adb install -r nimbo-broker.apk
adb shell settings put secure enabled_accessibility_services \\
  es.priv8.ocho/.Priv8AccessibilityService
adb shell settings put secure accessibility_enabled 1`;

export const VIVO = [
  {
    kind: 'Sin claves', time: '1 min', title: 'Las dos escenas, grabadas',
    what: 'El núcleo real con respuestas grabadas, en la terminal.',
    cmd: 'make demo', href: `${README}#las-dos-escenas-de-la-demo-sin-claves`,
  },
  {
    kind: 'B2B en vivo', time: '10 min de montaje', title: 'ERP, correo y consola',
    what: 'ERP, correo y consola en local, con Claude en vivo.',
    cmd: 'make web-install\nmake demo-b2b', needs: 'ANTHROPIC_API_KEY en .env', href: `${README}#b2b-en-vivo-erp-correo-y-consola`,
  },
  {
    kind: 'B2C en vivo', time: '15 min de montaje', title: '8 en el móvil',
    what: 'El emulador con las cuatro apps y 8 por voz.',
    cmd: 'scripts/movil.sh\nmake agent-android', needs: 'Android Studio, un AVD y ANTHROPIC_API_KEY', href: `${README}#android-b2c`,
  },
  {
    kind: 'Claude Code', time: '10 min', title: 'Pruébalo con tu Claude Code',
    what: 'Priv8 CUA como servidor MCP, con tu modelo y tu clave.',
    href: 'https://mcp.priv8.es', cta: 'Abrir mcp.priv8.es', ext: true,
  },
];

export const EQUIPO = [
  { name: 'Ángel Martín', user: 'aaangelmartin', role: 'Agente, Android, voz y diseño' },
  { name: 'Pablo Rojo', user: 'rrojjo', role: 'Núcleo del protocolo' },
  { name: 'Álvaro Carpintero', user: 'alvaarocl', role: 'Empresa: ERP, correo, consola y telefonía' },
  { name: 'Marco Barroso', user: 'marcoobarroso', role: 'App 8 y bancos simulados' },
];
