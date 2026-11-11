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
    /* bienvenida: 8 mira a un lado y solo lo que mira se censura, como una mirada que pasa por encima de los datos.
       Cuando deja de mirar, esos datos vuelven a verse. */
    const root = document.documentElement;
    let gaze = 0, gx = null, gy = null;
    const onLook = (e) => { const d = e.detail; gaze = d === -1 || d === 1 ? d : 0; gx = null; };
    window.addEventListener('p8look', onLook);
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
      const intro = root.classList.contains('intro');
      /* la mirada de 8 en la bienvenida: un óvalo junto a 8, hacia donde mira, que sale de sus ojos y se mueve un poco */
      let look = null;
      if (intro && gaze) {
        const e8 = document.querySelector('.companion');
        const r8 = e8 ? e8.getBoundingClientRect() : null;
        const D = r8 ? r8.width * 46 / 64 : W * 0.3, c8x = r8 ? r8.left - cr.left + r8.width / 2 : W / 2, c8y = r8 ? r8.top - cr.top + r8.height / 2 : H / 2;
        const GR = W < 700 ? 100 : Math.min(240, Math.max(150, W * 0.13));
        const tx = c8x + gaze * (D * 0.5 + GR * (W < 700 ? 0.7 : 1.15)), ty = c8y - D * 0.06 + Math.sin(now / 520) * GR * 0.28;
        if (gx === null) { gx = c8x + gaze * D * 0.3; gy = c8y; }
        gx += (tx - gx) * 0.1; gy += (ty - gy) * 0.1;
        look = { x: gx, y: gy, rx: GR * 1.25, ry: GR * (W < 700 ? 1.15 : 0.8) };
      }
      ctx.font = '500 13px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (const it of items) {
        let y = it.y - (drift % (ROW * 2));
        if (y < -ROW) y += Math.ceil((H + ROW * 2) / ROW) * ROW;
        const cx = it.x + it.w / 2, dx = cx - lx, dy = y - ly;
        const off = Math.abs(cx - W / 2) / (W / 2);
        let want;
        if (intro) {
          want = look && ((cx - look.x) / look.rx) ** 2 + ((y - look.y) / look.ry) ** 2 < 1 ? 1 : 0;
        } else want = Math.sqrt(dx * dx + dy * dy) < R ? 1 : 0;
        it.t += (want - it.t) * (intro ? 0.2 : 0.12);
        /* en pantallas estrechas el texto ocupa casi todo el ancho: el campo se queda muy tenue para no taparlo
           (en la bienvenida no hay texto: se ve entero) */
        const narrow = W < 700 && !intro ? 0.35 : 1;
        /* en la bienvenida no hay texto que proteger: el campo se ve parejo, también junto a 8 */
        const fade = (intro ? 0.9 : Math.min(1, Math.max(0.1, (off - 0.22) * 2.4))) * Math.min(1, y / 90) * narrow;
        if (it.t > 0.5) {
          ctx.fillStyle = `rgba(255,255,255,${0.95 * fade})`;
          /* el token se escribe centrado donde estaba el dato: se tokeniza en su sitio, sin moverse */
          ctx.textAlign = 'center';
          ctx.fillText(it.tok, it.x + it.w / 2, y);
          ctx.textAlign = 'left';
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
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', build); window.removeEventListener('pointermove', onMove); window.removeEventListener('p8look', onLook); };
  }, []);
  return <canvas ref={ref} className="field" aria-hidden="true" />;
}

/* Transiciones entre secciones. Cuatro variantes para elegir (ver #transiciones):
   fade    degradado con curva suave, sin nada más
   curve   la sección siguiente entra con una curva amplia, con una capa intermedia
   pills   cápsulas con el radio del notch que se van juntando hasta cubrir el color siguiente
   sheet   la sección siguiente entra como una hoja con esquinas grandes y sombra
   squares cuadrados con esquinas redondeadas que se van llenando fila a fila (la elegida) */
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
export function Blend({ from, to, variant = 'pixels', seed = 1, overlay = false }) {
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
  if (variant === 'pixels') {
    /* La rejilla de 72 x 6 de siempre. Las formas que salen al juntarse los cuadrados llevan las esquinas como la barra:
       las de fuera redondeadas y los rincones de dentro con una curva hacia fuera (como sus orejas).
       Se calcula por celda mirando a sus vecinas, así los cuadrados no se deforman. */
    const cols = 72, rows = 6, H = Math.round(Math.max(30, Math.min(56, w * 0.04))) || 52, paths = [];
    if (w > 0) {
      const cw = w / cols, ch = H / rows, r = Math.min(cw, ch) * 0.5;
      let sd = seed * 9301 + 49297;
      const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
      const g = [];
      for (let y = 0; y < rows; y++) { g.push([]); for (let x = 0; x < cols; x++) g[y].push(rnd() < (y + 0.5) / rows); }
      const on = (x, y) => (y >= rows ? true : y < 0 ? false : g[y][Math.max(0, Math.min(cols - 1, x))]);
      const f = (n) => n.toFixed(2);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const X = x * cw, Y = y * ch, X2 = X + cw, Y2 = Y + ch;
          if (on(x, y)) {
            /* una esquina solo se redondea si no hay otra forma tocándola en diagonal; si la hay, las dos se unen
               con las curvas de los rincones y queda un cuello suave en vez de una estrella */
            const tl = !on(x, y - 1) && !on(x - 1, y) && !on(x - 1, y - 1) ? r : 0, tr = !on(x, y - 1) && !on(x + 1, y) && !on(x + 1, y - 1) ? r : 0;
            const br = !on(x, y + 1) && !on(x + 1, y) && !on(x + 1, y + 1) ? r : 0, bl = !on(x, y + 1) && !on(x - 1, y) && !on(x - 1, y + 1) ? r : 0;
            paths.push(`M${f(X + tl)} ${f(Y)} L${f(X2 - tr)} ${f(Y)} ${tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(X2)} ${f(Y + tr)}` : ''} L${f(X2)} ${f(Y2 - br)} ${br ? `A${f(br)} ${f(br)} 0 0 1 ${f(X2 - br)} ${f(Y2)}` : ''} L${f(X + bl)} ${f(Y2)} ${bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(X)} ${f(Y2 - bl)}` : ''} L${f(X)} ${f(Y + tl)} ${tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(X + tl)} ${f(Y)}` : ''} Z`);
          } else {
            /* rincones: celda vacía con dos vecinas llenas que forman esquina */
            if (on(x, y - 1) && on(x - 1, y)) paths.push(`M${f(X)} ${f(Y)} L${f(X + r)} ${f(Y)} A${f(r)} ${f(r)} 0 0 0 ${f(X)} ${f(Y + r)} Z`);
            if (on(x, y - 1) && on(x + 1, y)) paths.push(`M${f(X2)} ${f(Y)} L${f(X2)} ${f(Y + r)} A${f(r)} ${f(r)} 0 0 0 ${f(X2 - r)} ${f(Y)} Z`);
            if (on(x, y + 1) && on(x + 1, y)) paths.push(`M${f(X2)} ${f(Y2)} L${f(X2 - r)} ${f(Y2)} A${f(r)} ${f(r)} 0 0 0 ${f(X2)} ${f(Y2 - r)} Z`);
            if (on(x, y + 1) && on(x - 1, y)) paths.push(`M${f(X)} ${f(Y2)} L${f(X)} ${f(Y2 - r)} A${f(r)} ${f(r)} 0 0 0 ${f(X + r)} ${f(Y2)} Z`);
          }
        }
      }
    }
    return (
      /* el cobalto nunca se pinta aquí: se deja transparente para que se vea el fondo de datos de la página, continuo.
         Hacia cobalto se dibuja el blanco con los píxeles como huecos. */
      <div ref={ref} className="blend blend-pixels" aria-hidden="true" style={overlay ? { background: 'transparent', height: H, marginTop: -H, zIndex: 2 } : { background: from === '--band' || to === '--band' ? 'transparent' : `var(${from})`, height: H }}>
        {w > 0 && (to === '--band' && !overlay ? (
          /* el blanco con los píxeles recortados por una máscara: los píxeles se dibujan con un poco de trazo,
             así se solapan entre ellos y con el borde de abajo y no queda ni una junta ni una línea fina */
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} style={{ display: 'block' }}>
            <defs>
              <mask id={`bm${seed}`} maskUnits="userSpaceOnUse" x="0" y="-2" width={w} height={H + 4}>
                <rect x="0" y="-2" width={w} height={H + 4} fill="#fff" />
                <path d={paths.join(' ')} fill="#000" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
                <rect x="0" y={H - 0.5} width={w} height="3" fill="#000" />
              </mask>
            </defs>
            <rect x="0" y="0" width={w} height={H} style={{ fill: `var(${from})` }} mask={`url(#bm${seed})`} />
          </svg>
        ) : (
          <svg width={w} height={H + 1} viewBox={`0 0 ${w} ${H + 1}`} style={{ fill: `var(${to})` }}>
            <path d={paths.join(' ')} stroke={`var(${to})`} strokeWidth="0.6" strokeLinejoin="round" />
            <rect x="0" y={H} width={w} height="1.5" />
          </svg>
        ))}
      </div>
    );
  }
  if (variant === 'squares') {
    /* los cuadrados de antes (cada fila más llena que la anterior, como una pantalla que se tokeniza), con las esquinas redondeadas */
    const rows = 6, cell = Math.max(22, Math.min(36, w / 44)), H = rows * cell, cells = [];
    if (w > 0) {
      let s = 11; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      const cols = Math.ceil(w / cell), gap = Math.max(2, cell * 0.1), rx = cell * 0.3;
      for (let r = 0; r < rows; r++) {
        const p = r === rows - 1 ? 1 : Math.pow((r + 0.6) / rows, 0.85);
        for (let c = 0; c < cols; c++) {
          if (rnd() < p) cells.push(<rect key={r * cols + c} x={c * cell + gap / 2} y={r * cell + gap / 2} width={cell - gap} height={cell - gap} rx={rx} />);
        }
      }
    }
    return (
      <div ref={ref} className="blend" aria-hidden="true" style={{ background: `var(${from})`, height: H || 150 }}>
        {w > 0 && <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} style={{ fill: `var(${to})` }}>{cells}</svg>}
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
  const variants = [['pixels', 'P · Cuadrados originales'], ['squares', 'E · Cuadrados redondeados'], ['fade', 'A · Fundido suave'], ['curve', 'B · Curva'], ['pills', 'C · Cápsulas con el radio del notch'], ['sheet', 'D · Hoja con esquinas grandes']];
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
