import { useCallback, useEffect, useRef, useState } from 'react'

export const WS_URL = 'ws://127.0.0.1:8700/events'
export const VERIFY_URL = 'http://127.0.0.1:8700/verify'

const MAX_AUDIT = 500

export function useEvents() {
  const [status, setStatus] = useState('conectando')
  const [screen, setScreen] = useState(null)
  const [audit, setAudit] = useState([])
  const [pending, setPending] = useState([])
  const wsRef = useRef(null)

  useEffect(() => {
    let closed = false
    let timer = null
    let tries = 0

    const connect = () => {
      setStatus('conectando')
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => { tries = 0; setStatus('conectado') }
      ws.onmessage = (e) => {
        let m
        try { m = JSON.parse(e.data) } catch { return }
        if (m.type === 'screen') setScreen(m)
        else if (m.type === 'audit') setAudit((a) => [...a, m.event].slice(-MAX_AUDIT))
        else if (m.type === 'confirm_request') setPending((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]))
        else if (m.type === 'approval_result') setPending((p) => p.filter((x) => x.id !== m.id))
      }
      ws.onclose = () => {
        if (closed) return
        setStatus('reconectando')
        timer = setTimeout(connect, Math.min(500 * 2 ** tries++, 5000))
      }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { closed = true; clearTimeout(timer); wsRef.current?.close() }
  }, [])

  const resolve = useCallback((id, ok) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify({ type: 'approval_result', id, ok, via: 'pantalla', by: 'persona', ...(ok ? {} : { reason: 'cancelado' }) }))
    setPending((p) => p.filter((x) => x.id !== id))
    return true
  }, [])

  return { status, screen, audit, pending, resolve }
}
