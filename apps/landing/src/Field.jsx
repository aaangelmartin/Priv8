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

/* Transiciones entre secciones. Cuatro variantes para elegir (ver #transiciones):
   fade    degradado con curva suave, sin nada más
   curve   la sección siguiente entra con una curva amplia, con una capa intermedia
   pills   cápsulas con el radio del notch que se van juntando hasta cubrir el color siguiente
   sheet   la sección siguiente entra como una hoja con esquinas grandes y sombra */
const EASE = [0, 0.03, 0.1, 0.21, 0.35, 0.5, 0.65, 0.79, 0.9, 0.97, 1];
const LIGHT = ['--paper', '--mist'];
function eased(from, to) {
  const via = LIGHT.includes(from) !== LIGHT.includes(to);
  const col = (t) => {
    if (!via) return `color-mix(in oklab, var(${from}), var(${to}) ${Math.round(t * 100)}%)`;
    return t < 0.5 ? `color-mix(in oklab, var(${from}), var(--band) ${Math.round(t * 200)}%)` : `color-mix(in oklab, var(--band), var(${to}) ${Math.round((t - 0.5) * 200)}%)`;
  };
  return `linear-gradient(180deg, ${EASE.map((t, i) => `${col(t)} ${i * 10}%`).join(', ')})`;
}
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setW(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
export function Blend({ from, to, variant = 'fade' }) {
  const [ref, w] = useWidth();
  if (variant === 'curve') {
    const H = 160;
    return (
      <div ref={ref} className="blend blend-curve" aria-hidden="true" style={{ background: `var(${from})`, height: H }}>
        {w > 0 && (
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
            <path d={`M0 ${H * 0.55} C ${w * 0.25} ${H * 0.05}, ${w * 0.55} ${H * 0.95}, ${w} ${H * 0.35} L ${w} ${H} L 0 ${H} Z`} style={{ fill: LIGHT.includes(from) !== LIGHT.includes(to) ? 'var(--band)' : `color-mix(in oklab, var(${from}), var(${to}) 50%)`, opacity: 0.85 }} />
            <path d={`M0 ${H * 0.8} C ${w * 0.3} ${H * 0.35}, ${w * 0.62} ${H * 1.05}, ${w} ${H * 0.6} L ${w} ${H} L 0 ${H} Z`} style={{ fill: `var(${to})` }} />
          </svg>
        )}
      </div>
    );
  }
  if (variant === 'pills') {
    const H = 150, rows = 6, rh = H / rows, cells = [];
    if (w > 0) {
      let s = 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (let r = 0; r < rows; r++) {
        const fill = (r + 1) / rows;
        let x = -rnd() * 60;
        while (x < w) {
          const pw = 40 + rnd() * 120;
          const gap = 6 + (1 - fill) * (30 + rnd() * 120);
          if (rnd() < 0.35 + fill * 0.65) {
            const ph = rh * (0.5 + fill * 0.5);
            cells.push(<rect key={r + '-' + Math.round(x)} x={x} y={r * rh + (rh - ph) / 2} width={pw} height={ph} rx={Math.min(ph / 2, 14)} />);
          }
          x += pw + gap;
        }
      }
    }
    return (
      <div ref={ref} className="blend" aria-hidden="true" style={{ background: `var(${from})`, height: H + 16 }}>
        {w > 0 && <svg width={w} height={H + 16} viewBox={`0 0 ${w} ${H + 16}`} style={{ fill: `var(${to})` }}>{cells}<rect x="0" y={H} width={w} height="17" /></svg>}
      </div>
    );
  }
  if (variant === 'sheet') {
    return (
      <div ref={ref} className="blend blend-sheet" aria-hidden="true" style={{ background: `var(${from})` }}>
        <div style={{ background: `var(${to})` }} />
      </div>
    );
  }
  return <div ref={ref} className="blend blend-fade" aria-hidden="true" style={{ background: eased(from, to) }} />;
}

/* Página de prueba de transiciones: http://localhost:5180/#transiciones */
export function TransitionsLab() {
  const pairs = [['--band', '--night', 'Cobalto a noche'], ['--paper', '--night', 'Blanco a noche']];
  const variants = [['fade', 'A · Fundido suave'], ['curve', 'B · Curva'], ['pills', 'C · Cápsulas con el radio del notch'], ['sheet', 'D · Hoja con esquinas grandes']];
  return (
    <div className="lab">
      <header className="lab-head"><h1>Transiciones entre secciones</h1><p>Cuatro opciones. Dime la letra que te guste, o mezcla.</p></header>
      {variants.map(([v, name]) => (
        <section key={v} className="lab-item">
          <h2>{name}</h2>
          {pairs.map(([a, b, label]) => (
            <div key={label} className="lab-pair">
              <div className="lab-block" style={{ background: `var(${a})`, color: a === '--paper' ? '#0b1b33' : '#fff' }}>{label}</div>
              <Blend from={a} to={b} variant={v} />
              <div className="lab-block" style={{ background: `var(${b})`, color: '#fff' }} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
