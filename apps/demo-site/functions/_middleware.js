// Cloudflare Pages Functions: middleware delante de todo demo.priv8.es, también de los archivos estáticos
// (https://developers.cloudflare.com/pages/functions/middleware/).
//
// Con la variable DEMO_PASSWORD puesta en el proyecto de Pages, el sitio pide una contraseña compartida con la
// autenticación básica de HTTP: el usuario da igual, solo cuenta la contraseña. Sin la variable, el sitio queda abierto.
// No pide correos ni códigos. Detalles y cómo cambiarla en docs/despliegue-subdominios.md.

const REALM = 'Priv8 demo';
const enc = new TextEncoder();

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

// Compara los resúmenes, que miden siempre lo mismo, para no dar pistas por el tiempo de respuesta.
async function sameSecret(given, expected) {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  if (crypto.subtle.timingSafeEqual) return crypto.subtle.timingSafeEqual(a, b);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function passwordFrom(request) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(h.trim());
  if (!m) return null;
  let decoded;
  try { decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch { return null; }
  const i = decoded.indexOf(':');
  return i < 0 ? null : decoded.slice(i + 1);
}

function denied() {
  return new Response('Esta demo pide la contraseña que te ha dado el equipo de Priv8.\n', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

// _headers no se aplica a lo que devuelve una Function: las cabeceras que importan se ponen aquí también.
function withHeaders(res, url, locked) {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  if (locked) out.headers.set('Cache-Control', 'private, no-store');
  if (url.pathname.startsWith('/apk/') && url.pathname.endsWith('.apk')) {
    out.headers.set('Content-Type', 'application/vnd.android.package-archive');
    out.headers.set('Content-Disposition', 'attachment');
  }
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  const expected = env.DEMO_PASSWORD;
  const url = new URL(request.url);
  if (expected) {
    const given = passwordFrom(request);
    if (given === null || !(await sameSecret(given, expected))) return denied();
  }
  return withHeaders(await context.next(), url, !!expected);
}
