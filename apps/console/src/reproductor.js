// Reproductor de una sesión real grabada (?feed=sesion-b2b, #170).
//
// scripts/grabar_sesion.py guarda todo lo que recibe la consola en una sesión real (cada
// mensaje con su segundo `at`, los fotogramas de la vista de 8 y los de la ventana real) y
// la consola lo vuelve a recibir al mismo ritmo, como si estuviera conectada al núcleo. Aquí
// solo el reloj y lo que toca en cada momento: sin React ni DOM, para probarlo con node.
//
//   { formato: 'priv8-sesion/1', duracion, eventos: [{at, msg}],
//     pares: [{at, par, real: {src, w, h, app, par} | null, ocho: {src, w, h, app, screen, fresh, paused, par}}],
//     real: [{at, src, w, h, app}] }
//
// Pares (#187): en web, «Lo que ves tú» y «Lo que ve el modelo» se capturan juntas y van juntas;
// la consola siempre pinta las dos del mismo par y, si en un momento no hay par nuevo, sigue con
// el anterior en las dos. `real` suelto solo queda en Android (no hay vista de 8: el modelo se
// dibuja con los mensajes screen). Las grabaciones anteriores (vista de 8 en `eventos`, pestaña
// real en `real`, cada una a su ritmo) se emparejan al cargarlas (migrar), como hace
// scripts/casos_comun.py: cada real con la vista de 8 más cercana en el tiempo, sin volver atrás.

export const VELOCIDADES = [1, 2, 4]
export const esSesion = (feed) => typeof feed === 'string' && /^sesion-[a-z0-9-]+$/.test(feed)

const esVista8 = (m) => m?.type === 'frame' && m.vista !== 'real'

// Pares de dos listas sueltas (grabaciones anteriores): cada real con la vista de 8 más cercana en
// el tiempo; el índice nunca retrocede y el par sale cuando ya existen los dos. Sin reales, cada
// vista sola (la pantalla de la persona se dibuja en esquema).
export function emparejar(vistas, reales) {
  const vs = [...vistas].sort((a, b) => a.at - b.at)
  const rs = [...reales].sort((a, b) => a.at - b.at)
  if (!rs.length) return vs.map((v, k) => ({ at: v.at, par: k + 1, real: null, ocho: { ...v.msg, par: k + 1 } }))
  if (!vs.length) return []
  const out = []
  let k = 0
  for (const r of rs) {
    while (k + 1 < vs.length && Math.abs(vs[k + 1].at - r.at) <= Math.abs(vs[k].at - r.at)) k++
    const v = vs[k]
    const n = out.length + 1
    const at = Math.max(r.at, v.at, out.length ? out[out.length - 1].at : 0)
    const { at: _, ...real } = r
    out.push({ at: Math.round(at * 1000) / 1000, par: n, dt: Math.round((v.at - r.at) * 1000) / 1000,
      real: { ...real, par: n }, ocho: { ...v.msg, par: n } })
  }
  return out
}

// Una sesión del formato anterior con sus fotogramas en pares; las demás, tal cual.
export function migrar(d) {
  if (!d || Array.isArray(d.pares)) return d
  const ev = d.eventos ?? []
  const vistas = ev.filter((e) => esVista8(e.msg))
  if (!vistas.length) return d
  return { ...d, eventos: ev.filter((e) => !esVista8(e.msg)), real: [], pares: emparejar(vistas, d.real ?? []), migrado: true }
}

// ¿Cada par junta las dos pantallas del mismo paso? null si sí; si no, por qué. Lo mismo que
// casos_comun.pares_incoherentes (los grabadores no escriben una sesión que no lo cumpla).
export const PAR_DT_MAX = 0.6
export function paresIncoherentes(d) {
  const sueltos = (d?.eventos ?? []).filter((e) => e.msg?.type === 'frame')
  const pares = d?.pares
  if (!Array.isArray(pares)) return sueltos.some((e) => esVista8(e.msg)) ? 'fotogramas de la vista de 8 sueltos en eventos (sin pares)' : null
  if (sueltos.length) return `${sueltos.length} fotogramas sueltos en eventos además de los pares`
  if ((d.real ?? []).length) return 'pestaña real suelta además de los pares'
  let prevAt = -1
  let prevPar = 0
  for (const [i, p] of pares.entries()) {
    const { ocho: o, real: r } = p
    if (!o?.src) return `el par ${i} no tiene la vista de 8`
    if (r != null && !r.src) return `el par ${i} tiene la pestaña real vacía`
    if (!Number.isInteger(p.par) || p.par <= prevPar) return `el par ${i} no tiene un id creciente`
    if (o.par !== p.par || (r != null && r.par !== p.par)) return `el par ${i} junta fotogramas de pasos distintos`
    if (r != null && !d.migrado && (r.w !== o.w || r.h !== o.h)) return `el par ${i} junta pantallas de distinto tamaño`
    if (typeof p.at !== 'number' || p.at < prevAt) return `el par ${i} va antes que el anterior`
    if (d.migrado && Math.abs(p.dt ?? 0) > PAR_DT_MAX) return `el par ${i} junta fotogramas a ${Math.abs(p.dt).toFixed(2)} s`
    prevAt = p.at
    prevPar = p.par
  }
  return null
}

// Lo que hay que entregar entre dos momentos: los mensajes con at en (desde, hasta] en orden, el
// último par de ese tramo y la última captura real suelta (Android). Solo cuenta el último: es
// el que se ve; sin par nuevo, la consola sigue con el anterior en las dos pantallas.
export function tramo(sesion, i, j, hasta, k = 0) {
  const ev = sesion?.eventos ?? []
  const re = sesion?.real ?? []
  const pa = sesion?.pares ?? []
  const msgs = []
  const ats = [] // el segundo de cada mensaje: la hora con la que lo registra la consola
  while (i < ev.length && ev[i].at <= hasta) { ats.push(ev[i].at); msgs.push(ev[i++].msg) }
  let real = null
  while (j < re.length && re[j].at <= hasta) real = re[j++]
  let par = null
  while (k < pa.length && pa[k].at <= hasta) par = pa[k++]
  return { msgs, ats, real, par, i, j, k }
}

// Lo que llega a la consola de un par: el fotograma de la vista de 8 y la pestaña real, con el
// mismo id de par en los dos (la consola solo pinta juntos los del mismo par).
export function delPar(p) {
  if (!p?.ocho) return { frame: null, real: null }
  return { frame: { type: 'frame', vista: '8', ...p.ocho, par: p.par },
    real: p.real ? { ...p.real, vista: 'real', par: p.par } : null }
}

// Fotogramas que conviene tener ya descargados: los de los próximos `s` segundos.
export function proximos(sesion, desde, s = 3) {
  const out = []
  for (const e of sesion?.eventos ?? []) {
    if (e.at > desde + s) break
    if (e.at > desde && e.msg?.type === 'frame' && e.msg.src) out.push(e.msg.src)
  }
  for (const p of sesion?.pares ?? []) {
    if (p.at > desde + s) break
    if (p.at > desde) { if (p.real?.src) out.push(p.real.src); if (p.ocho?.src) out.push(p.ocho.src) }
  }
  for (const r of sesion?.real ?? []) {
    if (r.at > desde + s) break
    if (r.at > desde) out.push(r.src)
  }
  return out
}

export function valida(d) {
  return !!d && d.formato === 'priv8-sesion/1' && Array.isArray(d.eventos) && typeof d.duracion === 'number'
}

// El reloj: avanza con el tiempo real por la velocidad mientras está en marcha.
export function crearReloj() {
  const st = { t: 0, duracion: 0, enMarcha: true, velocidad: 1, terminado: false, reinicios: 0 }
  const oyentes = new Set()
  const avisar = () => oyentes.forEach((f) => f({ ...st }))
  return {
    get estado() { return { ...st } },
    get t() { return st.t },
    suscribir(f) { oyentes.add(f); f({ ...st }); return () => oyentes.delete(f) },
    cargar(duracion) { st.duracion = duracion; avisar() },
    // dt en segundos reales; un salto grande (pestaña en segundo plano) cuenta como mucho 0,25 s.
    avanzar(dt) {
      if (!st.enMarcha || st.terminado) return st.t
      st.t = Math.min(st.t + Math.min(Math.max(dt, 0), 0.25) * st.velocidad, st.duracion || Infinity)
      if (st.duracion && st.t >= st.duracion) { st.terminado = true; st.enMarcha = false }
      avisar()
      return st.t
    },
    alternar() { if (st.terminado) return this.reiniciar(); st.enMarcha = !st.enMarcha; avisar() },
    velocidad(v) { if (VELOCIDADES.includes(v)) { st.velocidad = v; avisar() } },
    reiniciar() { st.t = 0; st.terminado = false; st.enMarcha = true; st.reinicios += 1; avisar() },
    // Salta a un momento (#187). La consola se vuelve a montar desde cero y recibe de golpe todo lo
    // anterior a t (cuenta como un reinicio): alarmas, pantallas, registro, chat y confirmaciones
    // quedan como estaban en ese momento. Se queda en pausa o en marcha como estaba.
    saltar(t) {
      const max = st.duracion || 0
      st.t = Math.max(0, Math.min(Number(t) || 0, max))
      st.terminado = max > 0 && st.t >= max
      if (st.terminado) st.enMarcha = false
      st.reinicios += 1
      avisar()
    },
  }
}

export const reloj = crearReloj()
