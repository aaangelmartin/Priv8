// Vista de 8 (#154): la página que maneja 8, censurada en el DOM.
//
// Se evalúa en la pestaña real con page.evaluate(src, args), en dos fases:
//
//   fase 'textos'   si la página ha cambiado (MutationObserver, desplazamiento, foco, teclado)
//                   o la observación es otra, devuelve los textos visibles sin marcar (nodos de
//                   texto, valores y placeholders de campos); si no, null. El adaptador los pasa
//                   por el detector del núcleo (core.mask_text): solo lo sensible se tapa.
//   fase 'copia'    clona el documento y, en la copia (nunca en la página real), cambia:
//
//   elemento data-p8 con observación   su texto observado: verde tal cual, ámbar con sus
//                                      tokens ‹TIPO_n-etiqueta› y rojo «nunca sale»
//   elemento data-p8 sin observación   un marcador (aún no lo ha leído)
//   texto sin marcar                   la interfaz es libre: se queda tal cual salvo los datos
//                                      que encuentra el núcleo (a.mascaras: su token o un
//                                      marcador). Un texto que no está en a.mascaras (ha
//                                      aparecido entre las dos fases) sale como marcador.
//                                      Con a.estricto (modo estricto de la política, #177,
//                                      o el segundo intento tras el bloqueo final), solo lo que
//                                      el modelo recibió: el resto, marcador.
//   imágenes, lienzos y vídeos         cajas vacías del mismo tamaño
//   atributos                          solo los de presentación y los placeholder limpios;
//                                      fuera title, alt, aria-*, href, data-*…
//
// Devuelve el documento censurado como texto (head y body) y todo el texto que queda en él,
// para que el adaptador pase el bloqueo final antes de escribirlo en la página espejo.
//
// args: {fase, force, key, obs: {ref: {cls, text, label}}, sel: {ref: '#id'}, over: {ref: texto},
//        mascaras: {texto: null | [[t|tok|x, valor]]}, estricto, sueltos}
//   sueltos: pintar los textos sueltos que recibió el modelo (por defecto, sin a.estricto)
(a) => {
  const st = window.__p8v || (window.__p8v = { n: 1, sent: 0, key: null, mo: null })
  if (!st.mo) {
    const bump = () => { st.n++ }
    // Los ids que pone el propio adaptador (data-p8-ref, data-p8-pv…) no cuentan como cambio.
    st.mo = new MutationObserver((list) => {
      if (list.some((m) => !(m.type === 'attributes' && (m.attributeName || '').startsWith('data-p8')))) bump()
    })
    st.mo.observe(document, { subtree: true, childList: true, characterData: true, attributes: true })
    for (const ev of ['scroll', 'input', 'change', 'focusin', 'focusout']) addEventListener(ev, bump, true)
    addEventListener('resize', bump)
  }
  const IGNORA = 'script, style, noscript, template, [data-p8-ignore]'
  if (a.fase === 'sucio') {
    if (!a.force && st.n === st.sent && a.key === st.key) return false
    st.sent = st.n
    st.key = a.key
    return true
  }
  if (a.fase === 'textos') {
    const out = new Set()
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) {
      const t = w.currentNode
      if (t.nodeValue.trim() && !t.parentElement?.closest(IGNORA)) out.add(t.nodeValue)
    }
    for (const el of document.querySelectorAll('input, textarea')) {
      if (el.closest('[data-p8-ignore]')) continue
      if (el.getAttribute('value')) out.add(el.getAttribute('value'))
      if (el.value) out.add(el.value)
      if (el.getAttribute('placeholder')) out.add(el.getAttribute('placeholder'))
    }
    if (document.title) out.add(document.title)
    return { textos: [...out].slice(0, 4000) }
  }
  const mascaras = a.mascaras || {}
  const limpio = (s) => Object.prototype.hasOwnProperty.call(mascaras, s) && mascaras[s] === null

  const obs = a.obs || {}
  const over = a.over || {}
  // Atributos con los ids de la observación: data-p8-ref (la del modelo) o data-p8-pv (la vista previa).
  const REF = a.ref || 'data-p8-ref'
  const XA = a.xattr || 'data-p8-x'
  const TOK = /‹[^›]{1,80}›/g
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
  const tieneToken = (s) => /‹[^›]{1,80}›/.test(s || '')

  // Cadenas que el modelo recibió en claro: etiquetas y textos verdes (sin tokens).
  const conocidas = new Set()
  for (const o of Object.values(obs)) {
    if (o.label && !tieneToken(o.label)) conocidas.add(norm(o.label))
    if (o.cls === 'verde' && o.text && !tieneToken(o.text)) conocidas.add(norm(o.text))
  }

  // ---- copia, con lo que solo sabe la página viva: desplazamientos, foco y tamaños
  const live = document.documentElement
  const root = live.cloneNode(true)
  const activo = document.activeElement
  const MEDIA = new Set(['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED', 'svg:image'])
  const pair = (l, c) => {
    if (l !== live && l !== document.body && (l.scrollTop || l.scrollLeft)) c.setAttribute('data-p8-scroll', `${l.scrollTop},${l.scrollLeft}`)
    if (l === activo && l !== document.body) c.setAttribute('data-p8-focus', '')
    if (MEDIA.has(l.tagName)) {
      const r = l.getBoundingClientRect()
      c.setAttribute('data-p8-wh', `${Math.round(r.width)},${Math.round(r.height)}`)
    }
    const lc = l.children
    const cc = c.children
    for (let i = 0; i < lc.length && i < cc.length; i++) pair(lc[i], cc[i])
  }
  pair(live, root)

  // ---- fuera lo que no es pantalla, la capa del cursor de 8 y lo que podría ejecutar algo
  root.querySelectorAll('script, noscript, template, base, meta, frame, frameset, applet, [data-p8-ignore]').forEach((n) => n.remove())
  root.querySelectorAll('link').forEach((n) => { if (!/(^|\s)stylesheet(\s|$)/i.test(n.getAttribute('rel') || '')) n.remove() })
  {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
    const out = []
    while (w.nextNode()) out.push(w.currentNode)
    out.forEach((n) => n.remove())
  }
  // Imágenes, lienzos, vídeos y marcos: una caja vacía del mismo tamaño.
  root.querySelectorAll('img, picture, video, canvas, iframe, object, embed').forEach((n) => {
    const [w, h] = (n.getAttribute('data-p8-wh') || '0,0').split(',')
    const caja = document.createElement('span')
    caja.className = 'p8-media'
    caja.setAttribute('style', `display:inline-block;width:${w}px;height:${h}px`)
    n.replaceWith(caja)
  })

  const head = root.querySelector('head') || document.createElement('head')
  const body = root.querySelector('body') || document.createElement('body')
  const titulo = head.querySelector('title')
  if (titulo) titulo.textContent = 'Lo que ve 8'

  // ---- texto con tokens, como nodos: los tokens van en su chip
  const pintar = (texto) => {
    const frag = document.createDocumentFragment()
    const s = String(texto ?? '')
    let pos = 0
    for (const m of s.matchAll(TOK)) {
      if (m.index > pos) frag.append(document.createTextNode(s.slice(pos, m.index)))
      const t = document.createElement('span')
      t.className = 'p8-tok'
      t.textContent = m[0]
      frag.append(t)
      pos = m.index + m[0].length
    }
    if (pos < s.length) frag.append(document.createTextNode(s.slice(pos)))
    return frag
  }
  const marcador = (largo) => {
    const x = document.createElement('span')
    x.className = 'p8-x'
    x.textContent = 'x'.repeat(Math.max(2, Math.min(18, largo || 6)))
    return x
  }
  // Un texto con sus datos tapados por el núcleo: tokens en su chip, lo demás marcador.
  const conMascara = (partes) => {
    const frag = document.createDocumentFragment()
    for (const [k, v] of partes) {
      if (k === 't') frag.append(document.createTextNode(v))
      else if (k === 'tok') frag.append(pintar(v))
      else frag.append(marcador(v))
    }
    return frag
  }
  const nunca = () => {
    const x = document.createElement('span')
    x.className = 'p8-nunca'
    x.textContent = 'nunca sale'
    return x
  }
  const enSvg = (n) => !!(n.parentElement && n.parentElement.closest('svg'))
  const textosDe = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const out = []
    while (w.nextNode()) if (w.currentNode.nodeValue.trim() && !enSvg(w.currentNode)) out.push(w.currentNode)
    return out
  }
  const seguros = new WeakSet() // nodos de texto que ya llevan lo que vio el modelo

  // ---- los elementos marcados (data-p8 y los del PDF, por selector), del más hondo al más alto
  for (const [ref, sel] of Object.entries(a.sel || {})) {
    try {
      const el = body.querySelector(sel)
      if (el && !el.hasAttribute(REF)) { el.setAttribute(REF, ref); el.setAttribute('data-p8', 'text') }
    } catch { /* selector raro: el elemento queda sin marcar */ }
  }
  const MARCA = `[data-p8], [${REF}]`
  const marcados = [...body.querySelectorAll(MARCA)]
  const hondo = (el) => { let d = 0; for (let p = el; p; p = p.parentElement) d++; return d }
  marcados.sort((x, y) => hondo(y) - hondo(x))
  const observado = new Map() // elemento de la copia -> texto observado (para el texto sin marcar de dentro)

  for (const el of marcados) {
    const ref = el.getAttribute(REF)
    const o = ref ? obs[ref] : null
    const cls = o ? o.cls : 'pendiente'
    el.setAttribute('data-p8-c', cls)
    let texto = null
    const del8 = el.getAttribute('data-p8-ref') // lo que escribe 8 va por los ids del agente
    if (del8 && Object.prototype.hasOwnProperty.call(over, del8)) texto = over[del8]
    else if (o && o.cls !== 'rojo') texto = o.text ?? null
    const tag = el.tagName
    // Aún sin leer: como el texto sin marcar (tal cual salvo lo sensible), no un marcador entero.
    if (cls === 'pendiente' && texto == null && !a.estricto) continue
    if (tag === 'INPUT' && !/^(checkbox|radio|range|color|file|image|hidden)$/i.test(el.type)) {
      if ((el.getAttribute('type') || '').toLowerCase() === 'password') el.setAttribute('type', 'text')
      el.setAttribute('value', cls === 'rojo' ? 'nunca sale' : cls === 'pendiente' && texto == null ? '' : (texto ?? ''))
      el.setAttribute('data-p8-set', '')
      continue
    }
    if (tag === 'TEXTAREA') {
      el.textContent = cls === 'rojo' ? 'nunca sale' : (texto ?? '')
      if (el.firstChild) seguros.add(el.firstChild)
      el.setAttribute('data-p8-set', '')
      continue
    }
    if (tag === 'SELECT') {
      const op = document.createElement('option')
      op.textContent = cls === 'rojo' ? 'nunca sale' : (texto ?? '')
      op.setAttribute('selected', '')
      el.replaceChildren(op)
      if (op.firstChild) seguros.add(op.firstChild)
      continue
    }
    if (texto != null) observado.set(el, norm(texto))
    const dentro = el.querySelector(MARCA)
    if (dentro) continue // contenedor: lo suyo lo resuelve el texto sin marcar, contra su texto observado
    const textos = textosDe(el)
    if (!textos.length) continue // solo iconos: no se añade texto que no había
    let nuevo
    if (cls === 'rojo') nuevo = nunca()
    else if (texto == null) nuevo = marcador(norm(textos.map((t) => t.nodeValue).join(' ')).length)
    else nuevo = pintar(texto)
    const hijos = nuevo.nodeType === 11 ? [...nuevo.childNodes] : [nuevo]
    textos[0].replaceWith(nuevo)
    textos.slice(1).forEach((t) => t.remove())
    for (const h of hijos) {
      if (h.nodeType === 3) seguros.add(h)
      else textosDe(h).forEach((t) => seguros.add(t))
      if (h.nodeType === 1 && h.firstChild) seguros.add(h.firstChild)
    }
  }

  // ---- los textos sueltos (#154): cada uno exactamente como lo recibió el modelo, en su sitio
  if (a.sueltos ?? !a.estricto) {
    for (const el of body.querySelectorAll(`[${XA}]`)) {
      const ids = (el.getAttribute(XA) || '').split(',')
      el.removeAttribute(XA)
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const o = obs[ids[0]]
        if (!o) continue
        const v = o.cls === 'rojo' ? 'nunca sale' : (o.text ?? '')
        if (el.tagName === 'TEXTAREA') { el.textContent = v; if (el.firstChild) seguros.add(el.firstChild) } else el.setAttribute('value', v)
        el.setAttribute('data-p8-set', '')
        el.setAttribute('data-p8-c', o.cls)
        if (o.label && o.cls !== 'rojo') el.setAttribute('placeholder', o.label)
        else el.removeAttribute('placeholder')
        el.setAttribute('data-p8-ph', '')
        continue
      }
      const directos = [...el.childNodes].filter((n) => n.nodeType === 3 && n.nodeValue.trim())
      directos.forEach((n, i) => {
        const o = obs[ids[i]]
        if (!o) return
        const antes = n.nodeValue.match(/^\s*/)[0]
        const despues = n.nodeValue.match(/\s*$/)[0]
        const frag = document.createDocumentFragment()
        if (antes) frag.append(antes)
        frag.append(o.cls === 'rojo' ? nunca() : pintar(o.text ?? ''))
        if (despues) frag.append(despues)
        const hijos = [...frag.childNodes]
        n.replaceWith(frag)
        for (const h of hijos) {
          if (h.nodeType === 3) seguros.add(h)
          else textosDe(h).forEach((t) => seguros.add(t))
        }
      })
    }
  }

  // ---- el texto que no ha llegado al modelo (fuera de pantalla, tope): solo se tapa lo sensible
  {
    const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    const todos = []
    while (w.nextNode()) todos.push(w.currentNode)
    for (const t of todos) {
      if (seguros.has(t)) continue
      const p = t.parentElement
      if (!p) { t.remove(); continue }
      if (p.closest('style')) continue // CSS de la app
      const s = norm(t.nodeValue)
      if (!s) continue
      if (p.closest('textarea')) { if (!limpio(t.nodeValue)) t.remove(); continue }
      if (a.estricto) {
        if (conocidas.has(s)) continue
        const dueno = p.closest(MARCA)
        const visto = dueno ? observado.get(dueno) : null
        if (visto && s.length >= 2 && visto.includes(s)) continue
        if (enSvg(t)) { t.nodeValue = ''; continue }
        t.replaceWith(marcador(s.length))
        continue
      }
      if (limpio(t.nodeValue)) continue
      const m = mascaras[t.nodeValue]
      if (enSvg(t)) { t.nodeValue = m ? m.filter(([k]) => k === 't').map(([, v]) => v).join(' ') : ''; continue }
      t.replaceWith(m ? conMascara(m) : marcador(s.length))
    }
    // Campos sin marcar: su valor y su placeholder, si están limpios.
    for (const el of body.querySelectorAll('input:not([data-p8-set]), textarea:not([data-p8-set])')) {
      const v = el.getAttribute('value')
      if ((el.getAttribute('type') || '').toLowerCase() === 'password') { el.removeAttribute('value'); continue } // una clave nunca
      if (v != null) {
        if (!a.estricto && limpio(v)) el.setAttribute('data-p8-set', '')
        else el.removeAttribute('value')
      }
    }
    // Placeholders de cualquier campo, marcado o no: solo si están limpios.
    for (const el of body.querySelectorAll('[placeholder]:not([data-p8-ph])')) {
      const ph = el.getAttribute('placeholder')
      if (a.estricto || !limpio(ph)) el.removeAttribute('placeholder')
    }
  }

  // ---- atributos: solo presentación
  const QUEDAN = new Set(['class', 'id', 'style', 'role', 'disabled', 'checked', 'selected', 'readonly', 'colspan', 'rowspan',
    'width', 'height', 'dir', 'lang', 'type', 'for', 'open', 'hidden', 'span', 'start', 'reversed', 'cols', 'rows', 'size',
    'placeholder',
    'data-p8', 'data-p8-ref', 'data-p8-pv', 'data-p8-c', 'data-p8-scroll', 'data-p8-focus', 'data-p8-set', 'data-theme',
    // svg
    'viewbox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-miterlimit', 'stroke-opacity', 'fill-rule', 'clip-rule', 'fill-opacity', 'opacity', 'transform', 'cx', 'cy', 'r', 'rx',
    'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'points', 'xmlns', 'preserveaspectratio', 'clip-path', 'mask', 'offset', 'stop-color',
    'stop-opacity', 'gradientunits', 'gradienttransform', 'patternunits', 'text-anchor', 'dominant-baseline', 'font-size',
    'font-weight', 'font-family', 'vector-effect', 'pathlength', 'marker-end', 'marker-start', 'filter', 'rel'])
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const at of [...el.attributes]) {
      const n = at.name.toLowerCase()
      if (n === 'value' && el.hasAttribute('data-p8-set')) continue
      if (n === 'href' && el.tagName === 'LINK') continue
      if (n === 'href' || n === 'xlink:href') {
        // dentro de un svg, solo referencias internas (#id)
        if (/^#[\w-]+$/.test(at.value) && el.closest('svg')) continue
        if (el.tagName === 'A') el.setAttribute('href', '#')
        else el.removeAttribute(at.name)
        continue
      }
      if (!QUEDAN.has(n)) el.removeAttribute(at.name)
    }
  }

  // ---- todo el texto que queda, para el bloqueo final del adaptador
  const restos = []
  {
    const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    while (w.nextNode()) { if (!w.currentNode.parentElement?.closest('style')) restos.push(w.currentNode.nodeValue) }
    for (const el of body.querySelectorAll('[value]')) restos.push(el.getAttribute('value'))
    for (const el of body.querySelectorAll('[placeholder]')) restos.push(el.getAttribute('placeholder'))
    if (titulo) restos.push(titulo.textContent)
  }
  const attrs = (el) => Object.fromEntries([...el.attributes].map((x) => [x.name, x.value]))
  return {
    head: head.innerHTML, body: body.innerHTML, htmlAttrs: attrs(root), bodyAttrs: attrs(body),
    sx: Math.round(scrollX), sy: Math.round(scrollY), w: innerWidth, h: innerHeight, url: location.href,
    text: restos.join('\n'),
  }
}
