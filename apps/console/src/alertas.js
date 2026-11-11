// Alarmas de posible fraude para la consola (B2B).
//
// Se calculan en local, sin la IA, a partir de lo mismo que ve el modelo: tokens.
// No hace falta ningún valor real, porque el token ya dice de dónde viene el dato:
// ‹IBAN_1-correo› es una cuenta que solo ha aparecido en un correo.
//
//   cuenta       un correo trae una cuenta bancaria que no es la de la ficha
//   instruccion  el correo da órdenes al asistente («sin consultar», «ignora…»)
//   bloqueo      el núcleo impidió escribir un dato en un campo que no lo acepta
//
// Cada alarma tiene una clave estable para no repetirse y para poder marcarla revisada.

const IBAN_CORREO = /‹IBAN_\d+-correo›/g
const ORDEN_A_LA_IA = /(nota para el asistente|asistente:|sin consultar|ignora (las|todas)|no (lo )?consultes|actualice la cuenta|cambie la cuenta)/i
const DESTINO = /^(\w+) de origen (\w+) no entra en ([\w.]+) \(acepta: ([^)]+)\)/

// La frase del texto donde está la orden, para citar solo eso.
function fraseCon(texto, re) {
  const frases = texto.split(/(?<=[.!?])\s+/)
  return frases.find((f) => re.test(f)) || texto
}

export function alertasDePantalla(screen) {
  const obs = screen?.observed
  if (!obs || !Array.isArray(obs.elements)) return []
  const out = []
  for (const el of obs.elements) {
    const texto = el.text || ''
    for (const tok of new Set(texto.match(IBAN_CORREO) || [])) {
      out.push({
        clave: `cuenta:${obs.session}:${tok}`,
        tipo: 'cuenta',
        titulo: 'Posible fraude: un correo pide cambiar la cuenta de pago',
        detalle: `El correo trae la cuenta ${tok}, que no es la de la ficha del proveedor. No la uses sin comprobarlo por un canal que ya tengáis.`,
        evidencia: texto,
        app: obs.app,
        pantalla: obs.screen,
      })
    }
    if (obs.app === 'inbox' && ORDEN_A_LA_IA.test(texto)) {
      out.push({
        clave: `instruccion:${obs.session}:${obs.app}:${el.id}`,
        tipo: 'instruccion',
        titulo: 'El correo da instrucciones al asistente',
        detalle: 'Un texto que intenta mandar a la IA es una señal típica de estafa. 8 no obedece órdenes que llegan en un correo.',
        evidencia: fraseCon(texto, ORDEN_A_LA_IA),
        app: obs.app,
        pantalla: obs.screen,
      })
    }
  }
  return out
}

export function alertaDeBloqueo(event) {
  if (event?.kind !== 'blocked' || event.reason !== 'destino') return null
  const m = DESTINO.exec(event.detail || '')
  const campo = m ? m[3] : 'un campo'
  const origen = m ? m[2] : 'otro origen'
  return {
    clave: `bloqueo:${event.session}:${event.seq}`,
    tipo: 'bloqueo',
    titulo: 'Bloqueado: la IA intentó usar un dato que no debía',
    detalle: `Un ${m ? m[1] : 'dato'} de origen ${origen} no puede ir en ${campo}${m ? ` (solo acepta: ${m[4]})` : ''}. El núcleo lo ha impedido.`,
    evidencia: event.model_saw || '',
    app: event.app,
    pantalla: event.screen,
  }
}

// Lo último que dijo 8 sobre una cuenta del correo, para enseñarlo junto a la alarma.
const MENCIONA_IBAN_CORREO = /‹IBAN_\d+-correo›/

export function comentarioDe8(audit) {
  for (let i = audit.length - 1; i >= 0; i--) {
    const e = audit[i]
    if (e.kind === 'task' && e.model_saw && MENCIONA_IBAN_CORREO.test(e.model_saw)) return e.model_saw
  }
  return null
}
