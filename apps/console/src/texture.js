/* Fondo de datos de las bandas cobalto, el mismo de la web: filas de datos inventados y sus tokens, quietas. */
const DATA = [
  'ES43 9100 0001 5740 1234 5678', 'Ángel Martín', '3.412,58 €', '‹IBAN_1›', '12345678Z', 'Suministros Lumen', '1.180,00 €',
  '‹IMPORTE_2›', 'angel@priv8.es', 'B12345674', '‹NOMBRE_1›', '+34 600 000 000', 'ES71 9400 0007 0206 0223 3441',
  'Álvaro Carpintero', '200,00 €', 'X1234567L', 'Pablo Rojo', '12.050,00 €', '‹DNI_1›', 'Marco Barroso', '‹EMAIL_1›', 'F-2026-0412',
  '48215963M', '‹CIF_1›', '980,40 €', 'ES08 9300 0001 0522 0033 4455',
]
export function textureUrl() {
  const W = 2200, ROW = 31, ROWS = 24
  let s = 20261112
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  let out = ''
  for (let r = 0; r < ROWS; r++) {
    let x = -rnd() * 300
    const y = r * ROW + 20
    while (x < W) {
      const t = DATA[Math.floor(rnd() * DATA.length)]
      out += `<text x="${x.toFixed(0)}" y="${y}" fill-opacity="${(0.24 + rnd() * 0.06).toFixed(3)}">${esc(t)}</text>`
      x += t.length * 8.7 + 28 + rnd() * 90
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ROW * ROWS}" viewBox="0 0 ${W} ${ROW * ROWS}"><g font-family="IBM Plex Mono, Menlo, monospace" font-size="13" font-weight="500" fill="#d7dfff">${out}</g></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}
