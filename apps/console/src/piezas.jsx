// Piezas compartidas de la consola: tokens, valores reales (solo en local) y relojes.
import { useEffect, useRef, useState } from 'react'
import { TOKEN_RE, alinear } from './tokens.js'

// Los textos del núcleo usan «·» como separador; en la consola se ve « | ». Los tokens
// (‹IBAN_1·correo›) no llevan espacios alrededor del punto y no se tocan.
export const limpio = (s) => (typeof s === 'string' ? s.replace(/\s·\s/g, ' | ') : s)

export function Token({ tok, valores }) {
  const real = valores?.[tok]
  return <code className="tok" title={real ? `En local: ${real}` : undefined}>{tok}</code>
}

// Texto con tokens.
//   token: el chip del token (lo que ve la IA)
//   ambos: el valor real delante del token (solo en local)
//   real:  el valor real, con el token al pasar por encima (lo que lees tú)
export function Tokens({ text, valores, mostrar = 'token' }) {
  if (text == null) return <span className="redacted">nunca sale</span>
  if (text === '') return <span className="vacio">vacío</span>
  return text.split(TOKEN_RE).map((part, i) => {
    if (!(i % 2)) return part
    const real = valores?.[part]
    if (mostrar === 'real' && real) return <span key={i} className="local" title={part}>{real}</span>
    if (mostrar === 'ambos' && real) return <Valor key={i} tok={part} valores={valores} />
    return <Token key={i} tok={part} valores={valores} />
  })
}

export function Valor({ tok, valores }) {
  const real = valores?.[tok]
  return (
    <span className="valor">
      {real && <b>{real}</b>}
      <code className="tok">{tok}</code>
    </span>
  )
}

// Sin protocolo: el texto tal cual llega a la IA, con los valores reales marcados en rojo.
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function EnClaro({ text, valores }) {
  if (text == null) return <span className="vacio">sin texto</span>
  if (text === '') return <span className="vacio">vacío</span>
  if (!valores?.length) return text
  const re = new RegExp(`(${valores.map(escapar).join('|')})`)
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="fuga">{p}</mark> : p))
}

export function useAhora(ms = 1000) {
  const [t, setT] = useState(Date.now())
  useEffect(() => { const id = setInterval(() => setT(Date.now()), ms); return () => clearInterval(id) }, [ms])
  return t
}

// Cambios de cara sin prisa: cada estado se queda al menos `ms` antes de pasar al siguiente.
export function useCalma(valor, clave, ms = 900) {
  const [v, setV] = useState(valor)
  const ultimo = useRef(0)
  useEffect(() => {
    const espera = Math.max(0, ultimo.current + ms - Date.now())
    const id = setTimeout(() => { setV(valor); ultimo.current = Date.now() }, espera)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return v
}

export const hora = (d) => (d ? new Date(d).toLocaleTimeString('es-ES', { hour12: false }) : '')

// Lo que ves: el texto real con el trozo tokenizado marcado.
export function Real({ real, observado }) {
  if (real == null) return <span className="vacio">sin texto</span>
  if (real === '') return <span className="vacio">vacío</span>
  const trozos = alinear(real, observado)
  if (!trozos) return real
  return trozos.map((t, i) => (t.token ? <mark key={i} className="dato">{t.texto}</mark> : t.texto))
}
