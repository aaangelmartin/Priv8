import { useState } from 'react'
import { useEvents, VERIFY_URL } from './useEvents.js'
import { comentarioDe8 } from './alertas.js'

const TOKEN_RE = /(‹[^›]*›)/g
const CLS = { verde: 'seguro', ambar: 'aviso', rojo: 'bloqueo' }

function Tokens({ text }) {
  if (text == null) return <span className="redacted">nunca sale</span>
  return text.split(TOKEN_RE).map((part, i) =>
    part.startsWith('‹') ? <code key={i} className="tok">{part}</code> : part)
}

function Elements({ title, sub, elements, observed }) {
  return (
    <section className="pane">
      <header><h2>{title}</h2><span>{sub}</span></header>
      <ul className="elements">
        {elements == null && <li className="empty">Esperando pantalla…</li>}
        {elements?.length === 0 && <li className="empty">Sin elementos</li>}
        {elements?.map((el) => (
          <li key={el.id} className={observed ? `cls-${CLS[el.cls] ?? el.cls}` : ''}>
            <span className="role">{el.role}</span>
            <span className="id">{el.id}</span>
            {el.label != null && <div className="label">{observed ? <Tokens text={el.label} /> : el.label}</div>}
            <div className="text">{observed ? <Tokens text={el.text} /> : el.text}</div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const ETIQUETA = { cuenta: 'Cambio de cuenta', instruccion: 'Órdenes a la IA', bloqueo: 'Bloqueo del núcleo' }

function Alarmas({ alerts, review, comentario }) {
  if (alerts.length === 0) return null
  const activas = alerts.filter((a) => !a.revisada).length
  return (
    <section className={`alarmas ${activas ? 'activas' : ''}`} role="alert" aria-live="assertive">
      <header>
        <h2>{activas ? `Posible fraude detectado · ${activas} sin revisar` : 'Alarmas revisadas'}</h2>
        <span>Detectado en local a partir de los tokens: no hace falta ver los datos</span>
      </header>
      <ul>
        {alerts.map((a) => (
          <li key={a.clave} className={`alarma t-${a.tipo} ${a.revisada ? 'revisada' : ''}`}>
            <div className="alarma-cab">
              <span className="chip">{ETIQUETA[a.tipo]}</span>
              <b>{a.titulo}</b>
              <span className="sp" />
              <span className="donde">{a.app}{a.pantalla ? ` · ${a.pantalla}` : ''} · {a.ts.toLocaleTimeString('es-ES')}</span>
            </div>
            <p><Tokens text={a.detalle} /></p>
            {a.evidencia && <blockquote><Tokens text={a.evidencia} /></blockquote>}
            {!a.revisada && <button className="btn" onClick={() => review(a.clave)}>Marcar como revisada</button>}
          </li>
        ))}
      </ul>
      {comentario && (
        <div className="dice8">
          <span className="chip">Lo que dice 8</span>
          <p><Tokens text={comentario} /></p>
        </div>
      )}
    </section>
  )
}

const fmt = (v) => (v == null ? '—' : `${v} ms`)

export default function App() {
  const { status, screen, audit, pending, resolve, alerts, review } = useEvents()
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)

  const verify = async () => {
    setBusy(true)
    try {
      const r = await fetch(VERIFY_URL)
      setCheck(await r.json())
    } catch (e) {
      setCheck({ ok: false, lines: 0, error: `no se pudo contactar con el núcleo (${e.message})` })
    }
    setBusy(false)
  }

  const blocked = audit.filter((e) => e.kind === 'blocked').slice().reverse()
  const timed = audit.filter((e) => e.ms && Object.values(e.ms).some((v) => v != null)).slice(-12).reverse()

  return (
    <div className="app">
      <header className="top">
        <h1>Consola de auditoría</h1>
        <span className={`status s-${status}`}>{status}</span>
        <span className="sp" />
        {check && (
          <span className={`verdict ${check.ok ? 'ok' : 'bad'}`}>
            {check.ok ? `Registro íntegro · ${check.lines} líneas` : `Registro NO válido: ${check.error}`}
          </span>
        )}
        <button className="btn" onClick={verify} disabled={busy}>Verificar registro</button>
      </header>

      <Alarmas alerts={alerts} review={review} comentario={comentarioDe8(audit)} />

      <main className="split">
        <Elements title="Lo que ves" sub="valores reales, solo en local" elements={screen?.raw?.elements} />
        <Elements title="Lo que ve la IA" sub="datos sustituidos por tokens" elements={screen?.observed?.elements} observed />
      </main>

      <div className="grid">
        <section className="card">
          <h3>Confirmaciones pendientes <b>{pending.length}</b></h3>
          {pending.length === 0 && <p className="empty">Nada pendiente.</p>}
          {pending.map((p) => (
            <div key={p.id} className="confirm">
              <div><code>{p.id}</code> {p.kind} · caduca en {p.expires_s}s</div>
              <div className="summary">
                {p.summary.map((s, i) => (s.token ? <code key={i} className="tok">{s.token}</code> : <span key={i}>{s.text} </span>))}
              </div>
              <div className="row">
                <button className="btn ok" onClick={() => resolve(p.id, true)}>Aprobar</button>
                <button className="btn no" onClick={() => resolve(p.id, false)}>Rechazar</button>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h3>Eventos bloqueados <b>{blocked.length}</b></h3>
          {blocked.length === 0 && <p className="empty">Ninguno.</p>}
          <ul className="list">
            {blocked.map((e) => (
              <li key={e.seq}>
                <span className="seq">#{e.seq}</span> <span className="reason">{e.reason ?? 'sin motivo'}</span>
                {e.model_saw && <div className="mono">{e.model_saw}</div>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Latencia por paso</h3>
          {timed.length === 0 && <p className="empty">Sin mediciones.</p>}
          <table>
            <thead><tr><th>#</th><th>evento</th><th>core</th><th>adapter</th><th>model</th></tr></thead>
            <tbody>
              {timed.map((e) => (
                <tr key={e.seq}><td>{e.seq}</td><td>{e.kind}</td><td>{fmt(e.ms.core)}</td><td>{fmt(e.ms.adapter)}</td><td>{fmt(e.ms.model)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
