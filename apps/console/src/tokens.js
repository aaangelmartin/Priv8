// Alinear lo que ves con lo que ve la IA.
//
// La observación es el mismo texto con algunos trozos cambiados por tokens:
//   real      «Factura F-2026-0412»
//   observado «Factura ‹FACTURA_1·correo›»
// Con el texto observado se construye un patrón (literales fijos, tokens como hueco)
// y se aplica al real. Así se sabe qué trozo del real es cada token.
//
// Solo se usa en la consola, que ya recibe los valores reales en local.

export const TOKEN_RE = /(‹[^›]*›)/g
const ES_TOKEN = /^‹[^›]*›$/

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Trozos del texto real: [{texto}] o [{texto, token}] donde el real se ha tokenizado.
// Devuelve null si no se pueden alinear.
export function alinear(real, observado) {
  if (real == null || observado == null) return null
  const partes = observado.split(TOKEN_RE)
  if (partes.length === 1) return real === observado ? [{ texto: real }] : null
  const patron = partes.map((p, i) => (i % 2 ? '(.+?)' : escapar(p))).join('')
  const m = new RegExp(`^${patron}$`, 's').exec(real)
  if (!m) return null
  const out = []
  partes.forEach((p, i) => {
    if (i % 2) out.push({ texto: m[(i + 1) / 2], token: p })
    else if (p) out.push({ texto: p })
  })
  return out
}

// Token → valor real, a partir de todos los elementos de una pantalla.
export function valoresDe(raw, observed) {
  const out = {}
  const reales = new Map((raw?.elements ?? []).map((e) => [e.id, e]))
  for (const el of observed?.elements ?? []) {
    const r = reales.get(el.id)
    if (!r) continue
    for (const campo of ['text', 'label']) {
      for (const t of alinear(r[campo], el[campo]) ?? []) {
        if (t.token && !(t.token in out)) out[t.token] = t.texto
      }
    }
  }
  return out
}

export const esToken = (s) => ES_TOKEN.test(s)

// «‹IBAN_1·correo›» → {tipo: 'IBAN', n: '1', origen: 'correo'}
export function partesDeToken(tok) {
  const m = /^‹([A-Z]+)_(\d+)(?:·([^›]+))?›$/.exec(tok)
  return m ? { tipo: m[1], n: m[2], origen: m[3] ?? null } : null
}
