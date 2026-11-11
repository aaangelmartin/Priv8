// Reproductor de una sesión real grabada (?feed=sesion-b2b, #170).
//
// scripts/grabar_sesion.py guarda todo lo que recibe la consola en una sesión real (cada
// mensaje con su segundo `at`, los fotogramas de la vista de 8 y los de la ventana real) y
// la consola lo vuelve a recibir al mismo ritmo, como si estuviera conectada al núcleo. Aquí
// solo el reloj y lo que toca en cada momento: sin React ni DOM, para probarlo con node.
//
//   { formato: 'priv8-sesion/1', duracion, eventos: [{at, msg}], real: [{at, src, w, h, app}] }

export const VELOCIDADES = [1, 2, 4]
export const esSesion = (feed) => typeof feed === 'string' && /^sesion-[a-z0-9-]+$/.test(feed)

// Lo que hay que entregar entre dos momentos: los mensajes con at en (desde, hasta] en orden,
// y el último fotograma real de ese tramo (solo cuenta el último: es el que se ve).
export function tramo(sesion, i, j, hasta) {
  const ev = sesion?.eventos ?? []
  const re = sesion?.real ?? []
  const msgs = []
  const ats = [] // el segundo de cada mensaje: la hora con la que lo registra la consola
  while (i < ev.length && ev[i].at <= hasta) { ats.push(ev[i].at); msgs.push(ev[i++].msg) }
  let real = null
  while (j < re.length && re[j].at <= hasta) real = re[j++]
  return { msgs, ats, real, i, j }
}

// Fotogramas que conviene tener ya descargados: los de los próximos `s` segundos.
export function proximos(sesion, desde, s = 3) {
  const out = []
  for (const e of sesion?.eventos ?? []) {
    if (e.at > desde + s) break
    if (e.at > desde && e.msg?.type === 'frame' && e.msg.src) out.push(e.msg.src)
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
