/* Fondo de datos de toda la página: un solo dibujo grande, pegado a la página y no a cada sección.
   Las zonas cobalto son transparentes y lo dejan ver, así el texto sigue continuo de una sección a otra
   (y por debajo de las transiciones), y cada zona enseña filas distintas. */
const DATA = [
  'ES43 9100 0001 5740 1234 5678', 'Lucía Ferrer', '3.412,58 €', '‹IBAN_1›', '12345678Z', 'Suministros Lumen', '1.180,00 €',
  '‹IMPORTE_2›', 'lucia.ferrer@correo.es', 'B12345674', '‹NOMBRE_1›', '+34 600 000 000', 'ES71 9400 0007 0206 0223 3441',
  '200,00 €', 'X1234567L', 'Talleres Norte', '12.050,00 €', '4111 1111 1111 1111', '‹DNI_1›', '‹EMAIL_1›', 'F-2611',
  'Nimbo Bróker', '‹IMPORTE_1›', 'Brezo Banco', '‹CIF_1›', '980,40 €', 'ES08 9300 0001 0522 0033 4455',
];
const W = 2200, ROW = 31, ROWS = 96, H = ROW * ROWS;

export function textureUrl() {
  let s = 20261112;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let out = '';
  for (let r = 0; r < ROWS; r++) {
    let x = -rnd() * 300;
    const y = r * ROW + 20;
    while (x < W) {
      const t = DATA[Math.floor(rnd() * DATA.length)];
      /* misma opacidad que las letras de la portada (rgba(215,223,255,.32) a los lados); el centro lo limpia cada sección */
      const a = (0.28 + rnd() * 0.06).toFixed(3);
      out += `<text x="${x.toFixed(0)}" y="${y}" fill-opacity="${a}">${esc(t)}</text>`;
      x += t.length * 8.7 + 28 + rnd() * 90;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g font-family="IBM Plex Mono, Menlo, Consolas, monospace" font-size="13" font-weight="500" fill="#d7dfff">${out}</g></svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
