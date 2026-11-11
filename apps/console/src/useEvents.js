import { useCallback, useEffect, useRef, useState } from 'react'
import { alertaDeBloqueo, alertasDePantalla } from './alertas.js'
import { valoresDe } from './tokens.js'
import { textoDeSegmentos } from './directo.js'
import { conFotogramas, urlsDe } from './frame.js'

// ?ws=ws://127.0.0.1:8790/events escucha otro núcleo (PRIV8_EVENTS_PORT) sin tocar la demo.
const URLS = urlsDe(window.location.search)
export const WS_URL = URLS.ws
export const VERIFY_URL = URLS.verify

// ?demo reproduce public/demo.json: mensajes reales del núcleo en el flujo de la factura
// con la trampa del IBAN, capturados sin llamar a la IA. Sirve para ensayar y para el vídeo.
// ?feed=sin-protocolo y ?feed=con-protocolo reproducen el mismo trámite B2B con y sin Priv8
// (make sin-protocolo, metrics/feeds.py), al ritmo que marca cada mensaje (`at`). Para el
// arranque de la demo y los vídeos de docs/entregables/video/.
const PARAMS = new URLSearchParams(window.location.search)
export const FEED = /^[a-z0-9-]+$/.test(PARAMS.get('feed') ?? '') ? PARAMS.get('feed') : null
export const SIN_PROTOCOLO = FEED === 'sin-protocolo'
export const DEMO = PARAMS.has('demo') || FEED !== null

const MAX_AUDIT = 500
const MAX_CHAT = 200
const MAX_LINEA = 300

// Línea del chat cuando el núcleo bloquea algo (las razones están en audit.schema.json).
const SIS_BLOQUEO = {
  destino: 'Bloqueado: un dato del correo no puede ir en ese campo.',
  fuga: 'Retenida una petición al modelo con un dato sin tapar.',
  rojo: 'Bloqueado: ese dato nunca sale.',
  presupuesto: 'El oráculo ha agotado sus preguntas.',
  asesoria: '8 no da consejo de inversión: la petición no llega al modelo.',
  caducado: 'Una confirmación ha caducado.',
  cancelado: 'Acción cancelada.',
}
// model_saw de un paso con herramientas («act {...}»), que no es una respuesta de 8.
const ES_LLAMADA = /^(observe|act|oracle)\b|\{"/

export function useEvents() {
  const [status, setStatus] = useState(DEMO ? 'demo' : 'conectando')
  const [screen, setScreen] = useState(null)
  const [audit, setAudit] = useState([])
  const [pending, setPending] = useState([])
  const [alerts, setAlerts] = useState([])
  // Token → valor real y etiqueta de cada elemento, de todas las pantallas vistas (solo en local).
  const [valores, setValores] = useState({})
  const [etiquetas, setEtiquetas] = useState({})
  // Solo en los feeds: valores reales que ha recibido el modelo y el resumen final.
  const [enClaro, setEnClaro] = useState(0)
  const [fin, setFin] = useState(null)
  // Chat con 8: tus mensajes (solo en esta pantalla), lo que dice 8, confirmaciones y avisos.
  const [chat, setChat] = useState([])
  const [confirmaciones, setConfirmaciones] = useState({})
  const [session, setSession] = useState('b2b')
  // Pantallas y eventos de auditoría en el orden en que llegan, para la pantalla de 8 en directo.
  const [linea, setLinea] = useState([])
  // El último fotograma de la pantalla real (#147): píxeles con valores reales, solo en memoria.
  const [frame, setFrame] = useState(null)
  const wsRef = useRef(null)
  const sendRef = useRef(null)
  const sessionRef = useRef('b2b')
  const postRef = useRef(null)

  useEffect(() => {
    let closed = false
    let timer = null
    let tries = 0
    const timers = []
    let nMsg = 0
    let nLinea = 0
    const alaLinea = (item) => setLinea((l) => [...l, { n: ++nLinea, ...item }].slice(-MAX_LINEA))
    const vistas = new Set() // lo que ya está en el chat: alarmas, confirmaciones y frases
    let anunciado = false // el fin del encargo ya tiene su línea
    let respuesta = null // respuesta final que espera su frase de voz

    const post = (item) => setChat((c) => [...c, { id: `m${++nMsg}`, ts: Date.now(), ...item }].slice(-MAX_CHAT))
    postRef.current = post
    const usarSesion = (s) => {
      if (typeof s === 'string' && s && s !== sessionRef.current) { sessionRef.current = s; setSession(s) }
    }

    // Alarmas nuevas arriba; la misma clave no se repite. Cada una deja también un aviso en el chat.
    const addAlerts = (list) => {
      const nuevas = list.filter(Boolean)
      if (nuevas.length === 0) return
      for (const a of nuevas) {
        if (vistas.has(`alarma:${a.clave}`)) continue
        vistas.add(`alarma:${a.clave}`)
        // Los bloqueos ya tienen su línea propia (evento blocked): no se repiten.
        if (a.tipo !== 'bloqueo') post({ k: 'alarma', tipo: a.tipo, texto: a.titulo })
      }
      setAlerts((prev) => {
        const ya = new Set(prev.map((a) => a.clave))
        const add = nuevas.filter((a) => !ya.has(a.clave)).map((a) => ({ ...a, ts: new Date(), revisada: false }))
        return add.length ? [...add, ...prev] : prev
      })
    }

    const anunciarFin = (texto, tono = 'seguro') => {
      if (anunciado) return
      anunciado = true
      post({ k: 'sis', tono, texto })
    }

    // Lo que deja en el chat cada evento del registro. `detail` lo escribe el núcleo: solo patrones amplios.
    const alChat = (e) => {
      const d = e.detail ?? ''
      if (e.kind === 'task') {
        const paso = /paso\s+(\d+)/i.exec(d)?.[1]
        if (/recib/i.test(d)) { anunciado = false; post({ k: 'sis', tono: 'cobalto', texto: '8 ha recibido el encargo.' }); return }
        if (/inicio/i.test(d) && !paso) {
          anunciado = false
          // En las reproducciones no hay nadie escribiendo: el encargo grabado hace de mensaje de la persona.
          if (DEMO && e.model_saw) post({ k: 'tu', texto: e.model_saw, grabado: true })
          return
        }
        if (e.model_saw && !ES_LLAMADA.test(e.model_saw)) {
          // La respuesta final de 8. En vivo llega también como frase de voz; si no llega, se pone esta.
          if (DEMO) post({ k: '8', texto: e.model_saw })
          else {
            clearTimeout(respuesta)
            respuesta = setTimeout(() => post({ k: '8', texto: e.model_saw }), 2500)
          }
          anunciarFin(paso ? `Encargo terminado en ${paso} pasos.` : 'Encargo terminado.')
          return
        }
        if (/l[ií]mite/i.test(d)) return anunciarFin('8 se ha quedado sin pasos y ha parado.', 'aviso')
        if (/error/i.test(d)) return anunciarFin('El modelo no ha respondido. El encargo se ha detenido.', 'aviso')
        if (/^fin\b/i.test(d)) return anunciarFin(paso ? `Encargo terminado en ${paso} pasos.` : 'Encargo terminado.')
        return
      }
      if (e.kind === 'blocked') post({ k: 'sis', tono: 'bloqueo', texto: SIS_BLOQUEO[e.reason] ?? 'El núcleo ha bloqueado una acción.' })
      if (e.kind === 'approval' && e.confirm) {
        setConfirmaciones((c) => (c[e.confirm] ? { ...c, [e.confirm]: { ...c[e.confirm], estado: e.approved_by ? 'aprobada' : 'rechazada' } } : c))
      }
    }

    const handle = (m) => {
      if (m.type === 'frame') {
        if (typeof m.img === 'string' && m.w > 0 && m.h > 0) setFrame({ ...m, recibido: Date.now() })
        return
      }
      if (m.type === 'screen') {
        usarSesion(m.session)
        setScreen({ ...m, recibida: new Date() })
        alaLinea({ k: 'screen', m })
        setValores((v) => ({ ...valoresDe(m.raw, m.observed), ...v }))
        const o = m.observed
        setEtiquetas((t) => {
          const n = { ...t }
          for (const el of o?.elements ?? []) n[`${o.app}|${o.screen}|${el.id}`] = el.label || el.text || el.role
          return n
        })
        if (typeof m.total === 'number') setEnClaro(m.total)
        if (m.protocolo !== false) addAlerts(alertasDePantalla(m))
      } else if (m.type === 'fin') {
        setFin(m)
        window.__p8FeedFin = true
      } else if (m.type === 'audit') {
        // En los feeds, la hora es la de la reproducción (las grabadas son todas del mismo segundo).
        if (FEED) m = { ...m, event: { ...m.event, ts: new Date().toISOString() } }
        const ev = { ...m.event, _rx: Date.now() } // _rx: hora local de llegada, para el tiempo del encargo
        usarSesion(ev.session)
        setAudit((a) => [...a, ev].slice(-MAX_AUDIT))
        alaLinea({ k: 'audit', ev })
        addAlerts([alertaDeBloqueo(ev)])
        alChat(ev)
      } else if (m.type === 'confirm_request') {
        const req = { ...m, recibida: Date.now() }
        usarSesion(m.session)
        setPending((p) => (p.some((x) => x.id === m.id) ? p : [...p, req]))
        setConfirmaciones((c) => (c[m.id] ? c : { ...c, [m.id]: { ...req, estado: 'pendiente' } }))
        if (!vistas.has(`confirm:${m.id}`)) { vistas.add(`confirm:${m.id}`); post({ k: 'confirm', ref: m.id }) }
      } else if (m.type === 'approval_result') {
        setPending((p) => p.filter((x) => x.id !== m.id))
        if (typeof m.ok === 'boolean') {
          setConfirmaciones((c) => (c[m.id]?.estado === 'pendiente' ? { ...c, [m.id]: { ...c[m.id], estado: m.ok ? 'aprobada' : 'rechazada' } } : c))
        }
      } else if (m.type === 'voice') {
        const u = m.utterance
        if (!u || !Array.isArray(u.segments) || u.segments.length === 0) return
        const clave = `voz:${u.session}:${u.utterance}:${textoDeSegmentos(u.segments)}`
        if (vistas.has(clave)) return
        vistas.add(clave)
        clearTimeout(respuesta)
        respuesta = null
        usarSesion(u.session)
        post({ k: '8', segmentos: u.segments })
      }
    }

    if (DEMO) {
      let seq = 1000
      sendRef.current = (msg) => {
        if (msg.type !== 'approval_result') return false
        // En la demo, la aprobación se refleja como lo haría el núcleo.
        handle({ type: 'approval_result', id: msg.id })
        handle({ type: 'audit', event: {
          seq: seq++, ts: new Date().toISOString(), session: 'b2b', kind: 'approval',
          confirm: msg.id, approved_by: msg.ok ? 'persona' : null, reason: msg.reason ?? null,
          model_saw: null, detail: msg.ok ? 'aprobado en pantalla' : 'rechazado en pantalla',
        } })
        return true
      }
      fetch(FEED ? `/${FEED}.json` : '/demo.json')
        .then((r) => r.json())
        .then((msgs) => {
          // demo.json: un mensaje cada 700 ms para que se vea cómo se construye la pantalla.
          // Los feeds traen su propio ritmo en `at` (segundos).
          msgs.forEach(({ msg, at }, i) => timers.push(setTimeout(() => !closed && handle(msg), FEED ? at * 1000 : 400 + i * 700)))
        })
        .catch(() => setStatus('sin demo'))
      return () => { closed = true; timers.forEach(clearTimeout); clearTimeout(respuesta) }
    }

    const connect = () => {
      setStatus('conectando')
      const ws = new WebSocket(conFotogramas(WS_URL))
      wsRef.current = ws
      ws.onopen = () => { tries = 0; setStatus('conectado') }
      ws.onmessage = (e) => {
        let m
        try { m = JSON.parse(e.data) } catch { return }
        handle(m)
      }
      ws.onclose = () => {
        if (closed) return
        setFrame(null) // sin núcleo, la pantalla real no está al día: vuelve el esquema
        setStatus('reconectando')
        timer = setTimeout(connect, Math.min(500 * 2 ** tries++, 5000))
      }
      ws.onerror = () => ws.close()
    }
    sendRef.current = (msg) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return false
      ws.send(JSON.stringify(msg))
      return true
    }
    connect()
    return () => { closed = true; clearTimeout(timer); clearTimeout(respuesta); wsRef.current?.close() }
  }, [])

  const resolve = useCallback((id, ok) => {
    const sent = sendRef.current?.({ type: 'approval_result', id, ok, via: 'pantalla', by: 'persona', ...(ok ? {} : { reason: 'cancelado' }) })
    if (!sent) return false
    setPending((p) => p.filter((x) => x.id !== id))
    setConfirmaciones((c) => (c[id] ? { ...c, [id]: { ...c[id], estado: ok ? 'aprobada' : 'rechazada' } } : c))
    return true
  }, [])

  // Un encargo para 8 (task_request). El texto solo viaja por el canal local: la consola no lo registra.
  const pedir = useCallback((texto) => {
    const t = String(texto ?? '').trim().slice(0, 500)
    if (!t || DEMO) return false
    const sent = sendRef.current?.({ type: 'task_request', session: sessionRef.current, text: t })
    if (!sent) return false
    postRef.current?.({ k: 'tu', texto: t })
    return true
  }, [])

  const review = useCallback((clave) => {
    setAlerts((prev) => prev.map((a) => (a.clave === clave ? { ...a, revisada: true } : a)))
  }, [])

  return { status, screen, audit, pending, resolve, alerts, review, valores, etiquetas, enClaro, fin, chat, confirmaciones, session, pedir, linea, frame }
}
