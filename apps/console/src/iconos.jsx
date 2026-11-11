// Iconos de la consola: trazos de 24 px, sin relleno, en el color del texto. Uno por cada cosa que
// hace 8 (lee, pulsa, escribe, pregunta al oráculo...) y por cada estado (bloqueado, espera, aprobado).
const D = {
  ojo: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
  apartar: 'M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.4 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.3-1M9.9 10a2.8 2.8 0 0 0 4 4',
  pulsa: 'M9 11.5V5.2a1.7 1.7 0 0 1 3.4 0v5.3M12.4 10V8.7a1.7 1.7 0 0 1 3.4 0V11M15.8 10.4a1.7 1.7 0 0 1 3.2.8v3.3c0 3.6-2.6 6.5-6.2 6.5h-1c-2 0-3.4-.8-4.6-2.4l-2.6-3.9a1.6 1.6 0 0 1 2.6-1.9L9 14',
  escribe: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5zM7 10h.01M11 10h.01M15 10h.01M8 14h8',
  oraculo: 'M12 4v16M8 20h8M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0zM19 7l-2.5 6a3 3 0 0 0 5 0z',
  bloqueo: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6zM9.5 9.5l5 5M14.5 9.5l-5 5',
  escudo: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6zM8.8 12.2l2.2 2.2 4.4-4.6',
  espera: 'M7 3h10M7 21h10M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l2.4-2.3A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.6-3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2V21',
  aprobado: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12.3l2.7 2.7L16.2 9.5',
  rechazado: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 9l6 6M15 9l-6 6',
  encargo: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z',
  dice: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2',
  piensa: 'M12 3.5l1.6 4.3 4.4 1.6-4.4 1.6L12 15.3l-1.6-4.3L6 9.4l4.4-1.6zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  fin: 'M5 21V4M5 4.5h11l-2 4 2 4H5',
  alarma: 'M12 3.5l9.5 16.5h-19zM12 10v4.5M12 17.2v.01',
  llama: 'M5 4h3.5l1.8 4.5-2.3 1.4a10.5 10.5 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.5 1.5C10.5 20.5 3.5 13.5 3.5 5.5A1.5 1.5 0 0 1 5 4z',
  abre: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM4 9h16',
  desplaza: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4',
  envia: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  vuelve: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1',
  tecla: 'M5 8h14v9H5zM8 11h.01M12 11h.01M16 11h.01M9 14h6',
  candado: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  registro: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  ficha: 'M4 6h16v12H4zM8 10h.01M11 10h5M8 14h8',
  tiempo: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  pasos: 'M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10',
  token: 'M8 6l-5 6 5 6M16 6l5 6-5 6',
  correo: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5zM4 6.5l8 6 8-6',
  banco: 'M3 9.5L12 4l9 5.5M5 10v7M9.7 10v7M14.3 10v7M19 10v7M3.5 20h17',
  movil: 'M7 3.5A1.5 1.5 0 0 1 8.5 2h7A1.5 1.5 0 0 1 17 3.5v17a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20.5zM11 18.5h2',
  terminal: 'M3.5 5.5A1.5 1.5 0 0 1 5 4h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5zM7 9l3 3-3 3M12.5 15H17',
  llave: 'M14.5 4a5.5 5.5 0 1 1-3.8 9.5L4 20.2V17h2.5v-2.5H9l1.6-1.6A5.5 5.5 0 0 1 14.5 4zM16 8.2v.01',
  descarga: 'M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2',
  codigo: 'M9 7l-5 5 5 5M15 7l5 5-5 5M13.5 4.5l-3 15',
  web: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  enchufe: 'M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4',
  presentacion: 'M3.5 4.5h17M5 4.5v10a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-10M12 16v4M8.5 20.5h7M9 12l2.5-2.5 2 2L16 9',
  graba: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  play: 'M8 5l11 7-11 7z',
  flecha: 'M5 12h13M13 6l6 6-6 6',
  sale: 'M8 16L16 8M9 8h7v7',
  consola: 'M3.5 5.5A1.5 1.5 0 0 1 5 4h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 8.5h17M12 8.5V20',
  persona: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  real: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.5 15.5l7-7',
}

export default function Icono({ n, className = 'ico', titulo }) {
  const d = D[n] ?? D.pulsa
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden={titulo ? undefined : 'true'} role={titulo ? 'img' : undefined} aria-label={titulo}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// El icono de cada línea del razonamiento (tipo de vivo.lineaDe y, en las acciones, la operación).
const POR_OP = { tap: 'pulsa', type: 'escribe', open_app: 'abre', send: 'envia', scroll: 'desplaza', back: 'vuelve', key: 'tecla', call: 'llama' }
const POR_TIPO = {
  encargo: 'encargo', piensa: 'piensa', dice: 'dice', paso: null, fin: 'fin', observa: 'ojo', oraculo: 'oraculo',
  bloqueo: 'bloqueo', espera: 'espera', aprobado: 'aprobado', rechazado: 'rechazado', pausa: 'apartar',
}
export const iconoDeLinea = (l) => (l.tipo === 'accion' ? POR_OP[l.op] ?? 'pulsa' : POR_TIPO[l.tipo] ?? null)
