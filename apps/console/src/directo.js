// Qué hace 8 ahora mismo, en palabras y con la cara que toca, a partir del registro.
//
// Todo sale de los eventos de auditoría que ya recibe la consola (solo tokens) y de las
// confirmaciones pendientes. El texto `detail` lo escribe el núcleo y puede cambiar: aquí
// solo se mira con patrones amplios y siempre hay una salida por defecto.

export const APP = {
  'alba-core': 'Alba Core', inbox: 'Correo',
  'es.priv8.banks.alcor': 'Banca Alcor', 'banca-alcor': 'Banca Alcor',
  'es.priv8.banks.brezo': 'Brezo Banco', 'brezo-banco': 'Brezo Banco',
  'es.priv8.banks.nimbo': 'Nimbo Bróker', 'nimbo-broker': 'Nimbo Bróker',
  'es.priv8.ocho': '8',
}
export const nombreApp = (a) => APP[a] ?? a ?? ''

const PANTALLA = {
  'factura.alta': 'alta de factura',
  'proveedor.ficha': 'ficha del proveedor',
  bandeja: 'bandeja de entrada',
  'correo.lectura': 'un correo',
  'correo.respuesta': 'respuesta al correo',
  factura: 'factura',
  confirmacion: 'confirmación',
  inicio: 'inicio',
  login: 'acceso',
  movimientos: 'movimientos',
  transferencia: 'transferencia',
  revision: 'revisión',
  autenticacion: 'autenticación',
  resultado: 'resultado',
}
export const nombrePantalla = (s) => PANTALLA[s] ?? s ?? ''

// Inicio, fin y pasos del encargo, mirando solo patrones amplios del detalle.
const ES_INICIO = /recib|inicio/i
const ES_FIN = /^fin\b|l[ií]mite|error|end_turn|refusal|max_tokens/i
const PASO = /paso\s+(\d+)/i
// model_saw de un paso con herramientas: «act {...}; observe {...}».
const ES_LLAMADA = /^(observe|act|oracle)\b|\{"/

const motivoFin = (d = '') => (/l[ií]mite/i.test(d) ? 'limite' : /error/i.test(d) ? 'error' : /refusal/i.test(d) ? 'rechazo' : 'hecho')

// El encargo en curso (o el último): desde cuándo, cuántos pasos y cómo acabó.
// Cada evento puede llevar `_rx`: la hora local a la que llegó (ms).
export function tareaActual(audit) {
  let t = null
  for (const e of audit) {
    const rx = e._rx ?? (Date.parse(e.ts) || 0)
    const d = e.detail ?? ''
    if (e.kind === 'task' && ES_INICIO.test(d) && !PASO.test(d)) {
      // «tarea recibida» y después «inicio»: es el mismo encargo.
      if (!t || t.terminada || t.acciones > 0) t = { inicio: rx, fin: null, pasos: 0, acciones: 0, terminada: false, motivo: null, respuesta: null, encargo: null }
      if (/inicio/i.test(d) && e.model_saw) t.encargo = e.model_saw
      continue
    }
    if (!t) t = { inicio: rx, fin: null, pasos: 0, acciones: 0, terminada: false, motivo: null, respuesta: null, encargo: null }
    if (t.terminada && e.kind !== 'approval' && e.kind !== 'task' && e.kind !== 'voice_out') {
      // Algo nuevo después de terminar sin aviso de inicio: otro encargo.
      if (['observe_sent', 'act', 'oracle'].includes(e.kind) && rx - (t.fin ?? rx) > 1500) {
        t = { inicio: rx, fin: null, pasos: 0, acciones: 0, terminada: false, motivo: null, respuesta: null, encargo: null }
      }
    }
    if (e.kind === 'act' || e.kind === 'oracle') t.acciones++
    if (e.kind === 'task') {
      const m = PASO.exec(d)
      if (m) t.pasos = Math.max(t.pasos, Number(m[1]))
      if (e.model_saw && !ES_LLAMADA.test(e.model_saw) && !/razona/i.test(d)) {
        t.respuesta = e.model_saw
        t.terminada = true
        t.fin = t.fin ?? rx
        t.motivo = t.motivo ?? 'hecho'
      }
      if (ES_FIN.test(d)) {
        t.terminada = true
        t.fin = t.fin ?? rx
        t.motivo = /end_turn/i.test(d) ? 'hecho' : motivoFin(d)
      }
    }
  }
  if (t && !t.pasos) t.pasos = t.acciones
  return t
}

const BLOQUEO = {
  destino: 'He bloqueado un dato del correo',
  fuga: 'He retenido una petición con un dato sin tapar',
  rojo: 'Ese dato nunca sale',
  presupuesto: 'El oráculo no responde más preguntas',
  asesoria: 'No doy consejo de inversión',
  caducado: 'La confirmación ha caducado',
  cancelado: 'Has cancelado la acción',
}

const OP = {
  type: (d) => `Escribiendo ${d ? `«${d}»` : 'en un campo'}`,
  tap: (d) => `Pulsando ${d ? `«${d}»` : 'un botón'}`,
  send: () => 'Enviando',
  scroll: () => 'Desplazando la pantalla',
  back: () => 'Volviendo atrás',
  key: () => 'Pulsando una tecla',
}

// {modo, titulo, detalle, tono}. detalle puede llevar tokens: la consola los pinta con el valor local.
export function estadoDe8({ audit, pending = [], status = 'conectado', etiquetas = {}, ahora = Date.now(), feed = false }) {
  if (status !== 'conectado' && status !== 'demo') {
    return { modo: 'sinconexion', titulo: 'Sin conexión con el núcleo', detalle: 'Vuelvo en cuanto el núcleo responda.', tono: 'aviso' }
  }
  if (pending.length > 0) {
    const p = pending[0]
    const frase = (p.summary ?? []).map((s) => s.token ?? s.text).join(' ')
    return { modo: 'esperar', titulo: 'Esperando tu confirmación', detalle: frase || null, tono: 'aviso' }
  }
  const e = audit[audit.length - 1]
  if (!e) return { modo: 'mirar', titulo: 'Esperando tu encargo', detalle: 'Escríbeme en «Pide a 8» y me pongo con ello.', tono: 'neutro' }

  const t = tareaActual(audit)
  if (t?.terminada && !feed && ahora - (t.fin ?? ahora) > 9000) {
    return { modo: 'mirar', titulo: 'Esperando tu encargo', detalle: `El último terminó en ${t.pasos} ${t.pasos === 1 ? 'paso' : 'pasos'}.`, tono: 'neutro' }
  }

  const lugar = (id) => etiquetas[`${e.app}|${e.screen}|${id}`]
  switch (e.kind) {
    case 'observe_sent': {
      const c = e.counts
      return {
        modo: 'leer',
        titulo: `Leyendo ${nombreApp(e.app)}${e.screen ? ` - ${nombrePantalla(e.screen)}` : ''}`,
        detalle: c ? `${c.verde} visibles | ${c.ambar} tokenizados | ${c.rojo} nunca salen` : null,
        tono: 'neutro',
      }
    }
    case 'oracle': {
      const importe = /IMPORTE/.test(e.model_saw ?? '')
      return { modo: 'pensar', titulo: importe ? 'Comprobando el importe sin verlo' : 'Comprobando un dato sin verlo', detalle: e.detail ? `El oráculo responde: ${e.detail}` : null, tono: 'neutro' }
    }
    case 'act': {
      const [, op, target, ...resto] = (e.model_saw ?? '').split(' ')
      if (op === 'open_app') return { modo: 'leer', titulo: `Abriendo ${nombreApp(target)}`, detalle: null, tono: 'neutro' }
      if (op === 'call') return { modo: 'hablar', titulo: 'Llamando al teléfono de la ficha', detalle: [target, ...resto].join(' ') || null, tono: 'neutro' }
      const f = OP[op]
      return { modo: 'hablar', titulo: f ? f(lugar(target)) : 'Trabajando en la pantalla', detalle: resto.join(' ') || null, tono: 'neutro' }
    }
    case 'held':
      return { modo: 'esperar', titulo: 'Esperando tu confirmación', detalle: null, tono: 'aviso' }
    case 'blocked':
      return { modo: 'enfado', titulo: BLOQUEO[e.reason] ?? 'He bloqueado una acción', detalle: e.detail || e.model_saw || null, tono: 'bloqueo' }
    case 'approval':
      return e.approved_by
        ? { modo: 'asentir', titulo: 'Aprobado. Sigo con el trámite', detalle: null, tono: 'seguro' }
        : { modo: 'negar', titulo: 'No lo hago: lo has rechazado', detalle: null, tono: 'neutro' }
    case 'paused':
      return { modo: 'apartar', titulo: 'Miro a otro lado', detalle: 'La pantalla tiene datos que no debo leer.', tono: 'neutro' }
    case 'voice_out':
      return { modo: 'hablar', titulo: 'Te estoy contestando', detalle: null, tono: 'neutro' }
    case 'call':
      return { modo: 'hablar', titulo: 'Al teléfono', detalle: null, tono: 'neutro' }
    case 'task': {
      if (t?.terminada) {
        if (t.motivo === 'limite') return { modo: 'duda', titulo: 'Me he quedado sin pasos', detalle: 'Puedes pedírmelo otra vez o por partes.', tono: 'aviso' }
        if (t.motivo === 'error') return { modo: 'disculpa', titulo: 'No he podido terminar', detalle: 'El modelo no ha respondido. Prueba otra vez.', tono: 'aviso' }
        return { modo: 'listo', titulo: 'Hecho', detalle: t.respuesta, tono: 'seguro' }
      }
      if (ES_INICIO.test(e.detail ?? '') && !PASO.test(e.detail ?? '')) return { modo: 'atencion', titulo: 'Leyendo tu encargo', detalle: null, tono: 'neutro' }
      return { modo: 'pensar', titulo: 'Pensando el siguiente paso', detalle: null, tono: 'neutro' }
    }
    default:
      return { modo: 'mirar', titulo: 'Trabajando', detalle: null, tono: 'neutro' }
  }
}

// «1:05»
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

// Texto de una frase de voz mixta (segmentos), con los tokens tal cual.
export function textoDeSegmentos(segments = []) {
  let out = ''
  for (const s of segments) {
    const p = s.token ?? s.text ?? ''
    if (!p) continue
    out += out && !/^[.,;:!?)»]/.test(p) && !/[(«]$/.test(out) ? ` ${p}` : p
  }
  return out
}
