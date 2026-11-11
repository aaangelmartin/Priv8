// 8 en la ventana de Chromium (#135, #154): su cursor son sus ojos, vivos, y habla en bocadillos.
//
// adapter.py lo instala en cada página (add_init_script) con el motor de los ojos de la web
// (apps/console/src/eight/engine.js) y las fuentes de la marca: (createEngine, FONTS) => {...}.
// Deja window.__p8ocho con:
//
//   go({op: 'move'|'tap'|'type', ref | x, y, verb, label, escribe, from, nowait})
//        lleva el cursor al elemento (data-p8-ref) o al punto; con verb dice «Pulso «Registrar»».
//        escribe: en la vista de 8, el texto (con tokens) que va apareciendo en el campo.
//        Devuelve [x, y] al llegar (o enseguida con nowait), false si no encuentra el destino.
//   modo(m)        cara de 8: leer, pensar, hablar, esperar, enfado, listo, apartar, mirar…
//   di({texto, eyebrow, tono, ms})   bocadillo como el de 8 en el chat de la consola, tecleado;
//                  los tokens ‹…› van en su chip. Uno cada vez: el nuevo sustituye al anterior.
//   done()  hide()  velo({titulo, texto} | null)  aviso(texto | null)
//
// Pares de fotogramas (#187): la vista de 8 no anima su propio cursor. En cada captura el
// adaptador congela el de la pestaña real (congelar: pausa sus animaciones y fija los ojos en
// una copia quieta), le pide su estado, lo copia tal cual en la vista de 8 (fijar) y fotografía
// las dos; luego lo suelta (soltar). El estado nunca lleva texto de la pestaña real: del
// bocadillo solo dice de dónde salió (el id que le puso el adaptador, o el verbo y el elemento
// de un go) y cuánto lleva escrito; la vista de 8 pone su propio texto, con tokens.
//
// Vive en un shadow root colgado de <html>, fuera de #root, con data-p8-ignore y aria-hidden:
// el snapshot no entra en él y la vista de 8 lo quita de la copia. Sin eventos de puntero.
(createEngine, FONTS) => {
  if (window.__p8ocho) return true
  const COB = '#2D45D6'
  const NIEBLA = '#EEF2F8'
  const MODOS = new Set(['mirar', 'leer', 'pensar', 'hablar', 'esperar', 'enfado', 'listo', 'apartar', 'asentir', 'negar',
    'cargando', 'saludar', 'atencion', 'duda', 'sorpresa', 'tristeza', 'disculpa', 'alegria', 'curiosidad', 'rechazar'])
  const st = { pos: null, modo: 'mirar', bt: 0, tt: 0, quita: 0, eng: null, ojos: null, velo: null,
    fuente: null, bi: 0, bn: 0, congelado: false, esclavo: false }
  let host = null
  let sh = null
  let fuentes = null

  const cargarFuentes = () => {
    if (fuentes) return fuentes
    const caras = []
    try {
      for (const [fam, peso, b64] of FONTS || []) {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const ff = new FontFace(fam, bin, { weight: String(peso) })
        document.fonts.add(ff)
        caras.push(ff.loaded)
      }
    } catch { /* sin fuentes: las del sistema */ }
    fuentes = Promise.race([Promise.all(caras), new Promise((r) => setTimeout(r, 1500))]).catch(() => {})
    return fuentes
  }

  const CSS = `
:host { all: initial }
* { box-sizing: border-box; pointer-events: none }
/* 8 tal cual (el cursor de #143): el 8 cobalto con un borde fino blanco y los ojos con su fondo,
   sin píldora alrededor; ahora vivo con el motor de los ojos. */
.cur { position: fixed; left: 0; top: 0; width: 48px; height: 34px; margin: -17px 0 0 -24px;
       opacity: 0; transition: opacity .2s ease; will-change: transform }
.cur.on { opacity: 1 }
.ojos { position: absolute; left: -11px; top: -18px; width: 70px; height: 70px;
        filter: drop-shadow(0 0 .8px #fff) drop-shadow(0 0 .8px #fff) drop-shadow(0 0 .6px #fff) drop-shadow(0 2px 4px rgba(11, 27, 51, .3)) }
.ojos svg { display: block; width: 100%; height: 100%; overflow: visible }
/* El bocadillo de 8 de la web (apps/landing, Companion): blanco, esquinas redondas y la que da a 8
   más cerrada, sin cola; a su lado y por encima de los ojos; el texto entra letra a letra. */
.bub { position: absolute; left: 50px; bottom: 14px; width: max-content; max-width: 280px; padding: 11px 15px;
       border-radius: 20px; border-bottom-left-radius: 6px; background: #fff; color: #0B1B33;
       font: 400 15px/1.5 "P8 Plex Sans", "IBM Plex Sans", system-ui, -apple-system, sans-serif;
       overflow-wrap: anywhere; box-shadow: inset 0 0 0 1px #DDE3F3, 0 1px 2px rgba(11, 27, 51, .05), 0 10px 28px rgba(11, 27, 51, .14);
       opacity: 0; transform: translateY(6px); transition: opacity .3s cubic-bezier(.2, .8, .2, 1), transform .3s cubic-bezier(.2, .8, .2, 1) }
.bub.on { opacity: 1; transform: none }
.bub.izq { left: auto; right: 50px; border-bottom-left-radius: 20px; border-bottom-right-radius: 6px }
.bub.abajo { bottom: auto; top: 24px; border-bottom-left-radius: 20px; border-top-left-radius: 6px; transform: translateY(-6px) }
.bub.abajo.on { transform: none }
.bub.izq.abajo { border-top-left-radius: 20px; border-top-right-radius: 6px }
.bub .tx span.fant { visibility: hidden }
.eb { display: block; margin-bottom: 3px; font: 500 11px/1.3 "P8 Plex Mono", "IBM Plex Mono", ui-monospace, monospace; color: ${COB} }
.eb:empty { display: none }
.bub.t-bloqueo .eb { color: #A83228 }
.bub.t-aviso .eb { color: #8A5200 }
.bub.t-seguro .eb { color: #18734C }
.tok { font: 600 .86em/1.4 "P8 Plex Mono", "IBM Plex Mono", ui-monospace, monospace; background: #E4E9FD; color: #2236B5;
       border-radius: 8px; padding: .12em .5em; white-space: nowrap }
.caret { display: inline-block; width: 2px; height: 1em; margin-left: 1px; vertical-align: -2px; background: ${COB};
         animation: parpadeo 1s steps(1) infinite }
@keyframes parpadeo { 50% { opacity: 0 } }
.ring { position: fixed; border-radius: 8px; opacity: 0; transition: opacity .2s ease;
        box-shadow: 0 0 0 2px ${COB}, 0 0 0 6px rgba(45, 69, 214, .18) }
.ring.on { opacity: 1 }
.rip { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
       border: 2px solid ${COB}; background: rgba(45, 69, 214, .14) }
.velo { position: fixed; inset: 0; display: none; place-content: center; justify-items: center; gap: 10px; text-align: center;
        background: rgba(238, 242, 248, .94); color: #0B1B33; font: 400 15px/1.5 "P8 Plex Sans", "IBM Plex Sans", system-ui, sans-serif }
.velo.on { display: grid }
.velo .grande { width: 120px; height: 120px }
.velo .grande svg { display: block; width: 100%; height: 100%; overflow: visible }
.velo b { font: 700 24px/1.2 "P8 Sora", Sora, system-ui, sans-serif; letter-spacing: -.02em }
.velo span { max-width: 44ch; color: #4E5A72 }
.aviso { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); display: none; padding: 8px 16px; border-radius: 999px;
         background: ${COB}; color: #fff; font: 500 13px/1.2 "P8 Plex Sans", "IBM Plex Sans", system-ui, sans-serif;
         box-shadow: 0 8px 22px rgba(45, 69, 214, .3) }
.aviso.on { display: block }
`

  const crear = () => {
    if (host && host.isConnected) return
    host = document.getElementById('p8-cursor-8')
    if (!host) {
      host = document.createElement('div')
      host.id = 'p8-cursor-8'
      host.setAttribute('data-p8-ignore', '')
      host.setAttribute('aria-hidden', 'true')
      host.setAttribute('role', 'presentation')
      host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;'
      host.attachShadow({ mode: 'open' })
      host.shadowRoot.innerHTML = `<style>${CSS}</style>
<div class="velo"><div class="grande"></div><b></b><span></span></div>
<div class="aviso"></div>
<div class="ring"></div>
<div class="cur"><div class="ojos"></div><div class="bub"><span class="eb"></span><span class="tx"></span></div></div>`
      document.documentElement.appendChild(host)
    }
    sh = host.shadowRoot
    cargarFuentes().then(() => {
      try {
        if (!st.eng) st.eng = createEngine()
        if (!st.ojos && !st.esclavo) {
          st.ojos = st.eng.mount(sh.querySelector('.ojos'), { mode: st.modo, col: { fg: COB, cut: '#FFFFFF' } })
          st.ojos.forced = [-0.3, 0.35, 0]
        }
      } catch { /* sin motor: el óvalo cobalto sigue ahí */ }
    })
  }
  const q = (s) => sh.querySelector(s)
  const at = (x, y, rot = 0) => `translate(${x}px, ${y}px) rotate(${rot}deg)`
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const pintar = (nodo, texto) => {
    nodo.replaceChildren()
    const s = String(texto ?? '')
    let pos = 0
    for (const m of s.matchAll(/‹[^›]{1,80}›/g)) {
      if (m.index > pos) nodo.append(s.slice(pos, m.index))
      const t = document.createElement('span')
      t.className = 'tok'
      t.textContent = m[0]
      nodo.append(t)
      pos = m.index + m[0].length
    }
    if (pos < s.length) nodo.append(s.slice(pos))
  }

  // El bocadillo, a un lado del cursor según dónde quede sitio.
  const colocar = () => {
    const b = q('.bub')
    const [x, y] = st.pos || [innerWidth / 2, innerHeight * 0.8]
    b.classList.toggle('izq', x > innerWidth - 400)
    b.classList.toggle('abajo', y < 150)
  }

  const mostrar = () => {
    crear()
    if (!st.pos) {
      st.pos = [Math.round(innerWidth * 0.5), Math.round(innerHeight * 0.82)]
      q('.cur').style.transform = at(st.pos[0], st.pos[1])
    }
    q('.cur').classList.add('on')
  }

  const modo = (m) => {
    crear()
    const k = MODOS.has(m) ? m : 'mirar'
    st.modo = k
    if (st.ojos && st.ojos.mode !== k) st.ojos.setMode(k)
    if (k === 'leer' || k === 'pensar') st.ojos && (st.ojos.forced = null)
    else if (st.ojos) st.ojos.forced = [-0.3, 0.35, 0]
    return true
  }

  const di = (a) => {
    crear()
    mostrar()
    colocar()
    const b = q('.bub')
    const tx = q('.tx')
    q('.eb').textContent = ''
    b.className = `bub on${b.classList.contains('izq') ? ' izq' : ''}${b.classList.contains('abajo') ? ' abajo' : ''}`
    clearInterval(st.tt)
    clearTimeout(st.bt)
    // Como en la web: el texto que falta ocupa ya su sitio (invisible), así el bocadillo no crece a saltos.
    const full = String(a.texto || '')
    const paso = Math.max(1, Math.ceil(full.length / 60))
    let i = 0
    // De dónde sale el texto, para que la vista de 8 ponga el suyo (con tokens) en el mismo punto.
    st.fuente = a.id != null ? { id: a.id } : (a.fuente || null)
    st.bi = 0
    st.bn = full.length
    const fant = document.createElement('span')
    fant.className = 'fant'
    const pon = () => { fant.textContent = full.slice(i); tx.replaceChildren(full.slice(0, i), fant) }
    pon()
    st.tt = setInterval(() => {
      if (st.congelado) return
      i += paso
      st.bi = Math.min(i, full.length)
      if (i >= full.length) { clearInterval(st.tt); pintar(tx, full); return }
      pon()
    }, 20)
    st.bt = setTimeout(() => b.classList.remove('on'), a.ms || 5200)
    return true
  }

  const nombreDe = (el) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const lf = el.id && document.querySelector(`label[for="${window.CSS.escape(el.id)}"]`)
    // En la vista de 8, lo que el modelo no leyó es un marcador (.p8-x): no es un nombre.
    const texto = (n) => { const c = n.cloneNode(true); c.querySelectorAll('.p8-x').forEach((x) => x.remove()); return c.textContent }
    let n = clean(el.dataset.p8Label || el.getAttribute('aria-label') || (lf && texto(lf)) || el.getAttribute('placeholder') || texto(el))
    if (n.length > 34) n = n.slice(0, 33) + '…'
    return n
  }

  const go = async (a) => {
    crear()
    let x = a.x
    let y = a.y
    let rect = null
    let nombre = null
    const el = a.ref ? document.querySelector(`[data-p8-ref="${window.CSS.escape(a.ref)}"]`) : null
    if (el) {
      const r = el.getBoundingClientRect()
      rect = [r.left, r.top, r.right, r.bottom]
      x = r.left + r.width / 2
      y = r.top + r.height / 2
      if (a.op === 'type') { x = Math.min(x, r.left + 40); y = Math.min(r.bottom, r.top + 40) + 14 }
      nombre = nombreDe(el)
    }
    if (x == null || y == null) return false
    x = Math.round(x)
    y = Math.round(y)
    const from = a.from || st.pos || [Math.round(innerWidth / 2), Math.round(innerHeight * 0.85)]
    const cur = q('.cur')
    const ring = q('.ring')
    ring.classList.remove('on')
    mostrar()
    if (a.verb) di({ texto: nombre ? `${a.verb} «${nombre}»` : a.verb, ms: a.op === 'type' ? 3200 : 2400, fuente: { ref: a.ref || null, verb: a.verb } })
    else if (a.label) di({ texto: a.label, ms: 2400 })
    modo(a.op === 'type' ? 'hablar' : 'mirar')

    // Desliza de 350 a 500 ms según la distancia; la mirada va por delante, hacia el destino.
    const dx = x - from[0]
    const dy = y - from[1]
    const dist = Math.hypot(dx, dy)
    const dur = Math.round(Math.min(500, 350 + dist / 6))
    const tilt = Math.max(-8, Math.min(8, dx / 40))
    if (st.ojos && dist > 2) st.ojos.forced = [Math.max(-1, Math.min(1, dx / Math.max(dist, 1))), Math.max(-1, Math.min(1, dy / Math.max(dist, 1))), tilt]
    st.pos = [x, y]
    colocar()
    const llegar = async () => {
      if (dist > 2 && cur.animate) {
        const anim = cur.animate(
          [{ transform: at(from[0], from[1]) },
            { transform: at(from[0] + dx * 0.6, from[1] + dy * 0.6, tilt), offset: 0.6 },
            { transform: at(x, y) }],
          { duration: dur, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' })
        // Las capturas la pausan un momento (congelar): el plazo de reserva va holgado.
        await Promise.race([anim.finished.catch(() => {}), wait(dur * 3 + 600)])
        anim.cancel()
      }
      cur.style.transform = at(x, y)
      if (st.ojos) st.ojos.forced = a.op === 'type' ? [-0.5, 0.6, -6] : [-0.3, 0.45, 0]
      clearTimeout(st.quita)
      if (a.op === 'tap') {
        const rip = document.createElement('div')
        rip.className = 'rip'
        rip.style.left = x + 'px'
        rip.style.top = y + 'px'
        sh.appendChild(rip)
        const r = rip.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }],
          { duration: 520, easing: 'ease-out', fill: 'forwards' })
        r.finished.catch(() => {}).then(() => rip.remove())
        setTimeout(() => rip.remove(), 900)
        cur.animate([{ transform: at(x, y) }, { transform: at(x, y) + ' scale(.86)' }, { transform: at(x, y) }],
          { duration: 180, easing: 'ease-out' })
      }
      if (a.op === 'type' && rect) {
        const [l, t, rr, b] = rect
        Object.assign(ring.style, { left: (l - 3) + 'px', top: (t - 3) + 'px', width: (rr - l + 6) + 'px', height: (b - t + 6) + 'px' })
        ring.classList.add('on')
        // En la vista de 8 el campo va mostrando lo que escribe 8: sus tokens, nunca el valor.
        if (a.escribe != null && el && 'value' in el) {
          const s = String(a.escribe)
          let i = 0
          const paso = Math.max(1, Math.ceil(s.length / 16))
          const id = setInterval(() => { i += paso; el.value = s.slice(0, i); if (i >= s.length) clearInterval(id) }, 30)
        }
      }
      return [x, y]
    }
    if (a.nowait) { llegar(); return [x, y, dur] }
    return llegar()
  }

  const done = () => {
    crear()
    q('.ring').classList.remove('on')
    modo('mirar')
    return true
  }
  const hide = () => {
    crear()
    q('.cur').classList.remove('on')
    q('.ring').classList.remove('on')
    return true
  }
  // Toda la pantalla tapada (8 mira a otro lado), con sus ojos en grande.
  const velo = (v) => {
    crear()
    const el = q('.velo')
    if (!v) { el.classList.remove('on'); return true }
    el.querySelector('b').textContent = v.titulo || ''
    el.querySelector('span').textContent = v.texto || ''
    el.classList.add('on')
    if (!st.velo && st.eng) {
      try { st.velo = st.eng.mount(el.querySelector('.grande'), { mode: 'apartar', col: { fg: COB, cut: NIEBLA } }) } catch { /* sin motor */ }
    }
    if (st.velo) st.velo.setMode(v.modo || 'apartar')
    return true
  }
  const aviso = (t) => {
    crear()
    const el = q('.aviso')
    el.textContent = t || ''
    el.classList.toggle('on', !!t)
    return true
  }

  // ---- pares de fotogramas (#187) ----
  const cs = (el) => getComputedStyle(el)
  // Pestaña real: congela la capa (animaciones en pausa, los ojos en una copia quieta encima de
  // los vivos) y devuelve su estado, sin ningún texto suyo. Hasta soltar() no se mueve nada.
  const congelar = () => {
    crear()
    st.congelado = true
    // Solo las que están en marcha: una ya terminada (fill: forwards) volvería a empezar al soltarla.
    st.pausadas = sh.getAnimations().filter((an) => an.playState === 'running')
    for (const an of st.pausadas) { try { an.pause() } catch { /* nada */ } }
    const caja = q('.ojos')
    caja.querySelectorAll('.p8-fijo').forEach((n) => n.remove())
    const vivo = caja.querySelector('svg')
    let ojos = ''
    if (vivo) {
      // La copia lleva sus propios ids: el cuerpo del 8 y los ojos se recortan con clipPath
      // (url(#id)), y con los ids repetidos apuntarían a los del original, oculto, y el 8
      // cobalto desaparecería de la captura (solo quedaban los ojos blancos). La vista de 8
      // recibe esta misma copia, así las dos pantallas llevan el mismo SVG.
      ojos = vivo.outerHTML.replace(/\bid="([^"]+)"/g, 'id="$1-fijo"').replace(/url\(#([^)"']+)\)/g, 'url(#$1-fijo)')
      const t = document.createElement('template')
      t.innerHTML = ojos
      const fijo = t.content.firstElementChild
      if (fijo) {
        fijo.classList.add('p8-fijo')
        fijo.style.cssText = 'position:absolute;inset:0'
        vivo.style.visibility = 'hidden'
        caja.append(fijo)
      }
    }
    const cur = q('.cur')
    const ring = q('.ring')
    const b = q('.bub')
    return {
      cur: { cls: cur.className, transform: cs(cur).transform, opacity: cs(cur).opacity },
      ojos,
      ring: { cls: ring.className, opacity: cs(ring).opacity, left: ring.style.left, top: ring.style.top,
        width: ring.style.width, height: ring.style.height },
      bub: { cls: b.className, opacity: cs(b).opacity, transform: cs(b).transform, fuente: st.fuente, i: st.bi, n: st.bn },
      rips: [...sh.querySelectorAll('.rip')].map((r) => ({ left: r.style.left, top: r.style.top,
        transform: cs(r).transform, opacity: cs(r).opacity })),
    }
  }
  const soltar = () => {
    if (!sh) return true
    const caja = q('.ojos')
    caja.querySelectorAll('.p8-fijo').forEach((n) => n.remove())
    const vivo = caja.querySelector('svg')
    if (vivo) vivo.style.visibility = ''
    for (const an of st.pausadas || []) {
      try {
        if (an.playState !== 'paused') continue
        // Pausada justo en su final: play() la rebobinaría y volvería a empezar; se termina.
        const fin = an.effect ? an.effect.getComputedTiming().endTime : Infinity
        if (an.currentTime != null && an.currentTime >= fin) an.finish()
        else an.play()
      } catch { /* nada */ }
    }
    st.pausadas = []
    st.congelado = false
    return true
  }
  // Vista de 8: pone la capa exactamente como la de la pestaña real (e, de congelar), sin
  // animaciones propias. e.texto es el texto del bocadillo con tokens (lo da el adaptador); si
  // el bocadillo salió de un go, el nombre del elemento es el de esta copia, ya censurada.
  const fijar = (e) => {
    crear()
    st.esclavo = true
    if (st.ojos && st.eng) { try { st.eng.unmount(st.ojos) } catch { /* nada */ } st.ojos = null }
    clearInterval(st.tt)
    clearTimeout(st.bt)
    clearTimeout(st.quita)
    for (const an of sh.getAnimations()) { try { an.cancel() } catch { /* nada */ } }
    sh.querySelectorAll('.rip').forEach((r) => r.remove())
    const cur = q('.cur')
    const ring = q('.ring')
    const b = q('.bub')
    const quieto = (el, est) => { el.style.transition = 'none'; el.style.animation = 'none'; Object.assign(el.style, est) }
    if (!e) {
      quieto(cur, { opacity: '0' })
      quieto(ring, { opacity: '0' })
      quieto(b, { opacity: '0' })
      return true
    }
    cur.className = e.cur.cls
    quieto(cur, { transform: e.cur.transform === 'none' ? '' : e.cur.transform, opacity: e.cur.opacity })
    q('.ojos').innerHTML = e.ojos || ''
    ring.className = e.ring.cls
    quieto(ring, { opacity: e.ring.opacity, left: e.ring.left, top: e.ring.top, width: e.ring.width, height: e.ring.height })
    b.className = e.bub.cls
    quieto(b, { opacity: e.bub.opacity, transform: e.bub.transform === 'none' ? 'none' : e.bub.transform })
    let texto = e.texto
    const f = e.bub.fuente
    if (texto == null && f && f.verb) {
      const el = f.ref ? document.querySelector(`[data-p8-ref="${window.CSS.escape(f.ref)}"]`) : null
      const nombre = el ? nombreDe(el) : ''
      texto = nombre ? `${f.verb} «${nombre}»` : f.verb
    }
    const tx = q('.tx')
    q('.eb').textContent = ''
    if (texto == null) { tx.replaceChildren(); quieto(b, { opacity: '0' }) } else {
      const s = String(texto)
      const n = Math.max(1, e.bub.n || 0)
      if ((e.bub.i || 0) >= n) pintar(tx, s)
      else {
        // El mismo punto del tecleo, en proporción; sin partir un token por la mitad.
        let k = Math.round(s.length * Math.max(0, e.bub.i || 0) / n)
        const abre = s.lastIndexOf('‹', k - 1)
        if (abre >= 0 && s.indexOf('›', abre) >= k) k = abre
        const fant = document.createElement('span')
        fant.className = 'fant'
        fant.textContent = s.slice(k)
        tx.replaceChildren(s.slice(0, k), fant)
      }
    }
    for (const r of e.rips || []) {
      const d = document.createElement('div')
      d.className = 'rip'
      Object.assign(d.style, { left: r.left, top: r.top, transform: r.transform === 'none' ? '' : r.transform, opacity: r.opacity })
      sh.appendChild(d)
    }
    return true
  }

  Object.defineProperty(window, '__p8ocho', {
    value: { go, modo, di, done, hide, velo, aviso, congelar, soltar, fijar, pos: () => st.pos },
    configurable: true,
  })
  return true
}
