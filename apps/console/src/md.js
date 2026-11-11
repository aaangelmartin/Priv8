// El markdown que escribe el modelo (**negrita**, listas 1. y -), en bloques para pintar.
//
// bloques('**Plan:** reviso\n1. Abro\n2. Escribo') →
//   [{tipo: 'p', partes: [{b: true, t: 'Plan:'}, {b: false, t: ' reviso'}]},
//    {tipo: 'ol', items: [[{b: false, t: 'Abro'}], [{b: false, t: 'Escribo'}]]}]
// Los tokens ‹…› se dejan tal cual: quien pinta los pone en su chip.

const LISTA_NUM = /^\s*\d{1,2}[.)]\s+(.*)$/
const LISTA = /^\s*[-*•]\s+(.*)$/

// «**a** b» → partes con negrita; fuera los `código`, los #títulos y los guiones bajos dobles.
export function partes(linea) {
  const s = String(linea ?? '').replace(/`+/g, '').replace(/^\s*#{1,6}\s+/, '').replace(/__/g, '')
  const out = []
  const re = /\*\*([^*]+?)\*\*/g
  let pos = 0
  for (const m of s.matchAll(re)) {
    if (m.index > pos) out.push({ b: false, t: s.slice(pos, m.index) })
    out.push({ b: true, t: m[1] })
    pos = m.index + m[0].length
  }
  if (pos < s.length) out.push({ b: false, t: s.slice(pos) })
  // Asteriscos sueltos que no cierran: fuera.
  return out.map((p) => ({ ...p, t: p.t.replace(/\*\*/g, '') })).filter((p) => p.t)
}

export function bloques(texto) {
  // Una lista escrita en una sola línea («… así: 1. Abro 2. Escribo») se parte en líneas.
  const s = String(texto ?? '').replace(/\r/g, '').replace(/([.:;])\s+(?=\d{1,2}[.)]\s+\S)/g, '$1\n')
  const out = []
  for (const linea of s.split('\n')) {
    if (!linea.trim()) continue
    const num = LISTA_NUM.exec(linea)
    const vin = num ? null : LISTA.exec(linea)
    const tipo = num ? 'ol' : vin ? 'ul' : 'p'
    const contenido = partes(num ? num[1] : vin ? vin[1] : linea.trim())
    if (!contenido.length) continue
    const ultimo = out[out.length - 1]
    if (tipo === 'p') {
      if (ultimo?.tipo === 'p' && !ultimo.cerrado) ultimo.partes.push({ b: false, t: ' ' }, ...contenido)
      else out.push({ tipo: 'p', partes: contenido })
    } else if (ultimo?.tipo === tipo) {
      ultimo.items.push(contenido)
    } else {
      out.push({ tipo, items: [contenido] })
    }
  }
  return out
}

// Texto plano, sin marcas (para una línea corta o un bocadillo).
export function plano(texto) {
  return bloques(texto).map((b) => (b.tipo === 'p' ? b.partes : b.items.flat()).map((p) => p.t).join('')).join(' ')
}
