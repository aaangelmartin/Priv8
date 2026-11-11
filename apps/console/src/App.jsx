import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO, FEED, SESION, SIN_PROTOCOLO, VERIFY_URL, WS_URL, useEvents } from './useEvents.js'
import { VELOCIDADES, reloj } from './reproductor.js'
import { comentarioDe8 } from './alertas.js'
import { partesDeToken } from './tokens.js'
import { estadoDe8, mmss, nombreApp, nombrePantalla, tareaActual } from './directo.js'
import { EnClaro, Md, Real, Tokens, Valor, hora, limpio, useAhora, useCalma } from './piezas.jsx'
import { Razonamiento, useReproduccion } from './Vivo.jsx'
import { DosPantallas, PantallaViva, VistaWeb } from './Vista8.jsx'
import { esVista8 } from './frame.js'
import Eight from './eight/Eight.jsx'
import ochoAvatar from '../../../brand/logo/8-reposo-cobalto.svg'

const COBALTO = '#2D45D6'
const NOCHE = '#0B1B33'
const BLANCO = '#FFFFFF'

const ESTADO = {
  verde: { cls: 'seguro', texto: 'lo ve' },
  ambar: { cls: 'aviso', texto: 'tokenizado' },
  rojo: { cls: 'bloqueo', texto: 'nunca sale' },
  claro: { cls: 'bloqueo', texto: 'en claro' }, // solo en ?feed=sin-protocolo
}
const ORIGEN = {
  maestro: 'dato del ERP', correo: 'llegó por correo', tercero: 'de un tercero',
  titular: 'del titular', propio: 'propio', positivo: 'importe',
}

// ---------------------------------------------------------------- barra

const CONEXION = {
  conectado: ['seguro', 'Conectado al núcleo'],
  conectando: ['aviso', 'Conectando…'],
  reconectando: ['aviso', 'Reconectando…'],
  demo: SESION ? ['cobalto', 'Sesión real grabada'] : FEED ? ['cobalto', 'Reproducción B2B'] : ['cobalto', 'Demo grabada'],
  'sin demo': ['bloqueo', 'Falta demo.json'],
}

// La vista principal es 8 en directo y el chat; lo demás va en pestañas de la barra.
const VISTAS = [['directo', 'En directo'], ['alarmas', 'Alarmas'], ['pantalla', 'Pantalla'], ['registro', 'Registro']]
const vistaDeHash = () => {
  const h = window.location.hash.replace('#', '')
  return VISTAS.some(([k]) => k === h) ? h : 'directo'
}
function useVista() {
  const [v, setV] = useState(vistaDeHash)
  useEffect(() => {
    const f = () => setV(vistaDeHash())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const ir = (k) => {
    const url = `${window.location.pathname}${window.location.search}${k === 'directo' ? '' : `#${k}`}`
    window.history.replaceState(null, '', url)
    setV(k)
  }
  return [v, ir]
}

function Barra({ status, vista, ir, avisos }) {
  const [tono, texto] = CONEXION[status] ?? ['aviso', status]
  return (
    <header className="nav">
      <span className="brand">
        <Eight className="nav-eight" mode={status === 'conectado' || status === 'demo' ? 'mirar' : 'sinconexion'} fg={BLANCO} cut={COBALTO} label="8" />
        <span className="word">Priv8</span>
        <span className="producto">Consola</span>
      </span>
      <nav className="vistas" role="tablist" aria-label="Vistas de la consola">
        {VISTAS.map(([k, t]) => {
          const a = avisos[k]
          return (
            <button key={k} role="tab" aria-selected={vista === k} onClick={() => ir(k)}>
              {t}
              {a?.n > 0 && <span className={`insignia t-${a.tono}`} title={a.texto}>{a.n}</span>}
            </button>
          )
        })}
      </nav>
      <span className="sp" />
      <span className={`conexion t-${tono}`} role="status"><i aria-hidden="true" />{texto}</span>
    </header>
  )
}

function Verificar() {
  const [check, setCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const verify = async () => {
    setBusy(true)
    try {
      const r = await fetch(VERIFY_URL)
      setCheck(await r.json())
    } catch {
      setCheck({ ok: false, lines: 0, error: 'no responde el núcleo' })
    }
    setBusy(false)
  }
  return (
    <span className="verificar">
      {check && (
        <span className={`verificado ${check.ok ? 'ok' : 'mal'}`} role="status">
          {check.ok ? `Registro íntegro | ${check.lines} líneas` : `Registro no válido: ${limpio(check.error)}`}
        </span>
      )}
      <button className="btn primario" onClick={verify} disabled={busy || DEMO} title={DEMO ? 'No disponible en la reproducción' : 'Comprueba la cadena de hashes y la firma'}>
        {busy ? 'Verificando…' : 'Verificar registro'}
      </button>
    </span>
  )
}

// ---------------------------------------------------------------- en directo

// «Leyendo Alba Core - alta de factura»: la segunda parte, en cobalto suave como en la web.
function Titular({ texto }) {
  const i = texto.indexOf(' - ')
  if (i < 0) return texto
  return <>{texto.slice(0, i)} <span className="soft">{texto.slice(i + 3)}</span></>
}

// La pestaña «Lo que ve 8» a pantalla completa, con el mismo núcleo (?ws=) que esta consola.
export function urlVista8() {
  const p = new URLSearchParams(window.location.search)
  p.set('vista', '8')
  return `${window.location.pathname}?${p.toString()}`
}

// Sesión grabada: el reloj de la reproducción, al día (unas veces por segundo).
function useReloj() {
  const [st, setSt] = useState(reloj.estado)
  useEffect(() => {
    let ultimo = ''
    return reloj.suscribir((e) => {
      const clave = `${Math.floor(e.t * 4)}|${e.enMarcha}|${e.velocidad}|${e.terminado}|${e.duracion}`
      if (clave !== ultimo) { ultimo = clave; setSt(e) }
    })
  }, [])
  return st
}

function Controles() {
  const st = useReloj()
  const pct = st.duracion ? Math.min(100, (st.t / st.duracion) * 100) : 0
  return (
    <div className="controles" role="group" aria-label="Reproducción de la sesión grabada">
      <button className="ctl" onClick={() => reloj.alternar()} aria-label={st.enMarcha ? 'Pausar' : 'Reproducir'} title={st.enMarcha ? 'Pausar' : st.terminado ? 'Volver a empezar' : 'Reproducir'}>
        {st.enMarcha
          ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>}
      </button>
      <button className="ctl" onClick={() => reloj.reiniciar()} aria-label="Reiniciar" title="Reiniciar">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <span className="velocidades" role="radiogroup" aria-label="Velocidad">
        {VELOCIDADES.map((v) => (
          <button key={v} role="radio" aria-checked={st.velocidad === v} onClick={() => reloj.velocidad(v)}>{v}x</button>
        ))}
      </span>
      <span className="progreso" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      <span className="tiempo">{mmss(Math.floor(st.t))} / {mmss(Math.round(st.duracion))}</span>
    </div>
  )
}

// Lo que ves tú junto a lo que ve el modelo: en la sesión grabada y en directo cuando el
// adaptador web manda la pestaña real (#170). Sin ella (Android, feeds), solo lo que ve 8.
const NOTA_REAL = SESION ? 'Datos ficticios de la demo' : 'Solo en este ordenador'
const dosPantallas = (real) => SESION || !!real

function EnDirecto({ audit, pending, status, etiquetas, enClaro, fin, ahora, rep, frame, real }) {
  const crudo = estadoDe8({ audit, pending, status, etiquetas, ahora, feed: !!FEED })
  const e = useCalma(crudo, `${crudo.modo}|${crudo.titulo}`)
  const t = useMemo(() => tareaActual(audit), [audit])
  const bloqueos = audit.filter((x) => x.kind === 'blocked').length
  const segundos = t ? Math.max(0, Math.round(((t.terminada ? t.fin : ahora) - t.inicio) / 1000)) : 0
  const fondo = SIN_PROTOCOLO ? NOCHE : COBALTO

  return (
    <section className={`directo ${FEED ? `modo ${SIN_PROTOCOLO ? 'sin' : 'con'}` : ''}`} aria-label="Lo que ve 8, en directo">
      <header className="directo-cab" aria-live="polite">
        <Eight className="directo-eight" mode={e.modo} fg={BLANCO} cut={fondo} label={`8: ${e.titulo}`} />
        <div className="directo-texto">
          {SESION
            ? <p className="eyebrow modo-texto">Sesión real grabada <span className="clave">el modelo solo recibe tokens</span></p>
            : FEED
            ? <p className="eyebrow modo-texto">{SIN_PROTOCOLO ? <>Sin protocolo <span className="clave">el modelo recibe los datos reales</span></> : <>Con Priv8 <span className="clave">el modelo solo recibe tokens</span></>}</p>
            : <p className="eyebrow"><i className="vivo" aria-hidden="true" />Lo que ve 8, en directo</p>}
          <h2 title={e.titulo}><Titular texto={e.titulo} /></h2>
        </div>
        <span className="sp" />
        {t && (
          <span className="tarea" aria-label="Encargo actual">
            <span>{t.terminada ? 'Terminado' : 'En curso'}</span>
            <span>Paso {t.pasos}</span>
            <span>{mmss(segundos)}</span>
          </span>
        )}
        {!DEMO && (
          <a className="abrir" href={urlVista8()} target="_blank" rel="noopener noreferrer" title="Abre lo que ve 8 en otra pestaña, a pantalla completa">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-8 8M10 5H5v14h14v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Pantalla completa
          </a>
        )}
      </header>

      <div className="directo-pantalla">
        {dosPantallas(real)
          ? <DosPantallas frame={frame} real={real} nota={NOTA_REAL} />
          : <PantallaViva frame={frame} rep={rep} demo={DEMO && !SESION} sin={SIN_PROTOCOLO} />}
      </div>

      {FEED && (
        <footer className="directo-pie">
          <span className={`cifra ${SIN_PROTOCOLO ? 'mala' : ''}`}><b>{enClaro}</b> valores reales enviados al modelo</span>
          {!SIN_PROTOCOLO && <span className="cifra"><b>{bloqueos}</b> {bloqueos === 1 ? 'acción bloqueada' : 'acciones bloqueadas'}</span>}
          {!SIN_PROTOCOLO && <span className="cifra"><b>{pending.length}</b> por confirmar</span>}
          {fin && SIN_PROTOCOLO && <span className="cifra fin">Ningún bloqueo, ninguna confirmación</span>}
          {SESION && <Controles />}
        </footer>
      )}
    </section>
  )
}

// ?vista=8: solo lo que ve 8, de borde a borde, con una cabecera mínima.
export function SoloVista() {
  const { status, audit, pending, etiquetas, frame, linea, valores } = useEvents()
  const ahora = useAhora()
  const rep = useReproduccion(linea, valores)
  const crudo = estadoDe8({ audit, pending, status, etiquetas, ahora, feed: !!FEED })
  const e = useCalma(crudo, `${crudo.modo}|${crudo.titulo}`)
  const [tono, texto] = CONEXION[status] ?? ['aviso', status]
  useEffect(() => { document.title = 'Lo que ve 8 - Priv8' }, [])
  return (
    <div className="solo">
      <header className="solo-cab" aria-live="polite">
        <Eight className="solo-eight" mode={e.modo} fg={BLANCO} cut={NOCHE} label={`8: ${e.titulo}`} />
        <b className="solo-marca">Lo que ve 8</b>
        <span className="solo-estado" title={e.titulo}>{e.titulo}</span>
        <span className="sp" />
        <span className={`conexion t-${tono}`} role="status"><i aria-hidden="true" />{texto}</span>
      </header>
      <main className="solo-pantalla">
        {!DEMO && esVista8(frame)
          ? <VistaWeb frame={frame} cabecera={false} />
          : <PantallaViva frame={frame} rep={rep} demo={DEMO} sin={SIN_PROTOCOLO} />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------- chat con 8

const SUGERENCIAS = [
  'Registra la factura de Suministros Lumen',
  'Contesta al proveedor que la factura está registrada',
  'Comprueba que el importe coincide con el pedido',
  'Llama al proveedor para verificar el cambio de cuenta',
]

function Confirmacion({ c, resolve, valores, ahora }) {
  const total = c.expires_s ?? 300
  const quedan = Math.max(0, Math.round(total - (ahora - c.recibida) / 1000))
  const caducada = c.estado === 'pendiente' && quedan === 0
  const abierta = c.estado === 'pendiente' && !caducada
  const tokens = (c.summary ?? []).filter((s) => s.token).map((s) => s.token)
  const [error, setError] = useState(false)
  const decidir = (ok) => setError(!resolve(c.id, ok))
  return (
    <article className={`confirmacion e-${caducada ? 'caducada' : c.estado}`} aria-labelledby={`conf-${c.id}`}>
      <div className="fila-cab">
        <span className="etiqueta">{abierta ? 'Necesita tu confirmación' : c.estado === 'aprobada' ? 'Aprobada' : c.estado === 'rechazada' ? 'Rechazada' : 'Caducada'}</span>
        <span className="meta">{c.kind} | {c.id}</span>
        <span className="sp" />
        {abierta && <span className={`caduca ${quedan < 60 ? 'pronto' : ''}`}>Caduca en {mmss(quedan)}</span>}
      </div>
      <p className="frase" id={`conf-${c.id}`}>
        {(c.summary ?? []).map((s, i) => (s.token ? <Valor key={i} tok={s.token} valores={valores} /> : <span key={i}>{s.text} </span>))}
      </p>
      {abierta && tokens.length > 0 && (
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
      {abierta && <div className="barra" aria-hidden="true"><i style={{ width: `${(quedan / total) * 100}%` }} /></div>}
      {abierta && (
        <div className="acciones">
          <button className="btn primario" onClick={() => decidir(true)} disabled={SESION} title={SESION ? 'En la grabación la aprueba la persona' : undefined}>Aprobar</button>
          <button className="btn no" onClick={() => decidir(false)} disabled={SESION}>Rechazar</button>
          {SESION && <span className="nota">En la grabación la aprueba la persona.</span>}
          {error && <span className="nota mala">No se ha enviado: sin conexión con el núcleo.</span>}
        </div>
      )}
    </article>
  )
}

function Mensaje({ m, confirmaciones, resolve, valores, ahora }) {
  if (m.k === 'tu') {
    return (
      <li className="msg tu">
        <div className="burbuja">{m.grabado ? <Tokens text={m.texto} valores={valores} mostrar="real" /> : m.texto}</div>
        <span className="meta">{m.grabado ? 'Encargo grabado' : 'Tú'} | {hora(m.ts)}</span>
      </li>
    )
  }
  if (m.k === '8') {
    return (
      <li className="msg ocho">
        <img className="avatar" src={ochoAvatar} alt="" />
        <div>
          <div className="burbuja">
            {m.segmentos
              ? m.segmentos.map((s, i) => (
                <span key={i}>{i > 0 && !/^[.,;:!?)»]/.test(s.text ?? '') ? ' ' : ''}{s.token ? <Tokens text={s.token} valores={valores} mostrar="real" /> : s.text}</span>
              ))
              : <Md texto={m.texto} valores={valores} mostrar="real" />}
          </div>
          <span className="meta">8 | {hora(m.ts)}</span>
        </div>
      </li>
    )
  }
  if (m.k === 'confirm') {
    const c = confirmaciones[m.ref]
    return c ? <li className="msg conf"><Confirmacion c={c} resolve={resolve} valores={valores} ahora={ahora} /></li> : null
  }
  if (m.k === 'alarma') return <li className={`msg linea t-alarma`}><i aria-hidden="true" /><span>Alarma: {m.texto}</span></li>
  return <li className={`msg linea t-${m.tono ?? 'neutro'}`}><i aria-hidden="true" /><span>{m.texto}</span></li>
}

function Chat({ chat, confirmaciones, resolve, pedir, status, session, valores, ahora }) {
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState(null)
  const lista = useRef(null)
  const activo = !DEMO && status === 'conectado'
  // Lo que espera tu respuesta va siempre al final, a la vista; al resolverse vuelve a su sitio.
  const abierta = (m) => m.k === 'confirm' && confirmaciones[m.ref]?.estado === 'pendiente'
  const orden = [...chat.filter((m) => !abierta(m)), ...chat.filter(abierta)]
  const pendientes = chat.filter(abierta).length

  useEffect(() => {
    const el = lista.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chat.length, pendientes])

  const enviar = (t) => {
    const v = (t ?? texto).trim()
    if (!v) return
    if (pedir(v)) { setTexto(''); setAviso(null) } else setAviso('No se ha enviado: sin conexión con el núcleo.')
  }

  return (
    <section className="chat" aria-label="Pide a 8">
      <header className="chat-cab">
        <div>
          <p className="eyebrow">Sesión {session}</p>
          <h2>Pide a 8</h2>
        </div>
        <span className="sp" />
        <span className="privado">Tu texto no sale de aquí sin tokenizar</span>
      </header>
      <ol className="mensajes" ref={lista} aria-live="polite">
        {chat.length === 0 && (
          <li className="msg ocho">
            <img className="avatar" src={ochoAvatar} alt="" />
            <div className="burbuja">Hola. Dime qué hago en Alba Core o en el correo. Antes de enviar, transferir o llamar te pido confirmación.</div>
          </li>
        )}
        {orden.map((m) => <Mensaje key={m.id} m={m} confirmaciones={confirmaciones} resolve={resolve} valores={valores} ahora={ahora} />)}
      </ol>
      {!SESION && (
        <div className="sugerencias" aria-label="Sugerencias">
          {SUGERENCIAS.map((s) => (
            <button key={s} className="chip-sug" disabled={!activo} onClick={() => enviar(s)}>{s}</button>
          ))}
        </div>
      )}
      <form className="entrada" onSubmit={(ev) => { ev.preventDefault(); enviar() }}>
        <input
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          maxLength={500}
          disabled={!activo}
          placeholder={activo ? 'Escribe un encargo para 8' : DEMO ? 'Reproducción grabada' : 'Esperando al núcleo'}
          aria-label="Encargo para 8"
        />
        <button className="btn primario" type="submit" disabled={!activo || !texto.trim()}>Enviar</button>
      </form>
      {!activo && <p className="nota-chat">{SESION ? 'Reproducción de una sesión real grabada.' : DEMO ? 'Es una reproducción grabada: aquí no se pueden enviar encargos.' : 'Sin conexión con el núcleo: arranca el agente con make agent-web.'}</p>}
      {aviso && activo && <p className="nota-chat mala">{aviso}</p>}
    </section>
  )
}

// ---------------------------------------------------------------- alarmas

const ETIQUETA = { cuenta: 'Cambio de cuenta', instruccion: 'Órdenes a la IA', bloqueo: 'Bloqueo del núcleo' }

// compacta: una línea por alarma (en los feeds, para que la pantalla quepa en el vídeo).
function Alarmas({ alerts, review, comentario, valores, compacta = false }) {
  if (alerts.length === 0) return null
  const activas = alerts.filter((a) => !a.revisada).length
  return (
    <section className={`alarmas ${activas ? 'activas' : ''} ${compacta ? 'compacta' : ''}`} role="alert" aria-live="assertive">
      <header className="sec-cab">
        <div>
          <p className="eyebrow">Detectado en local, sin enseñar los datos a la IA</p>
          <h2>{activas ? <>Posible fraude <span className="suave">| {activas} sin revisar</span></> : 'Alarmas revisadas'}</h2>
        </div>
      </header>
      <ul>
        {alerts.map((a) => (
          <li key={a.clave} className={`alarma t-${a.tipo} ${a.revisada ? 'revisada' : ''}`}>
            <div className="fila-cab">
              <span className="chip">{ETIQUETA[a.tipo]}</span>
              <b className="titulo">{a.titulo}</b>
              <span className="sp" />
              <span className="meta">{nombreApp(a.app)}{a.pantalla ? ` | ${nombrePantalla(a.pantalla)}` : ''} | {hora(a.ts)}</span>
            </div>
            {!compacta && <p><Tokens text={a.detalle} valores={valores} mostrar="ambos" /></p>}
            {!compacta && a.evidencia && <blockquote><Tokens text={a.evidencia} valores={valores} /></blockquote>}
            {compacta ? null : a.revisada
              ? <span className="hecho">Revisada</span>
              : <button className="btn sec" onClick={() => review(a.clave)}>Marcar como revisada</button>}
          </li>
        ))}
      </ul>
      {comentario && !compacta && (
        <div className="dice8">
          <span className="chip c-cobalto">Lo que dice 8</span>
          <p><Tokens text={comentario} valores={valores} mostrar="ambos" /></p>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- pantalla actual

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

function Pantalla({ screen, status, valores, frame, real }) {
  const obs = screen?.observed
  const reales = useMemo(() => new Map((screen?.raw?.elements ?? []).map((e) => [e.id, e])), [screen])

  if (!obs) {
    const esperando = status !== 'conectado' && status !== 'demo'
    return (
      <section className="panel vacio-panel">
        <Eight className="vacio-eight" mode={esperando ? 'sinconexion' : 'mirar'} fg={COBALTO} cut="#F4F6FD" label="8" />
        <h2>{esperando ? 'Esperando al núcleo' : 'Esperando la primera pantalla'}</h2>
        <p>
          {esperando
            ? <>La consola escucha en <code>{WS_URL.replace(/^ws:\/\//, '').replace(/\/events$/, '')}</code>. Arranca el agente con <code>make agent-web</code>, o abre la <a href="?demo">demo con mensajes grabados</a>.</>
            : 'En cuanto 8 lea una pantalla, aquí verás lo que hay en ella y lo que le llega a la IA.'}
        </p>
      </section>
    )
  }

  const els = obs.elements ?? []
  const c = { verde: 0, ambar: 0, rojo: 0, claro: 0 }
  for (const e of els) c[e.cls] = (c[e.cls] ?? 0) + 1
  return (
    <section className="panel pantalla" aria-label="Pantalla actual">
      <header className="sec-cab">
        <div>
          <p className="eyebrow">Pantalla actual | {hora(screen.recibida)}</p>
          <h2>{nombreApp(obs.app)} <span className="soft">{nombrePantalla(obs.screen)}</span></h2>
        </div>
        <span className="sp" />
        {obs.paused && <span className="p8-estado p8-estado--aviso">En pausa: {obs.paused}</span>}
        {!SIN_PROTOCOLO && (
          <span className="cuentas">
            <span className="p8-estado p8-estado--seguro">{c.verde} lo ve 8</span>
            <span className="p8-estado p8-estado--aviso">{c.ambar} tokenizados</span>
            <span className="p8-estado p8-estado--bloqueo">{c.rojo} nunca salen</span>
          </span>
        )}
      </header>
      {dosPantallas(real) && (
        <div className="pantalla-dos"><DosPantallas frame={frame} real={real} nota={NOTA_REAL} /></div>
      )}
      <div className="tabla" role="table" aria-label="Lo que ves frente a lo que ve la IA">
        <div className="fila cabecera" role="row">
          <span role="columnheader">Elemento</span>
          <span role="columnheader">Lo que ves <em>{SIN_PROTOCOLO ? 'en pantalla' : 'solo en local'}</em></span>
          <span role="columnheader">Lo que ve la IA <em>{SIN_PROTOCOLO ? 'en claro' : 'tokens'}</em></span>
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
                <span className="tecnico">{el.label ? `${el.role} | ${el.id}` : el.id}</span>
              </span>
              <span role="cell"><Celda largo={largo}><Real real={r.text} observado={el.text} /></Celda></span>
              <span role="cell"><Celda largo={largo}>{SIN_PROTOCOLO ? <EnClaro text={el.text} valores={el.claro} /> : <Tokens text={el.text} valores={valores} />}</Celda></span>
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
const ES_LLAMADA = /^(observe|act|oracle)\b|\{"/

function describir(e, etiquetas) {
  const lugar = (id) => etiquetas[`${e.app}|${e.screen}|${id}`]
  const d = limpio(e.detail)
  switch (e.kind) {
    case 'observe_sent': {
      const titulo = `Lee ${nombreApp(e.app)} - ${nombrePantalla(e.screen)}`
      if (e.claro != null) return { tono: e.claro ? 'bloqueo' : 'neutro', titulo, detalle: `Pantalla entera al modelo | ${e.claro} ${e.claro === 1 ? 'valor real' : 'valores reales'} en claro` }
      return { tono: 'neutro', titulo, detalle: e.counts ? `${e.counts.verde} visibles | ${e.counts.ambar} tokenizados | ${e.counts.rojo} nunca salen` : null }
    }
    case 'act': {
      const [, op, target, ...resto] = (e.model_saw ?? '').split(' ')
      const texto = resto.join(' ')
      if (op === 'open_app') return { tono: 'neutro', titulo: `Abre ${nombreApp(target)}` }
      if (op === 'call') return { tono: 'neutro', titulo: 'Llama', detalle: [target, ...resto].join(' ') || null }
      const donde = lugar(target)
      return { tono: 'neutro', titulo: `${OP[op] ?? op}${donde ? ` «${donde}»` : target ? ` ${target}` : ''}`, detalle: texto || null }
    }
    case 'blocked': return { tono: 'bloqueo', titulo: `Bloqueado: ${e.reason ?? 'sin motivo'}`, detalle: d ?? e.model_saw, extra: e.model_saw && d ? e.model_saw : null }
    case 'held': return { tono: 'aviso', titulo: 'Retenido hasta que confirmes', detalle: `${e.model_saw ?? ''} | ${e.confirm}` }
    case 'approval': return e.approved_by ? { tono: 'seguro', titulo: `Aprobado por ${e.approved_by}`, detalle: e.confirm } : { tono: 'bloqueo', titulo: 'Rechazado', detalle: e.confirm }
    case 'task': {
      const detalle = e.model_saw || d
      if (!detalle) return null
      if (/recib/i.test(e.detail ?? '')) return { tono: 'cobalto', titulo: 'Encargo recibido', detalle: d }
      if (/inicio/i.test(e.detail ?? '') && e.model_saw) return { tono: 'cobalto', titulo: 'Empieza el encargo', detalle: e.model_saw, extra: d }
      if (!e.model_saw && /^fin\b/i.test(e.detail ?? '')) return { tono: 'seguro', titulo: 'Encargo terminado', detalle: d }
      if (!e.model_saw && /l[ií]mite|error/i.test(e.detail ?? '')) return { tono: 'aviso', titulo: 'Encargo detenido', detalle: d }
      if (e.model_saw && ES_LLAMADA.test(e.model_saw)) {
        const herramientas = [...new Set(e.model_saw.split(';').map((x) => x.trim().split(' ')[0]))].join(', ')
        return { tono: 'neutro', titulo: `Decide: ${herramientas}`, detalle: d }
      }
      return { tono: 'cobalto', titulo: '8 informa', detalle }
    }
    case 'paused': return { tono: 'aviso', titulo: 'En pausa', detalle: d }
    case 'oracle': return { tono: 'neutro', titulo: 'Pregunta al oráculo', detalle: e.model_saw }
    default: return { tono: 'neutro', titulo: e.kind, detalle: e.model_saw ?? d }
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
          <p className="eyebrow">{SIN_PROTOCOLO ? 'Sin registro firmado' : 'Registro firmado'}</p>
          <h2>Actividad</h2>
        </div>
        <span className="sp" />
        <Verificar />
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
          if (!d) return null
          const ms = (e.ms?.core ?? 0) + (e.ms?.adapter ?? 0) + (e.ms?.model ?? 0)
          return (
            <li key={e.seq} className={`evento t-${d.tono}`}>
              <i className="punto" aria-hidden="true" />
              <div className="cuerpo">
                <div className="linea1">
                  <b>{d.titulo}</b>
                  <span className="sp" />
                  <span className="meta">#{e.seq} | {hora(e.ts)}</span>
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
        {lat.map(([k, v]) => <span key={k}><em>{k}</em> {v == null ? 'sin datos' : `${v} ms`}</span>)}
      </footer>
    </section>
  )
}

// ---------------------------------------------------------------- app

export default function App() {
  const { status, screen, audit, pending, resolve, alerts, review, valores, etiquetas, enClaro, fin, chat, confirmaciones, session, pedir, linea, frame, real } = useEvents()
  const ahora = useAhora()
  // La reproducción vive aquí para que no se pierda al cambiar de pestaña.
  const rep = useReproduccion(linea, valores)
  const [vista, ir] = useVista()
  const sinRevisar = alerts.filter((a) => !a.revisada).length
  const bloqueos = audit.filter((x) => x.kind === 'blocked').length
  const atencion = pending.length + sinRevisar

  useEffect(() => {
    document.title = `${atencion ? `(${atencion}) ` : ''}Priv8 - Consola`
  }, [atencion])

  const avisos = {
    directo: { n: pending.length, tono: 'aviso', texto: `${pending.length} por confirmar` },
    alarmas: { n: sinRevisar, tono: 'bloqueo', texto: `${sinRevisar} sin revisar` },
    registro: { n: bloqueos, tono: 'neutro', texto: `${bloqueos} bloqueos` },
  }

  return (
    <div className={`app ${vista === 'directo' ? 'en-directo' : ''} ${SIN_PROTOCOLO ? 'sin-protocolo' : ''} ${FEED ? 'en-feed' : ''}`}>
      <Barra status={status} vista={vista} ir={ir} avisos={avisos} />
      {vista === 'directo' && (
        <div className="vista-directo">
          <EnDirecto audit={audit} pending={pending} status={status} etiquetas={etiquetas} enClaro={enClaro} fin={fin} ahora={ahora} rep={rep} frame={frame} real={real} />
          <aside className="lado" aria-label="Razonamiento y chat">
            <Razonamiento rep={rep} />
            <Chat chat={chat} confirmaciones={confirmaciones} resolve={resolve} pedir={pedir} status={status} session={session} valores={valores} ahora={ahora} />
          </aside>
        </div>
      )}
      {vista === 'alarmas' && (
        <main className="vista">
          {alerts.length
            ? <Alarmas alerts={alerts} review={review} comentario={comentarioDe8(audit)} valores={valores} />
            : <section className="panel vacio-panel"><h2>Sin alarmas</h2><p>Si un correo pide cambiar una cuenta, da órdenes a la IA o el núcleo bloquea algo, aparecerá aquí.</p></section>}
        </main>
      )}
      {vista === 'pantalla' && <main className="vista"><Pantalla screen={screen} status={status} valores={valores} frame={frame} real={real} /></main>}
      {vista === 'registro' && <main className="vista"><Actividad audit={audit} etiquetas={etiquetas} valores={valores} /></main>}
    </div>
  )
}
