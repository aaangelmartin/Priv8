import { useEffect, useRef } from 'react';

/* Campo de datos de la portada. Filas de datos inventados (IBAN, importes, nombres, DNI…) suben despacio.
   Donde pasa el cursor, o la lente que se mueve sola, cada dato se convierte en su token: lo que ve la IA.
   Los datos no tapan el texto: a la izquierda se apagan. */
const DATA = [
  ['ES43 9100 0001 5740 1234 5678', '‹IBAN_1›'], ['3.412,58 €', '‹IMPORTE_1›'], ['Lucía Ferrer', '‹NOMBRE_1›'],
  ['12345678Z', '‹DNI_1›'], ['1.180,00 €', '‹IMPORTE_2›'], ['B12345674', '‹CIF_1›'], ['Suministros Lumen', '‹NOMBRE_2›'],
  ['+34 600 000 000', '‹TELEFONO_1›'], ['ES71 9400 0007 0206 0223 3441', '‹IBAN_2›'], ['200,00 €', '‹IMPORTE_3›'],
  ['lucia.ferrer@correo.es', '‹EMAIL_1›'], ['Talleres Norte', '‹NOMBRE_3›'], ['12.050,00 €', '‹IMPORTE_4›'],
  ['4111 1111 1111 1111', 'nunca sale'], ['X1234567L', '‹NIE_1›'], ['ES08 9300 0001 0522 0033 4455', '‹IBAN_3›'],
];

export default function Field() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    let still = false;
    try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sin preferencia */ }
    let W = 0, H = 0, dpr = 1, items = [], raf = 0, ptr = null, lastPtr = -1e9, visible = true;
    const ROW = 34;
    const build = () => {
      const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
      items = []; let k = 0;
      for (let y = 0; y < H + ROW * 2; y += ROW) {
        let x = -((y / ROW) * 53) % 180;
        while (x < W) {
          const d = DATA[k++ % DATA.length];
          const w = ctx.measureText(d[0]).width;
          items.push({ x, y, w, real: d[0], tok: d[1], t: 0 });
          x += w + 36;
        }
      }
    };
    const onMove = (e) => { const r = cv.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top }; lastPtr = performance.now(); };
    const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; });
    io.observe(cv);
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      ctx.clearRect(0, 0, W, H);
      const drift = still ? 0 : (now / 1000) * 9;
      const auto = now - lastPtr > 2500;
      const lx = auto ? W * (0.62 + 0.26 * Math.sin(now / 3100)) : ptr.x;
      const ly = auto ? H * (0.5 + 0.32 * Math.sin(now / 2300 + 1)) : ptr.y;
      const R = Math.min(220, Math.max(140, W * 0.13));
      ctx.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (const it of items) {
        let y = it.y - (drift % (ROW * 2));
        if (y < -ROW) y += Math.ceil((H + ROW * 2) / ROW) * ROW;
        const cx = it.x + it.w / 2, dx = cx - lx, dy = y - ly, near = Math.sqrt(dx * dx + dy * dy) < R;
        it.t += ((near ? 1 : 0) - it.t) * 0.12;
        const fade = Math.min(1, Math.max(0.08, (it.x / W - 0.18) * 2.2)) * Math.min(1, y / 90);
        if (it.t > 0.5) {
          const red = it.tok === 'nunca sale';
          ctx.fillStyle = red ? `rgba(255,150,140,${0.95 * fade})` : `rgba(255,255,255,${0.95 * fade})`;
          ctx.fillText(it.tok, it.x, y);
        } else {
          ctx.fillStyle = `rgba(215,223,255,${0.32 * fade})`;
          ctx.fillText(it.real, it.x, y);
        }
      }
    };
    build();
    window.addEventListener('resize', build);
    window.addEventListener('pointermove', onMove, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', build); window.removeEventListener('pointermove', onMove); };
  }, []);
  return <canvas ref={ref} className="field" aria-hidden="true" />;
}

/* Transición entre bandas: una rejilla de bloques que pasa de un color al otro, como una pantalla que se tokeniza. */
export function Dither({ from, to, rows = 4, seed = 1 }) {
  /* Semitono: puntos redondos que crecen fila a fila hasta cubrir el color siguiente, con una onda suave. */
  const cols = 64, cells = [];
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wave = 0.18 * Math.sin((c / cols) * Math.PI * 4 + seed);
      const p = Math.min(1, Math.max(0, (r + 0.5) / rows + wave + (rnd() - 0.5) * 0.18));
      const rad = p * 0.78;
      if (rad > 0.06) cells.push(<circle key={r * cols + c} cx={c + 0.5} cy={r + 0.5} r={rad.toFixed(3)} />);
    }
  }
  return (
    <div className="dither" aria-hidden="true" style={{ background: `var(${from})` }}>
      <svg viewBox={`0 0 ${cols} ${rows + 1}`} preserveAspectRatio="none" style={{ fill: `var(${to})` }}>
        {cells}
        <rect x="0" y={rows - 0.02} width={cols} height="1.04" />
      </svg>
    </div>
  );
}
