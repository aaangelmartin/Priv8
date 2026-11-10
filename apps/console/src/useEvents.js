import { useCallback, useEffect, useRef, useState } from 'react'
import { alertaDeBloqueo, alertasDePantalla } from './alertas.js'
import { valoresDe } from './tokens.js'

export const WS_URL = 'ws://127.0.0.1:8700/events'
export const VERIFY_URL = 'http://127.0.0.1:8700/verify'

// ?demo reproduce public/demo.json: mensajes reales del núcleo en el flujo de la factura
// con la trampa del IBAN, capturados sin llamar a la IA. Sirve para ensayar y para el vídeo.
export const DEMO = new URLSearchParams(window.location.search).has('demo')

const MAX_AUDIT = 500

export function useEvents() {
  const [status, setStatus] = useState(DEMO ? 'demo' : 'conectando')
  const [screen, setScreen] = useState(null)
  const [audit, setAudit] = useState([])
  const [pending, setPending] = useState([])
  const [alerts, setAlerts] = useState([])
  // Token → valor real y etiqueta de cada elemento, de todas las pantallas vistas (solo en local).
  const [valores, setValores] = useState({})
  const [etiquetas, setEtiquetas] = useState({})
  const wsRef = useRef(null)
  const sendRef = useRef(null)

  useEffect(() => {
    let closed = false
    let timer = null
    let tries = 0
    const timers = []

    // Alarmas nuevas arriba; la misma clave no se repite.
    const addAlerts = (list) => {
      const nuevas = list.filter(Boolean)
      if (nuevas.length === 0) return
      setAlerts((prev) => {
        const vistas = new Set(prev.map((a) => a.clave))
        const add = nuevas.filter((a) => !vistas.has(a.clave)).map((a) => ({ ...a, ts: new Date(), revisada: false }))
        return add.length ? [...add, ...prev] : prev
      })
    }

    const handle = (m) => {
      if (m.type === 'screen') {
        setScreen({ ...m, recibida: new Date() })
        setValores((v) => ({ ...valoresDe(m.raw, m.observed), ...v }))
        const o = m.observed
        setEtiquetas((t) => {
          const n = { ...t }
          for (const el of o?.elements ?? []) n[`${o.app}|${o.screen}|${el.id}`] = el.label || el.text || el.role
          return n
        })
        addAlerts(alertasDePantalla(m))
      } else if (m.type === 'audit') {
        setAudit((a) => [...a, m.event].slice(-MAX_AUDIT))
        addAlerts([alertaDeBloqueo(m.event)])
      } else if (m.type === 'confirm_request') {
        setPending((p) => (p.some((x) => x.id === m.id) ? p : [...p, { ...m, recibida: Date.now() }]))
      } else if (m.type === 'approval_result') {
        setPending((p) => p.filter((x) => x.id !== m.id))
      }
    }

    if (DEMO) {
      let seq = 1000
      sendRef.current = (msg) => {
        // En la demo, la aprobación se refleja como lo haría el núcleo.
        handle({ type: 'approval_result', id: msg.id })
        handle({ type: 'audit', event: {
          seq: seq++, ts: new Date().toISOString(), session: 'b2b', kind: 'approval',
          confirm: msg.id, approved_by: msg.ok ? 'persona' : null, reason: msg.reason ?? null,
          model_saw: null, detail: msg.ok ? 'aprobado en pantalla' : 'rechazado en pantalla',
        } })
      }
      fetch('/demo.json')
        .then((r) => r.json())
        .then((msgs) => {
          // Un mensaje cada 700 ms para que se vea cómo se construye la pantalla.
          msgs.forEach(({ msg }, i) => timers.push(setTimeout(() => !closed && handle(msg), 400 + i * 700)))
        })
        .catch(() => setStatus('sin demo'))
      return () => { closed = true; timers.forEach(clearTimeout) }
    }

    const connect = () => {
      setStatus('conectando')
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => { tries = 0; setStatus('conectado') }
      ws.onmessage = (e) => {
        let m
        try { m = JSON.parse(e.data) } catch { return }
        handle(m)
      }
      ws.onclose = () => {
        if (closed) return
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
    return () => { closed = true; clearTimeout(timer); wsRef.current?.close() }
  }, [])

  const resolve = useCallback((id, ok) => {
    const sent = sendRef.current?.({ type: 'approval_result', id, ok, via: 'pantalla', by: 'persona', ...(ok ? {} : { reason: 'cancelado' }) })
    if (sent === false) return false
    setPending((p) => p.filter((x) => x.id !== id))
    return true
  }, [])

  const review = useCallback((clave) => {
    setAlerts((prev) => prev.map((a) => (a.clave === clave ? { ...a, revisada: true } : a)))
  }, [])

  return { status, screen, audit, pending, resolve, alerts, review, valores, etiquetas }
}
