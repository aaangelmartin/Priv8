/* Todo lo que enlaza demo.priv8.es. Las rutas que empiezan por / las copia scripts/assemble.mjs en dist/ al compilar;
   `file` es la ruta que se busca en /archivos.json para enseñar el tamaño o avisar si falta en esta build. */
export const REPO = 'https://github.com/aaangelmartin/Priv8';
const README = `${REPO}/blob/main/README.md`;

export const VER = [
  {
    kind: 'Consola', time: '35 s', title: 'El trámite sin protocolo',
    what: 'Llega la factura de un proveedor y un agente normal la registra en el ERP. La banda noche avisa: el modelo recibe los datos reales, marcados en rojo, y la cuenta llega a 6 valores reales enviados.',
    href: '/consola/?feed=sin-protocolo', cta: 'Abrir la reproducción', tone: 'bad',
  },
  {
    kind: 'Consola', time: '37 s', title: 'El mismo trámite con Priv8 CUA',
    what: 'La misma ejecución con el protocolo. El modelo trabaja con tokens, el cambio de IBAN del correo queda bloqueado, hay tres confirmaciones y 0 valores reales al modelo.',
    sample: ['ES43 9100 0001 5740 1234 5678', '‹IBAN_1-propio›'],
    href: '/consola/?feed=con-protocolo', cta: 'Abrir la reproducción', tone: 'ok',
  },
  {
    kind: 'Consola', time: '1 min', title: 'Ensayo con confirmaciones',
    what: 'Los mensajes reales del núcleo en el flujo de la factura con la trampa del IBAN. Aquí las confirmaciones las apruebas o rechazas tú, en pantalla.',
    href: '/consola/?demo', cta: 'Abrir el ensayo',
  },
];

export const VIDEOS = [
  { title: 'Sin protocolo', time: '41 s', what: 'La grabación de la consola sin Priv8: todo en claro.', base: '/docs/entregables/video/sin-protocolo', file: 'docs/entregables/video/sin-protocolo.mp4' },
  { title: 'Con protocolo', time: '39 s', what: 'La misma grabación con Priv8 CUA: solo tokens, bloqueos y confirmaciones.', base: '/docs/entregables/video/con-protocolo', file: 'docs/entregables/video/con-protocolo.mp4' },
];

export const LEER = [
  { kind: 'PDF', time: '2 min', title: 'Una cara', what: 'Problema, solución y valor diferencial en una página.', href: '/docs/entregables/priv8-una-cara.pdf', file: 'docs/entregables/priv8-una-cara.pdf', cta: 'Abrir el PDF', alt: ['Versión HTML', '/docs/entregables/una-cara.html'] },
  { kind: 'Diapositivas', time: '5 min', title: 'La presentación', what: 'Las nueve diapositivas del jurado. La versión HTML se pasa con las flechas del teclado.', href: '/docs/entregables/diapositivas.html', cta: 'Abrir en HTML', alt: ['Descargar PDF', '/docs/entregables/priv8-diapositivas.pdf'], file: 'docs/entregables/priv8-diapositivas.pdf' },
  { kind: 'Web', time: '5 min', title: 'priv8.es', what: 'La web del producto: qué ve 8, cómo funciona el protocolo, para quién es y las preguntas de un responsable de seguridad.', href: 'https://priv8.es', cta: 'Abrir la web', ext: true },
  { kind: 'Código', time: '10 min', title: 'El repositorio', what: 'Núcleo, agente, adaptadores, apps simuladas, contratos y pruebas. El README explica requisitos, instalación y ejecución.', href: REPO, cta: 'Abrir en GitHub', ext: true, alt: ['Leer el README', README], note: 'Si no tienes acceso, pídeselo al equipo.' },
];

export const APKS = [
  { title: 'Priv8', pkg: 'es.priv8.ocho', what: 'La app de 8: sus ojos, la voz, las confirmaciones habladas y el servicio de accesibilidad que lee la pantalla.', href: '/apk/priv8-8.apk', file: 'apk/priv8-8.apk' },
  { title: 'Banca Alcor', pkg: 'es.priv8.banks.alcor', what: 'Cuenta nómina con un movimiento trampa: un concepto con instrucciones y un IBAN ajeno.', href: '/apk/banca-alcor.apk', file: 'apk/banca-alcor.apk', login: ['angel.martin', 'Alcor-2026', '482913'] },
  { title: 'Brezo Banco', pkg: 'es.priv8.banks.brezo', what: 'Una cuenta online. Sirve para sumar lo que tienes entre bancos.', href: '/apk/brezo-banco.apk', file: 'apk/brezo-banco.apk', login: ['amartin', 'Brezo-2026', '730518'] },
  { title: 'Nimbo Bróker', pkg: 'es.priv8.banks.nimbo', what: 'El efectivo del bróker, destino de «Pasa 200 € al bróker».', href: '/apk/nimbo-broker.apk', file: 'apk/nimbo-broker.apk', login: ['angel.m', 'Nimbo-2026', '215664'] },
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
    what: 'El núcleo real con las respuestas del modelo grabadas: la factura B2B y la transferencia B2C en la terminal, con el registro firmado al final.',
    cmd: 'make demo', href: `${README}#las-dos-escenas-de-la-demo-sin-claves`,
  },
  {
    kind: 'B2B en vivo', time: '10 min de montaje', title: 'ERP, correo y consola',
    what: 'Alba Core, la bandeja de correo y la consola en local, con Claude en vivo. 8 registra la factura, contesta el correo y bloquea el cambio de IBAN.',
    cmd: 'make web-install\nmake demo-b2b', needs: 'ANTHROPIC_API_KEY en .env', href: `${README}#b2b-en-vivo-erp-correo-y-consola`,
  },
  {
    kind: 'B2C en vivo', time: '15 min de montaje', title: '8 en el móvil',
    what: 'El emulador con las cuatro apps, el puente por adb reverse y el agente. Pregunta «¿Cuánto tengo entre mis bancos?» o pide «Pasa 200 € al bróker».',
    cmd: 'scripts/movil.sh\nmake agent-android', needs: 'Android Studio, un AVD y ANTHROPIC_API_KEY', href: `${README}#android-b2c`,
  },
  {
    kind: 'Claude Code', time: '10 min', title: 'Pruébalo con tu Claude Code',
    what: 'Priv8 CUA es un servidor MCP. Conéctalo a tu Claude Code y usa las apps de la demo con tu propio modelo y tu propia clave.',
    href: 'https://mcp.priv8.es', cta: 'Abrir mcp.priv8.es', ext: true, alt: ['En el README', `${README}#usar-priv8-desde-claude-code`],
  },
];

export const EQUIPO = [
  { name: 'Ángel Martín', user: 'aaangelmartin', role: 'Agente, Android, voz y diseño' },
  { name: 'Pablo Rojo', user: 'rrojjo', role: 'Núcleo del protocolo' },
  { name: 'Álvaro Carpintero', user: 'alvaarocl', role: 'Empresa: ERP, correo, consola y telefonía' },
  { name: 'Marco Barroso', user: 'marcoobarroso', role: 'App 8 y bancos simulados' },
];
