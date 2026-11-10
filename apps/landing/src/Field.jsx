import { useEffect, useRef, useState } from 'react';

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
      /* sin cursor, la lente da vueltas alrededor de 8, como si mirase a su alrededor */
      const an = document.getElementById('hero-anchor'); const ar = an ? an.getBoundingClientRect() : null; const cr = cv.getBoundingClientRect();
      const ax = ar ? ar.left - cr.left + ar.width / 2 : W / 2, ay = ar ? ar.top - cr.top + ar.height / 2 : H * 0.3;
      const lx = auto ? ax + Math.cos(now / 2600) * Math.min(W * 0.36, 520) : ptr.x;
      const ly = auto ? ay + Math.sin(now / 2600) * Math.min(H * 0.22, 180) : ptr.y;
      const R = Math.min(220, Math.max(140, W * 0.13));
      ctx.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (const it of items) {
        let y = it.y - (drift % (ROW * 2));
        if (y < -ROW) y += Math.ceil((H + ROW * 2) / ROW) * ROW;
        const cx = it.x + it.w / 2, dx = cx - lx, dy = y - ly, near = Math.sqrt(dx * dx + dy * dy) < R;
        it.t += ((near ? 1 : 0) - it.t) * 0.12;
        const off = Math.abs(cx - W / 2) / (W / 2);
        const fade = Math.min(1, Math.max(0.1, (off - 0.22) * 2.4)) * Math.min(1, y / 90);
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

/* Transición entre bandas hecha de notches: pestañas con el radio del notch que cuelgan de la banda de arriba,
   con alturas distintas, y algunas pastillas sueltas debajo, como una pantalla que se va tokenizando.
   Se dibuja en píxeles reales para que los radios no se deformen con el ancho. */
export function Notches({ from, to, seed = 1, height = 96 }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tabs = [], pills = [];
  if (w > 0) {
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const cols = Math.max(8, Math.round(w / 64)), cw = w / cols, gap = Math.min(10, cw * 0.16);
    const H = height, e = 9;
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw + gap / 2, x1 = (c + 1) * cw - gap / 2, tw = x1 - x0;
      const wave = 0.5 + 0.32 * Math.sin((c / cols) * Math.PI * 3 + seed * 1.7);
      const k = Math.min(1, Math.max(0.12, wave + (rnd() - 0.5) * 0.42));
      const h = Math.max(e + 10, H * 0.62 * k);
      const r = Math.min(tw / 2, 18, h - e);
      tabs.push(<path key={'t' + c} style={{ '--d': (c % 12) * 40 + 'ms' }} d={`M${x0 - e},0 A${e},${e} 0 0 1 ${x0},${e} L${x0},${h - r} A${r},${r} 0 0 0 ${x0 + r},${h} L${x1 - r},${h} A${r},${r} 0 0 0 ${x1},${h - r} L${x1},${e} A${e},${e} 0 0 1 ${x1 + e},0 Z`} />);
      if (k < 0.75 && rnd() < 0.7) {
        const ph = 12 + rnd() * 14, py = h + 10 + rnd() * (H - h - ph - 6);
        const pw = tw * (0.35 + rnd() * 0.5), px = x0 + (tw - pw) / 2;
        if (py + ph < H) pills.push(<rect key={'p' + c} style={{ '--d': (c % 12) * 40 + 120 + 'ms' }} x={px} y={py} width={pw} height={ph} rx={Math.min(ph / 2, 10)} />);
      }
    }
  }
  return (
    <div ref={ref} className="notches" aria-hidden="true" style={{ background: `var(${to})`, height }}>
      {w > 0 && <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ fill: `var(${from})` }}>{tabs}{pills}</svg>}
    </div>
  );
}
