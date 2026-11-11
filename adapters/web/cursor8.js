// Cursor de 8 (#135): la persona que mira la ventana de Chromium ve a 8 moverse, pulsar y escribir.
//
// Se evalúa con page.evaluate(src, args) antes de cada acción del adaptador. Vive en un
// shadow root colgado de <html>, fuera de #root: querySelectorAll('[data-p8]') del snapshot
// no entra en él, y además lleva data-p8-ignore y aria-hidden. Sin eventos de puntero, así
// que no cambia qué recibe el clic ni lo que lee el modelo.
//
// args: {op: 'move' | 'tap' | 'type' | 'done' | 'hide', ref (data-p8-ref) o x e y, verb, from: [x, y] | null}
// verb pone la etiqueta «8 <verb> «<etiqueta del elemento>»»; label la da tal cual.
// Devuelve una promesa que se resuelve al acabar el deslizamiento con la posición [x, y] del
// cursor (true en done y hide, false si no encuentra el destino).
async (a) => {
  const ID = 'p8-cursor-8';
  const COBALTO = '#2D45D6';
  let host = document.getElementById(ID);
  if (!host) {
    host = document.createElement('div');
    host.id = ID;
    host.setAttribute('data-p8-ignore', '');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('role', 'presentation');
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `
<style>
  * { pointer-events: none; box-sizing: border-box; }
  .cur { position: fixed; left: 0; top: 0; width: 44px; height: 32px; margin: -16px 0 0 -22px;
         filter: drop-shadow(0 2px 4px rgba(11,27,51,.28)); will-change: transform; opacity: 0;
         transition: opacity .18s ease; }
  .cur.on { opacity: 1; }
  .cur svg { display: block; width: 44px; height: 32px; overflow: visible; }
  .lab { position: absolute; left: 40px; top: 26px; white-space: nowrap; max-width: 280px;
         overflow: hidden; text-overflow: ellipsis; padding: 3px 8px; border-radius: 6px;
         background: ${COBALTO}; color: #fff; font: 500 12px/16px 'IBM Plex Sans', system-ui, sans-serif;
         box-shadow: 0 1px 3px rgba(11,27,51,.25); }
  .lab:empty { display: none; }
  .ring { position: fixed; border-radius: 8px; opacity: 0; transition: opacity .2s ease;
          box-shadow: 0 0 0 2px ${COBALTO}, 0 0 0 6px rgba(45,69,214,.18); }
  .ring.on { opacity: 1; }
  .rip { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
         border: 2px solid ${COBALTO}; background: rgba(45,69,214,.14); }
</style>
<div class="ring"></div>
<div class="cur">
  <svg viewBox="52 52 200 146" aria-hidden="true">
    <ellipse cx="114.3" cy="125.3" rx="26" ry="32" fill="#fff"/>
    <ellipse cx="190.1" cy="125.3" rx="26" ry="32" fill="#fff"/>
    <path fill="${COBALTO}" stroke="#fff" stroke-width="9" paint-order="stroke" stroke-linejoin="round" d="M244.2 125.52Q244.2 145.14 238.4 159.75Q232.6 174.35 221.46 182.49Q210.31 190.63 194.26 190.63Q184 190.63 176.08 187.28Q168.17 183.94 162.59 177.81Q157.02 171.67 153.9 163.42H150.49Q147.37 171.67 141.8 177.81Q136.22 183.94 128.31 187.28Q120.39 190.63 110.14 190.63Q94.08 190.63 82.94 182.49Q71.79 174.35 65.99 159.75Q60.19 145.14 60.19 125.52Q60.19 105.68 65.99 91.07Q71.79 76.47 82.94 68.33Q94.08 60.19 110.14 60.19Q120.39 60.19 128.31 63.54Q136.22 66.88 141.8 73.13Q147.37 79.37 150.49 87.62H153.9Q157.02 79.37 162.59 73.13Q168.17 66.88 176.08 63.54Q184 60.19 194.26 60.19Q210.31 60.19 221.46 68.33Q232.6 76.47 238.4 91.07Q244.2 105.68 244.2 125.52ZM90.29 125.52Q90.29 134.44 92.97 141.24Q95.64 148.04 101.11 151.61Q106.57 155.17 114.37 155.17Q122.18 155.17 127.42 151.61Q132.66 148.04 135.44 141.24Q138.23 134.44 138.23 125.52Q138.23 116.38 135.44 109.58Q132.66 102.78 127.42 99.1Q122.18 95.42 114.37 95.42Q106.57 95.42 101.11 99.21Q95.64 103 92.97 109.69Q90.29 116.38 90.29 125.52ZM214.1 125.52Q214.1 116.38 211.42 109.69Q208.75 103 203.29 99.21Q197.82 95.42 190.02 95.42Q182.22 95.42 176.98 99.1Q171.74 102.78 168.95 109.58Q166.16 116.38 166.16 125.52Q166.16 134.44 168.95 141.24Q171.74 148.04 176.98 151.61Q182.22 155.17 190.02 155.17Q197.82 155.17 203.29 151.61Q208.75 148.04 211.42 141.24Q214.1 134.44 214.1 125.52Z"/>
    <path class="pupilas" fill="${COBALTO}" d="M125.69 113.95C129.66 118.49 129.74 124.91 125.87 128.3C121.99 131.69 115.63 130.76 111.66 126.22C107.69 121.69 107.61 115.26 111.48 111.87C115.36 108.48 121.72 109.41 125.69 113.95ZM200.77 113.95C204.74 118.49 204.82 124.91 200.95 128.3C197.07 131.69 190.71 130.76 186.74 126.22C182.77 121.69 182.69 115.26 186.56 111.87C190.44 108.48 196.8 109.41 200.77 113.95Z"/>
  </svg>
  <span class="lab"></span>
</div>`;
    document.documentElement.appendChild(host);
  }
  const sh = host.shadowRoot;
  const cur = sh.querySelector('.cur');
  const lab = sh.querySelector('.lab');
  const ring = sh.querySelector('.ring');
  const pupilas = sh.querySelector('.pupilas');
  const at = (x, y, rot = 0) => `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  if (a.op === 'hide') {
    cur.classList.remove('on');
    ring.classList.remove('on');
    return true;
  }
  if (a.op === 'done') {
    ring.classList.remove('on');
    lab.textContent = '';
    return true;
  }

  // Destino: el elemento del último snapshot (data-p8-ref) o un punto dado.
  let x = a.x, y = a.y, rect = null, nombre = null;
  const el = a.ref ? document.querySelector(`[data-p8-ref="${CSS.escape(a.ref)}"]`) : null;
  if (el) {
    const r = el.getBoundingClientRect();
    rect = [r.left, r.top, r.right, r.bottom];
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
    if (a.op === 'type') {  // al escribir, justo debajo de donde empieza el texto, sin taparlo
      x = Math.min(x, r.left + 40);
      y = Math.min(r.bottom, r.top + 40) + 14;
    }
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const lf = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    nombre = clean(el.dataset.p8Label || el.getAttribute('aria-label') || (lf && lf.textContent)
                   || el.getAttribute('placeholder') || el.innerText);
    if (nombre.length > 32) nombre = nombre.slice(0, 31) + '…';
  }
  if (x == null || y == null) return false;
  x = Math.round(x); y = Math.round(y);
  if (a.verb) a.label = nombre ? `8 ${a.verb} «${nombre}»` : `8 ${a.verb}`;
  const from = a.from || host.__p8pos || [Math.round(innerWidth / 2), Math.round(innerHeight * 0.85)];
  lab.textContent = a.label || '';
  // Cerca del borde derecho la etiqueta va a la izquierda del cursor.
  const izq = x > innerWidth - 320;
  lab.style.left = izq ? 'auto' : '40px';
  lab.style.right = izq ? '40px' : 'auto';
  ring.classList.remove('on');
  cur.classList.add('on');

  // Deslizamiento de 350 a 500 ms según la distancia, con una leve inclinación hacia donde va.
  const dx = x - from[0], dy = y - from[1];
  const dist = Math.hypot(dx, dy);
  const dur = Math.round(Math.min(500, 350 + dist / 6));
  const tilt = Math.max(-8, Math.min(8, dx / 40));
  // Las pupilas miran hacia el destino mientras viaja.
  const px = dist ? (dx / dist) * 5 : 0, py = dist ? (dy / dist) * 4 : 0;
  pupilas.style.transition = 'transform .15s ease';
  pupilas.style.transform = `translate(${px}px, ${py}px)`;
  if (dist > 2 && cur.animate) {
    const anim = cur.animate(
      [{ transform: at(from[0], from[1]) },
       { transform: at(from[0] + dx * 0.6, from[1] + dy * 0.6, tilt), offset: 0.6 },
       { transform: at(x, y) }],
      { duration: dur, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    // Una pestaña en segundo plano puede no avanzar la animación: nunca se espera de más.
    await Promise.race([anim.finished.catch(() => {}), wait(dur + 120)]);
    anim.cancel();
  }
  cur.style.transform = at(x, y);
  host.__p8pos = [x, y];
  pupilas.style.transform = 'translate(0, 0)';

  clearTimeout(host.__p8quita);
  if (a.op === 'tap') {
    host.__p8quita = setTimeout(() => { lab.textContent = ''; }, 1800);  // la etiqueta no se queda
    const rip = document.createElement('div');
    rip.className = 'rip';
    rip.style.left = x + 'px';
    rip.style.top = y + 'px';
    sh.appendChild(rip);
    const r = rip.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }],
                          { duration: 520, easing: 'ease-out', fill: 'forwards' });
    r.finished.catch(() => {}).then(() => rip.remove());
    setTimeout(() => rip.remove(), 900);
    cur.animate([{ transform: at(x, y) }, { transform: at(x, y) + ' scale(.86)' }, { transform: at(x, y) }],
                { duration: 180, easing: 'ease-out' });
  }
  if (a.op === 'type' && rect) {
    const [l, t, rr, b] = rect;
    Object.assign(ring.style, { left: (l - 3) + 'px', top: (t - 3) + 'px',
                                width: (rr - l + 6) + 'px', height: (b - t + 6) + 'px' });
    ring.classList.add('on');
  }
  return [x, y];
}
