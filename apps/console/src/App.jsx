import { useEffect, useMemo, useState } from 'react'
import { DEMO, VERIFY_URL, useEvents } from './useEvents.js'
import { comentarioDe8 } from './alertas.js'
import { TOKEN_RE, alinear, partesDeToken } from './tokens.js'
import logoClaro from '../../../brand/logo/priv8-cua-claro.svg'
import logoOscuro from '../../../brand/logo/priv8-cua-oscuro.svg'
import ochoReposo from '../../../brand/logo/8-reposo-cobalto.svg'
import ochoNuncaSale from '../../../brand/logo/8-nuncasale-cobalto.svg'

const ESTADO = {
  verde: { cls: 'seguro', texto: 'lo ve' },
  ambar: { cls: 'aviso', texto: 'tokenizado' },
  rojo: { cls: 'bloqueo', texto: 'nunca sale' },
}
const ORIGEN = {
  maestro: 'dato del ERP', correo: 'llegó por correo', tercero: 'de un tercero',
  titular: 'del titular', propio: 'propio', positivo: 'importe',
}
const APP = { 'alba-core': 'Alba Core', inbox: 'Correo' }
const nombreApp = (a) => APP[a] ?? a

// ---------------------------------------------------------------- piezas

function Token({ tok, valores }) {
  const real = valores?.[tok]
  return <code className="tok" title={real ? `En local: ${real}` : undefined}>{tok}</code>
}

// Texto con tokens. mostrar="ambos" pone el valor real delante del token (solo en local).
function Tokens({ text, valores, mostrar = 'token' }) {
  if (text == null) return <span className="redacted">nunca sale</span>
  if (text === '') return <span className="vacio">vacío</span>
  return text.split(TOKEN_RE).map((part, i) => {
    if (!(i % 2)) return part
    if (mostrar === 'ambos' && valores?.[part]) return <Valor key={i} tok={part} valores={valores} />
    return <Token key={i} tok={part} valores={valores} />
  })
}

function Valor({ tok, valores }) {
  const real = valores?.[tok]
  return (
    <span className="valor">
      {real && <b>{real}</b>}
      <code className="tok">{tok}</code>
    </span>
  )
}

function useAhora(ms = 1000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setT(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return t
}

function useTema() {
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('p8-consola-tema') || 'dark' } catch { return 'dark' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = tema
    try { localStorage.setItem('p8-consola-tema', tema) } catch { /* sin almacenamiento */ }
  }, [tema])
  return [tema, setTema]
}

const hora = (d) => (d ? new Date(d).toLocaleTimeString('es-ES', { hour12: false }) : '')
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// ---------------------------------------------------------------- cabecera

const CONEXION = {
  conectado: ['seguro', 'Conectado al núcleo'],
  conectando: ['aviso', 'Conectando…'],
  reconectando: ['aviso', 'Reconectando…'],
  demo: ['cobalto', 'Demo · mensajes grabados'],
  'sin demo': ['bloqueo', 'Falta demo.json'],
}

function Cabecera({ status, tema, setTema }) {
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tono, texto] = CONEXION[status] ?? ['aviso', status]

  const verify = async () => {
    setBusy(true)
    try {
      const r = await fetch(VERIFY_URL)
      setCheck(await r.json())
    } catch (e) {
      setCheck({ ok: false, lines: 0, error: 'no responde el núcleo' })
    }
    setBusy(false)
  }

  return (
    <header className="top">
      <div className="marca">
        <img className="logo logo-claro" src={logoClaro} alt="Priv8 CUA" />
        <img className="logo logo-oscuro" src={logoOscuro} alt="Priv8 CUA" />
        <span className="producto">Consola de auditoría</span>
      </div>
      <span className={`conexion t-${tono}`}><i aria-hidden="true" />{texto}</span>
      <span className="sp" />
      {check && (
        <span className={`p8-estado ${check.ok ? 'p8-estado--seguro' : 'p8-estado--bloqueo'}`} role="status">
          {check.ok ? `Registro íntegro · ${check.lines} líneas` : `Registro no válido: ${check.error}`}
        </span>
      )}
      <button className="btn sec" onClick={verify} disabled={busy || DEMO} title={DEMO ? 'No disponible en la demo' : 'Comprueba la cadena de hashes y la firma'}>
        {busy ? 'Verificando…' : 'Verificar registro'}
      </button>
      <div className="tema" role="group" aria-label="Tema">
        <button aria-pressed={tema === 'light'} onClick={() => setTema('light')}>Claro</button>
        <button aria-pressed={tema === 'dark'} onClick={() => setTema('dark')}>Oscuro</button>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------- confirmaciones y alarmas

function Pendiente({ p, resolve, valores, ahora }) {
  const total = p.expires_s ?? 300
  const quedan = Math.max(0, Math.round(total - (ahora - p.recibida) / 1000))
  const caducada = quedan === 0
  const tokens = p.summary.filter((s) => s.token).map((s) => s.token)
  return (
    <article className="pendiente" aria-labelledby={`pend-${p.id}`}>
      <div className="fila-cab">
        <span className="p8-estado p8-estado--aviso">Necesita tu confirmación</span>
        <span className="meta">{p.kind} · {p.id}</span>
        <span className="sp" />
        <span className={`caduca ${quedan < 60 ? 'pronto' : ''}`}>{caducada ? 'Caducada' : `Caduca en ${mmss(quedan)}`}</span>
      </div>
      <p className="frase" id={`pend-${p.id}`}>
        {p.summary.map((s, i) => (s.token ? <Valor key={i} tok={s.token} valores={valores} /> : <span key={i}>{s.text} </span>))}
      </p>
      {tokens.length > 0 && (
        <dl className="origenes">
          {tokens.map((t) => {
            const o = partesDeToken(t)?.origen
            return (
              <div key={t}>
                <dt>{valores[t] ?? t}</dt>
                <dd className={o === 'correo' ? 'ojo' : ''}>{ORIGEN[o] ?? o ?? 'sin origen'}</dd>
              </div>
            )
          })}
        </dl>
      )}
      <div className="barra" aria-hidden="true"><i style={{ width: `${(quedan / total) * 100}%` }} /></div>
      <div className="acciones">
        <button className="btn ok" disabled={caducada} onClick={() => resolve(p.id, true)}>Aprobar</button>
        <button className="btn no" disabled={caducada} onClick={() => resolve(p.id, false)}>Rechazar</button>
        <span className="nota">Lo que ve 8 son los tokens. Los valores en negrita solo están en esta máquina.</span>
      </div>
    </article>
  )
}

const ETIQUETA = { cuenta: 'Cambio de cuenta', instruccion: 'Órdenes a la IA', bloqueo: 'Bloqueo del núcleo' }

function Alarmas({ alerts, review, comentario, valores }) {
  if (alerts.length === 0) return null
  const activas = alerts.filter((a) => !a.revisada).length
  return (
    <section className={`alarmas ${activas ? 'activas' : ''}`} role="alert" aria-live="assertive">
      <header className="sec-cab">
        <img className="ocho" src={activas ? ochoNuncaSale : ochoReposo} alt="" />
        <div>
          <h2>{activas ? `Posible fraude detectado · ${activas} sin revisar` : 'Alarmas revisadas'}</h2>
          <p className="sub">Se detecta en local a partir de los tokens: no hace falta enseñar los datos a la IA.</p>
        </div>
      </header>
      <ul>
        {alerts.map((a) => (
          <li key={a.clave} className={`alarma t-${a.tipo} ${a.revisada ? 'revisada' : ''}`}>
            <div className="fila-cab">
              <span className="chip">{ETIQUETA[a.tipo]}</span>
              <b className="titulo">{a.titulo}</b>
              <span className="sp" />
              <span className="meta">{nombreApp(a.app)}{a.pantalla ? ` · ${a.pantalla}` : ''} · {hora(a.ts)}</span>
            </div>
            <p><Tokens text={a.detalle} valores={valores} mostrar="ambos" /></p>
            {a.evidencia && <blockquote><Tokens text={a.evidencia} valores={valores} /></blockquote>}
            {a.revisada
              ? <span className="hecho">Revisada</span>
              : <button className="btn sec" onClick={() => review(a.clave)}>Marcar como revisada</button>}
          </li>
        ))}
      </ul>
      {comentario && (
        <div className="dice8">
          <span className="chip c-cobalto">Lo que dice 8</span>
          <p><Tokens text={comentario} valores={valores} /></p>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- pantalla actual

function Real({ real, observado }) {
  if (real == null) return <span className="vacio">sin texto</span>
  if (real === '') return <span className="vacio">vacío</span>
  const trozos = alinear(real, observado)
  if (!trozos) return real
  return trozos.map((t, i) => (t.token ? <mark key={i} className="dato">{t.texto}</mark> : t.texto))
}

function Celda({ children, largo }) {
  const [abierta, setAbierta] = useState(false)
  if (!largo) return <div className="valor-celda">{children}</div>
  return (
    <div className={`valor-celda largo ${abierta ? 'abierta' : ''}`}>
      <div className="recorte">{children}</div>
      <button className="mas" onClick={() => setAbierta((v) => !v)}>{abierta ? 'Ver menos' : 'Ver todo'}</button>
    </div>
  )
}

function Pantalla({ screen, status, valores }) {
  const obs = screen?.observed
  const reales = useMemo(() => new Map((screen?.raw?.elements ?? []).map((e) => [e.id, e])), [screen])

  if (!obs) {
    const esperando = status !== 'conectado' && status !== 'demo'
    return (
      <section className="panel vacio-panel">
        <img className="ocho grande" src={ochoReposo} alt="" />
        <h2>{esperando ? 'Esperando al núcleo' : 'Esperando la primera pantalla'}</h2>
        <p>
          {esperando
            ? <>La consola escucha en <code>127.0.0.1:8700</code>. Arranca el agente con <code>make agent-web</code>, o abre la <a href="?demo">demo con mensajes grabados</a>.</>
            : 'En cuanto 8 lea una pantalla, aquí verás lo que hay en ella y lo que le llega a la IA.'}
        </p>
      </section>
    )
  }

  const els = obs.elements ?? []
  return (
    <section className="panel pantalla" aria-label="Pantalla actual">
      <header className="sec-cab">
        <div>
          <p className="eyebrow">Pantalla actual · {hora(screen.recibida)}</p>
          <h2>{nombreApp(obs.app)} <span className="ruta">{obs.screen}</span></h2>
        </div>
        <span className="sp" />
        {obs.paused && <span className="p8-estado p8-estado--aviso">En pausa: {obs.paused}</span>}
      </header>
      <div className="tabla" role="table" aria-label="Lo que ves frente a lo que ve la IA">
        <div className="fila cabecera" role="row">
          <span role="columnheader">Elemento</span>
          <span role="columnheader">Lo que ves <em>solo en local</em></span>
          <span role="columnheader">Lo que ve la IA <em>tokens</em></span>
          <span role="columnheader">Estado</span>
        </div>
        {els.length === 0 && <p className="vacio fila-vacia">{obs.paused ? 'Pantalla en pausa: no se lee nada.' : 'Sin elementos.'}</p>}
        {els.map((el) => {
          const r = reales.get(el.id) ?? {}
          const e = ESTADO[el.cls] ?? ESTADO.verde
          const largo = (r.text?.length ?? 0) > 140
          return (
            <div key={el.id} className={`fila e-${e.cls}`} role="row">
              <span className="elemento" role="cell">
                <span className="nombre">{el.label ? <Tokens text={el.label} /> : <span className="rol-solo">{el.role}</span>}</span>
                <span className="tecnico">{el.label ? `${el.role} · ${el.id}` : el.id}</span>
              </span>
              <span role="cell"><Celda largo={largo}><Real real={r.text} observado={el.text} /></Celda></span>
              <span role="cell"><Celda largo={largo}><Tokens text={el.text} valores={valores} /></Celda></span>
              <span role="cell"><span className={`p8-estado p8-estado--${e.cls}`}>{e.texto}</span></span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- actividad

const OP = { tap: 'Pulsa', type: 'Escribe', open_app: 'Abre', send: 'Envía', scroll: 'Desplaza', back: 'Vuelve', key: 'Tecla', call: 'Llama' }

function describir(e, etiquetas) {
  const lugar = (id) => etiquetas[`${e.app}|${e.screen}|${id}`]
  switch (e.kind) {
    case 'observe_sent': return { tono: 'neutro', titulo: `Lee ${nombreApp(e.app)} · ${e.screen}`, detalle: e.counts ? `${e.counts.verde} visibles · ${e.counts.ambar} tokenizados · ${e.counts.rojo} nunca salen` : null }
    case 'act': {
      const [, op, target, ...resto] = (e.model_saw ?? '').split(' ')
      const texto = resto.join(' ')
      if (op === 'open_app') return { tono: 'neutro', titulo: `Abre ${nombreApp(target)}` }
      const donde = lugar(target)
      return { tono: 'neutro', titulo: `${OP[op] ?? op}${donde ? ` «${donde}»` : target ? ` ${target}` : ''}`, detalle: texto || null }
    }
    case 'blocked': return { tono: 'bloqueo', titulo: `Bloqueado · ${e.reason ?? 'sin motivo'}`, detalle: e.detail ?? e.model_saw, extra: e.model_saw && e.detail ? e.model_saw : null }
    case 'held': return { tono: 'aviso', titulo: 'Retenido hasta que confirmes', detalle: `${e.model_saw ?? ''} · ${e.confirm}` }
    case 'approval': return e.approved_by ? { tono: 'seguro', titulo: `Aprobado por ${e.approved_by}`, detalle: e.confirm } : { tono: 'bloqueo', titulo: 'Rechazado', detalle: e.confirm }
    case 'task': return { tono: 'cobalto', titulo: '8 informa', detalle: e.model_saw }
    case 'paused': return { tono: 'aviso', titulo: 'En pausa', detalle: e.detail }
    case 'oracle': return { tono: 'neutro', titulo: 'Pregunta al oráculo', detalle: e.model_saw }
    default: return { tono: 'neutro', titulo: e.kind, detalle: e.model_saw ?? e.detail }
  }
}

const FILTROS = [['todo', 'Todo'], ['bloqueos', 'Bloqueos'], ['decisiones', 'Confirmaciones']]

function media(audit, k) {
  const v = audit.map((e) => e.ms?.[k]).filter((x) => typeof x === 'number')
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

function Actividad({ audit, etiquetas, valores }) {
  const [filtro, setFiltro] = useState('todo')
  const n = { bloqueos: audit.filter((e) => e.kind === 'blocked').length, decisiones: audit.filter((e) => e.kind === 'held' || e.kind === 'approval').length }
  const lista = audit.filter((e) => filtro === 'todo'
    || (filtro === 'bloqueos' && e.kind === 'blocked')
    || (filtro === 'decisiones' && (e.kind === 'held' || e.kind === 'approval'))).slice().reverse()
  const lat = [['núcleo', media(audit, 'core')], ['adaptador', media(audit, 'adapter')], ['modelo', media(audit, 'model')]]

  return (
    <section className="panel actividad" aria-label="Actividad">
      <header className="sec-cab">
        <div>
          <p className="eyebrow">Registro firmado</p>
          <h2>Actividad</h2>
        </div>
      </header>
      <div className="filtros" role="tablist" aria-label="Filtrar actividad">
        {FILTROS.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)}>
            {t}{k !== 'todo' && <span className={`cuenta ${k === 'bloqueos' && n[k] ? 'roja' : ''}`}>{n[k]}</span>}
          </button>
        ))}
      </div>
      {lista.length === 0 && <p className="vacio">{filtro === 'bloqueos' ? 'Ningún bloqueo.' : 'Aún no hay actividad.'}</p>}
      <ol className="eventos">
        {lista.map((e) => {
          const d = describir(e, etiquetas)
          const ms = (e.ms?.core ?? 0) + (e.ms?.adapter ?? 0) + (e.ms?.model ?? 0)
          return (
            <li key={e.seq} className={`evento t-${d.tono}`}>
              <i className="punto" aria-hidden="true" />
              <div className="cuerpo">
                <div className="linea1">
                  <b>{d.titulo}</b>
                  <span className="sp" />
                  <span className="meta">#{e.seq} · {hora(e.ts)}</span>
                </div>
                {d.detalle && <div className="detalle"><Tokens text={d.detalle} valores={valores} /></div>}
                {d.extra && <div className="detalle mono"><Tokens text={d.extra} valores={valores} /></div>}
                {e.ms && ms > 0 && <div className="meta">{ms} ms</div>}
              </div>
            </li>
          )
        })}
      </ol>
      <footer className="latencia">
        <span>Media por paso</span>
        {lat.map(([k, v]) => <span key={k}><em>{k}</em> {v == null ? '—' : `${v} ms`}</span>)}
      </footer>
    </section>
  )
}

// ---------------------------------------------------------------- resumen

function Resumen({ screen, audit, pending, alerts }) {
  const els = screen?.observed?.elements ?? []
  const c = { verde: 0, ambar: 0, rojo: 0 }
  for (const e of els) c[e.cls] = (c[e.cls] ?? 0) + 1
  const bloqueos = audit.filter((e) => e.kind === 'blocked').length
  const sinRevisar = alerts.filter((a) => !a.revisada).length
  return (
    <div className="resumen" aria-label="Resumen">
      <span className="grupo">
        <span className="p8-estado p8-estado--seguro">{c.verde} lo ve 8</span>
        <span className="p8-estado p8-estado--aviso">{c.ambar} tokenizados</span>
        <span className="p8-estado p8-estado--bloqueo">{c.rojo} nunca salen</span>
        <span className="nota">en la pantalla actual</span>
      </span>
      <span className="sp" />
      <span className="grupo">
        <span className={`cifra ${bloqueos ? 'roja' : ''}`}><b>{bloqueos}</b> bloqueos</span>
        <span className={`cifra ${pending.length ? 'ambar' : ''}`}><b>{pending.length}</b> por confirmar</span>
        <span className={`cifra ${sinRevisar ? 'roja' : ''}`}><b>{sinRevisar}</b> alarmas</span>
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- app

export default function App() {
  const { status, screen, audit, pending, resolve, alerts, review, valores, etiquetas } = useEvents()
  const [tema, setTema] = useTema()
  const ahora = useAhora()
  const atencion = pending.length + alerts.filter((a) => !a.revisada).length

  useEffect(() => {
    document.title = `${atencion ? `(${atencion}) ` : ''}Priv8 · Consola`
  }, [atencion])

  return (
    <div className="app">
      <Cabecera status={status} tema={tema} setTema={setTema} />
      {(screen || audit.length > 0) && <Resumen screen={screen} audit={audit} pending={pending} alerts={alerts} />}
      <div className="layout">
        <main className="principal">
          {pending.length > 0 && (
            <section className="pendientes" aria-label="Confirmaciones pendientes">
              {pending.map((p) => <Pendiente key={p.id} p={p} resolve={resolve} valores={valores} ahora={ahora} />)}
            </section>
          )}
          <Alarmas alerts={alerts} review={review} comentario={comentarioDe8(audit)} valores={valores} />
          <Pantalla screen={screen} status={status} valores={valores} />
        </main>
        <aside className="lateral">
          <Actividad audit={audit} etiquetas={etiquetas} valores={valores} />
        </aside>
      </div>
    </div>
  )
}
