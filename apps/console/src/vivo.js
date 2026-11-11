// La pantalla de 8 en directo: qué hace 8 en cada evento, en una línea y con su foco.
//
// Entra la secuencia ordenada de mensajes que recibe la consola (pantallas y eventos de
// auditoría) y sale, por cada uno, una línea del razonamiento y el foco del cursor de 8.
// Solo funciones puras: la animación vive en Vivo.jsx. Los tokens se dejan tal cual
// (‹IBAN_1-correo› o ‹IBAN_1·correo›): la consola los pinta con el valor local.

import { nombreApp, nombrePantalla } from './directo.js'
import { TOKEN_RE } from './tokens.js'

// «act type e7 ‹IMPORTE_1›» → {op: 'type', target: 'e7', text: '‹IMPORTE_1›'}
const CON_OBJETIVO = new Set(['tap', 'type', 'send', 'scroll', 'long_press', 'select', 'check'])
export function leerAccion(modelSaw) {
  const s = String(modelSaw ?? '').trim()
  const m = /^act\s+(\S+)\s*(.*)$/s.exec(s)
  if (!m) return null
  const op = m[1]
  const resto = m[2] ?? ''
  if (op === 'open_app') return { op, app: resto.split(/\s+/)[0] || null, target: null, text: null }
  if (CON_OBJETIVO.has(op)) {
    const [, target = null, text = ''] = /^(\S+)?\s*(.*)$/s.exec(resto) ?? []
    return { op, target, text: text || null }
  }
  return { op, target: null, text: resto || null }
}

// Elemento de la pantalla al que va una acción: su id, o el que admite esa acción (call).
export function objetivoDe(accion, screen) {
  if (!accion) return null
  const els = screen?.observed?.elements ?? []
  if (accion.target && els.some((e) => e.id === accion.target)) return accion.target
  if (accion.op === 'call') {
    const tok = accion.text?.match(TOKEN_RE)?.[0]
    const igual = tok && els.find((e) => (e.text ?? '').includes(tok))
    if (igual) return igual.id
    return els.find((e) => (e.actions ?? []).includes('call'))?.id ?? null
  }
  return null
}

// Elemento que contiene alguno de los tokens (para señalar lo que mira el oráculo).
export function elementoConToken(texto, screen) {
  const toks = String(texto ?? '').match(TOKEN_RE) ?? []
  const els = screen?.observed?.elements ?? []
  for (const t of toks) {
    const el = els.find((e) => (e.text ?? '').includes(t) || (e.label ?? '').includes(t))
    if (el) return el.id
  }
  return null
}

const etiquetaDe = (id, screen) => {
  const el = (screen?.observed?.elements ?? []).find((e) => e.id === id)
  return el ? el.label || el.text || el.role : null
}

const PASO = /paso\s+(\d+)/i
const ES_LLAMADA = /^(observe|act|oracle)\b|\{"/
const ES_INICIO = /recib|inicio/i

export const BLOQUEO = {
  destino: 'un dato del correo no entra en ese campo',
  fuga: 'petición con un dato sin tapar',
  rojo: 'ese dato nunca sale',
  presupuesto: 'el oráculo no responde más',
  asesoria: 'no doy consejo de inversión',
  caducado: 'la confirmación ha caducado',
  cancelado: 'acción cancelada',
  sin_regla: 'pantalla sin regla',
  token_desconocido: 'token desconocido',
  adaptador: 'la pantalla no ha respondido',
}

// Frase corta de una acción: «pulsa «Registrar»», «escribe en «Importe»».
export function fraseAccion(a, screen) {
  if (!a) return 'actúa en la pantalla'
  const donde = a.target ? etiquetaDe(a.target, screen) : null
  const en = donde ? ` «${donde}»` : ''
  switch (a.op) {
    case 'tap': return `pulsa${en || ' un botón'}`
    case 'type': return `escribe en${en || ' un campo'}`
    case 'open_app': return `abre ${nombreApp(a.app)}`
    case 'call': return 'llama al teléfono'
    case 'back': return 'vuelve atrás'
    case 'scroll': return 'desplaza la pantalla'
    case 'send': return `envía${en}`
    case 'key': return 'pulsa una tecla'
    case 'home': return 'vuelve al inicio'
    default: return `${a.op}${en}`
  }
}

const may = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// Una línea del razonamiento para un evento de auditoría, o null si no aporta.
// {tipo, tono, titulo, texto (con tokens), sub}
export function lineaDe(ev, screen) {
  const d = ev.detail ?? ''
  switch (ev.kind) {
    case 'task': {
      const paso = PASO.exec(d)?.[1]
      if (ES_INICIO.test(d) && !paso) {
        if (/recib/i.test(d)) return null
        return { tipo: 'encargo', tono: 'cobalto', titulo: 'Encargo', texto: ev.model_saw ?? null }
      }
      // lo que razona 8 antes de actuar (el agente lo publica como «paso N - razona»)
      if (ev.model_saw && /razona/i.test(d)) {
        return { tipo: 'piensa', tono: 'neutro', titulo: paso ? `Paso ${paso} - piensa` : 'Piensa', texto: ev.model_saw }
      }
      // La respuesta final: entera solo en el chat; aquí, que ha respondido.
      if (ev.model_saw && !ES_LLAMADA.test(ev.model_saw)) {
        return { tipo: 'dice', tono: 'seguro', titulo: paso ? `Paso ${paso} - responde en el chat` : 'Responde en el chat', texto: null }
      }
      if (ev.model_saw && ES_LLAMADA.test(ev.model_saw)) {
        const ms = ev.ms?.model
        const herr = [...new Set(ev.model_saw.split(';').map((x) => x.trim().split(' ')[0]).filter(Boolean))]
        return { tipo: 'paso', tono: 'neutro', titulo: paso ? `Paso ${paso}` : 'Decide', texto: null, sub: `${herr.join(', ')}${typeof ms === 'number' && ms > 0 ? ` | ${(ms / 1000).toFixed(1).replace('.', ',')} s` : ''}` }
      }
      if (/l[ií]mite/i.test(d)) return { tipo: 'fin', tono: 'aviso', titulo: 'Se ha quedado sin pasos', texto: null }
      if (/error/i.test(d)) return { tipo: 'fin', tono: 'aviso', titulo: 'El modelo no ha respondido', texto: null }
      if (/^fin\b|end_turn/i.test(d)) return { tipo: 'fin', tono: 'seguro', titulo: paso ? `Terminado en ${paso} pasos` : 'Terminado', texto: null }
      return null
    }
    case 'observe_sent': {
      const c = ev.counts
      const sub = ev.claro != null
        ? `pantalla entera al modelo | ${ev.claro} ${ev.claro === 1 ? 'valor real' : 'valores reales'} en claro`
        : c ? `${c.verde} visibles | ${c.ambar} tokenizados | ${c.rojo} nunca salen` : null
      return { tipo: 'observa', tono: ev.claro ? 'bloqueo' : 'neutro', titulo: `Observa ${nombreApp(ev.app)}${ev.screen ? ` - ${nombrePantalla(ev.screen)}` : ''}`, texto: null, sub }
    }
    case 'act': {
      const a = leerAccion(ev.model_saw)
      const texto = a && (a.op === 'type' || a.op === 'call') ? a.text : null
      return { tipo: 'accion', tono: 'neutro', titulo: may(fraseAccion(a, screen)), texto }
    }
    case 'oracle': {
      const q = String(ev.model_saw ?? '').replace(/^oracle\s+/, '')
      return { tipo: 'oraculo', tono: 'cobalto', titulo: 'Pregunta al oráculo', texto: q || null, sub: d ? `responde: ${d}` : null }
    }
    case 'blocked': {
      const a = leerAccion(ev.model_saw)
      return { tipo: 'bloqueo', tono: 'bloqueo', titulo: `Bloqueado: ${BLOQUEO[ev.reason] ?? 'acción no permitida'}`, texto: d || null, sub: a ? `intentaba: ${fraseAccion(a, screen)}` : ev.model_saw ?? null }
    }
    case 'held': {
      const a = leerAccion(ev.model_saw)
      return { tipo: 'espera', tono: 'aviso', titulo: 'Espera tu confirmación', texto: null, sub: a ? `antes de: ${fraseAccion(a, screen)}` : null }
    }
    case 'approval':
      return ev.approved_by
        ? { tipo: 'aprobado', tono: 'seguro', titulo: 'Aprobado', texto: null, sub: `por ${ev.approved_by}` }
        : { tipo: 'rechazado', tono: 'bloqueo', titulo: 'Rechazado', texto: null, sub: ev.reason ?? null }
    case 'paused':
      return { tipo: 'pausa', tono: 'aviso', titulo: 'Mira a otro lado', texto: null, sub: 'la pantalla tiene datos que no debe leer' }
    case 'call':
      return { tipo: 'accion', tono: 'neutro', titulo: 'Al teléfono', texto: null }
    default:
      return null
  }
}

// El foco del cursor de 8 tras un evento: {id, gesto, tono, aviso} o null (sin foco).
// gesto: tap, type, call, mira, oraculo, bloqueo, espera, ok.
export function focoDe(ev, screen, previo = null) {
  switch (ev.kind) {
    case 'act': {
      const a = leerAccion(ev.model_saw)
      if (!a) return null
      if (a.op === 'open_app' || a.op === 'back' || a.op === 'home') return null
      const id = objetivoDe(a, screen)
      if (!id) return null
      return { id, gesto: a.op === 'type' ? 'type' : a.op === 'call' ? 'call' : 'tap', tono: 'cobalto', texto: a.op === 'type' ? a.text : null }
    }
    case 'blocked': {
      const a = leerAccion(ev.model_saw)
      const id = objetivoDe(a, screen) ?? previo?.id ?? null
      return id ? { id, gesto: 'bloqueo', tono: 'bloqueo', aviso: `Bloqueado - ${BLOQUEO[ev.reason] ?? 'no permitido'}` } : null
    }
    case 'held': {
      const id = objetivoDe(leerAccion(ev.model_saw), screen) ?? previo?.id ?? null
      return id ? { id, gesto: 'espera', tono: 'aviso', aviso: 'Esperando tu confirmación' } : null
    }
    case 'approval':
      return previo?.id ? { id: previo.id, gesto: 'ok', tono: ev.approved_by ? 'seguro' : 'bloqueo', aviso: ev.approved_by ? 'Aprobado' : 'Rechazado' } : null
    case 'oracle': {
      const id = elementoConToken(ev.model_saw, screen)
      return id ? { id, gesto: 'oraculo', tono: 'cobalto', aviso: ev.detail ? `Oráculo: ${ev.detail}` : 'Oráculo' } : null
    }
    case 'observe_sent':
      return null
    default:
      return previo
  }
}

// Tras qué eventos 8 está pensando (espera la siguiente respuesta del modelo).
export function piensaTras(ev) {
  if (ev.kind === 'observe_sent' || ev.kind === 'approval' || ev.kind === 'oracle') return true
  if (ev.kind === 'task') {
    const d = ev.detail ?? ''
    if (ES_INICIO.test(d) && !PASO.test(d)) return true
    if (ev.model_saw && ES_LLAMADA.test(ev.model_saw)) return false
    return false
  }
  if (ev.kind === 'act') {
    const a = leerAccion(ev.model_saw)
    return a?.op === 'type'
  }
  return false
}

// Cuánto se queda en pantalla cada paso antes del siguiente (ms), para que se vea moverse.
export function duracion(item, valores = {}) {
  if (item.k === 'screen') return 650
  const ev = item.ev
  switch (ev.kind) {
    case 'act': {
      const a = leerAccion(ev.model_saw)
      if (a?.op === 'type') {
        const largo = textoPlano(a.text, valores).length
        return Math.min(1500, 520 + largo * 32)
      }
      return 620
    }
    case 'blocked': return 1300
    case 'held': return 700
    case 'oracle': return 700
    case 'observe_sent': return 380
    case 'task': return 260
    default: return 300
  }
}

// El texto de un tecleo, con el valor real de cada token si se conoce.
export function textoPlano(texto, valores = {}, real = true) {
  if (!texto) return ''
  return String(texto).split(TOKEN_RE).map((p, i) => (i % 2 && real ? valores[p] ?? p : p)).join('')
}

// Android: marco de móvil en vez de ventana.
const ANDROID = /^es\.|^banca-|^brezo|^nimbo/
export const esMovil = (screen) => screen?.raw?.source === 'android' || ANDROID.test(screen?.observed?.app ?? screen?.raw?.app ?? '')
