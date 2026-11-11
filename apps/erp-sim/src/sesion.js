// Sesión de Alba Core (#137). Como en el ordenador de una empresa, la sesión puede
// estar ya abierta: con VITE_ALBA_SESION=<usuario> (solo en desarrollo, lo pone
// `make demo-b2b`) el ERP abre con ese usuario sin pasar por la identificación.
// Nadie escribe la clave: es una sesión recordada, no un login del agente.
//
// Si la persona cierra la sesión, queda cerrada (salida: true) hasta que vuelve a
// entrar con su clave. /reset borra todo y vuelve a la sesión de la demo.

// Estado inicial a partir de lo guardado en localStorage y del usuario de la demo.
export function sesionInicial(guardado, demo, usuarios) {
  const s = guardado && typeof guardado === 'object' ? guardado : {}
  if (s.usuario || s.salida || !demo) return s
  if (!usuarios.some((u) => u.usuario === demo)) return s // usuario de la demo desconocido
  return { ...s, usuario: demo }
}

// Cambios al cerrar sesión y al entrar con la clave.
export const cerrarSesion = () => ({ usuario: null, salida: true })
export const entrarComo = (usuario) => ({ usuario, salida: false })

// Adónde va /reset: con la sesión de la demo, a la pantalla de trabajo.
export const trasReset = (demo) => (demo ? '/facturas/alta' : '/login')
