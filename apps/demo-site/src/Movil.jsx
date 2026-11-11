import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Eight from '@landing/eight/Eight.jsx';

/* Priv8 en el móvil: el reproductor lado a lado. A la izquierda, el vídeo real del emulador; a la derecha, la
   pantalla redibujada con la observación que recibió el modelo en ese instante (los mismos elementos en su sitio,
   con tokens en lugar de valores y «nunca sale» en los datos rojos), y debajo lo que dice 8.
   Los datos son public/movil/<caso>.json (formato priv8-movil/1, scripts/grabar_movil_video.py). */

const TOKEN = /(‹[^›]+›)/g;
export function conTokens(texto) {
  if (!texto) return null;
  return String(texto).split(TOKEN).map((p, i) => (p.startsWith('‹') ? <span key={i} className="tok">{p}</span> : p));
}

/* la pantalla vigente en el segundo t: la última con t <= tiempo */
export function pantallaEn(pantallas, t) {
  let cur = null;
  for (const p of pantallas || []) { if (p.t <= t + 0.05) cur = p; else break; }
  return cur;
}
export function vozEn(voz, t) {
  return (voz || []).filter((v) => v.t <= t && t < (v.fin ?? v.t + 5)).pop() ?? null;
}
export function hitoEn(hitos, t) {
  let cur = null;
  for (const h of hitos || []) { if (h.t <= t + 0.05) cur = h; else break; }
  return cur;
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* Lo que ve el modelo: cada elemento observado, en su caja de la pantalla real (bounds en píxeles del móvil). */
function Modelo({ datos, p, escala }) {
  const W = datos.w || 1080, H = datos.h || 2400;
  if (!p) {
    return (
      <div className="mv-vacio">
        <div className="mv-vacio-8"><Eight mode={datos.sinPantallas ? 'negar' : 'esperar'} fg="#2D45D6" cut="#FFFFFF" label="8" /></div>
        <p>{datos.sinPantallas ? 'La petición no llega al modelo.' : 'El modelo aún no ha recibido ninguna pantalla.'}</p>
      </div>
    );
  }
  if (p.paused) {
    return (
      <div className="mv-vacio mv-pausa">
        <div className="mv-vacio-8"><Eight mode="apartar" fg="#FFFFFF" cut="#0B1B33" label="8" /></div>
        <p>8 mira a otro lado. El modelo no recibe esta pantalla.</p>
      </div>
    );
  }
  const conCaja = (p.elementos || []).filter((e) => Array.isArray(e.bounds));
  /* un botón sin texto propio que envuelve otros elementos (una fila de cuenta) se dibuja solo como caja */
  const envuelve = (e) => conCaja.some((o) => o !== e && o.bounds[0] >= e.bounds[0] && o.bounds[1] >= e.bounds[1]
    && o.bounds[2] <= e.bounds[2] && o.bounds[3] <= e.bounds[3] && (o.text || o.label));
  const els = conCaja.filter((e) => e.text || e.label || e.cls === 'rojo');
  return (
    <div className="mv-dibujo">
      {els.map((e) => {
        const [l, t, r, b] = e.bounds;
        const alto = Math.max(1, b - t);
        const fs = Math.max(7, Math.min(alto * 0.5, e.role === 'heading' ? 64 : 46) * escala);
        const boton = (e.actions || []).length > 0 || e.role === 'button';
        const cls = `mv-el r-${e.role || 'text'} c-${e.cls || 'verde'}${boton ? ' es-boton' : ''}`;
        const style = { left: `${(l / W) * 100}%`, top: `${(t / H) * 100}%`, width: `${((r - l) / W) * 100}%`, height: `${(alto / H) * 100}%`, fontSize: `${fs}px` };
        let cuerpo;
        if (e.cls === 'rojo') cuerpo = <span className="mv-nunca">{e.label ? `${e.label}: ` : ''}nunca sale</span>;
        else if (!e.text && boton && envuelve(e)) cuerpo = null;
        else cuerpo = <span className="mv-txt">{conTokens(e.text || e.label)}</span>;
        return <div key={e.id} className={cls} style={style} title={e.label || undefined}>{cuerpo}</div>;
      })}
    </div>
  );
}

function Subtitulo({ v }) {
  if (!v) return <p className="mv-sub vacio" aria-hidden="true">&nbsp;</p>;
  return (
    <p className="mv-sub">
      {(v.segmentos || []).map((s, i) => (s.voz === 'local' || s.token
        ? <span key={i} className="mv-local"><span className="tok">{s.token || s.texto}</span><small>voz local</small></span>
        : <span key={i}>{conTokens(s.texto)} </span>))}
    </p>
  );
}

export default function Reproductor({ caso }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [t, setT] = useState(0);
  const [jugando, setJugando] = useState(false);
  const [vel, setVel] = useState(1);
  const [escala, setEscala] = useState(0.3);
  const video = useRef(null);
  const marco = useRef(null);

  useEffect(() => {
    let vivo = true;
    setDatos(null); setError(false); setT(0); setJugando(false);
    fetch(caso.datos).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (vivo) setDatos({ ...d, sinPantallas: !(d.pantallas || []).length }); }, () => vivo && setError(true));
    return () => { vivo = false; };
  }, [caso.datos]);

  /* el tamaño de letra del dibujo sigue al ancho del marco (los bounds son del móvil, 1080 px de ancho) */
  useLayoutEffect(() => {
    const el = marco.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setEscala(el.clientWidth / ((datos && datos.w) || 1080)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [datos]);

  /* el reloj es el del vídeo: mientras suena, cada fotograma */
  useEffect(() => {
    if (!jugando) return undefined;
    let raf = 0;
    const tick = () => { if (video.current) setT(video.current.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [jugando]);
  useEffect(() => { if (video.current) video.current.playbackRate = vel; }, [vel, datos]);

  const alternar = useCallback(() => {
    const v = video.current; if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);
  const ir = (s) => { if (video.current) { video.current.currentTime = s; setT(s); } };

  const p = useMemo(() => (datos ? pantallaEn(datos.pantallas, t) : null), [datos, t]);
  const v = useMemo(() => (datos ? vozEn(datos.voz, t) : null), [datos, t]);
  const h = useMemo(() => (datos ? hitoEn(datos.hitos, t) : null), [datos, t]);
  const dur = datos?.duracion || 1;

  if (error) return <p className="mv-error">Esta grabación no está en esta build.</p>;
  return (
    <div className="mv" aria-busy={!datos}>
      <div className="mv-pantallas">
        <figure className="mv-lado">
          <figcaption>Lo que ves tú</figcaption>
          <div className="mv-movil" style={{ aspectRatio: `${datos?.w || 1080} / ${datos?.h || 2400}` }}>
            {datos && (
              <video ref={video} src={`/${datos.video}`} poster={`/${datos.poster}`} muted playsInline preload="metadata"
                onPlay={() => setJugando(true)} onPause={() => setJugando(false)} onEnded={() => setJugando(false)}
                onSeeked={(e) => setT(e.currentTarget.currentTime)} onTimeUpdate={(e) => { if (e.currentTarget.paused) setT(e.currentTarget.currentTime); }} onClick={alternar} />
            )}
          </div>
        </figure>
        <figure className="mv-lado">
          <figcaption>Lo que ve el modelo</figcaption>
          <div ref={marco} className="mv-movil mv-movil-modelo" style={{ aspectRatio: `${datos?.w || 1080} / ${datos?.h || 2400}` }}>
            {datos && <Modelo datos={datos} p={p} escala={escala} />}
          </div>
        </figure>
      </div>
      <Subtitulo v={v} />
      <div className="mv-mandos">
        <button type="button" className="mv-play" onClick={alternar} disabled={!datos}>{jugando ? 'Pausa' : 'Reproducir'}</button>
        <div className="mv-linea">
          <input type="range" min="0" max={dur} step="0.1" value={Math.min(t, dur)} aria-label="Momento de la grabación"
            onChange={(e) => ir(Number(e.target.value))} disabled={!datos} />
          <div className="mv-hitos" aria-hidden="true">
            {(datos?.hitos || []).map((x, i) => <i key={i} className={`k-${x.tipo}`} style={{ left: `${(x.t / dur) * 100}%` }} />)}
          </div>
        </div>
        <span className="mv-tiempo">{fmt(t)} / {fmt(dur)}</span>
        <div className="mv-vel" role="group" aria-label="Velocidad">
          {[1, 2].map((x) => <button key={x} type="button" aria-pressed={vel === x} onClick={() => setVel(x)}>{x}x</button>)}
        </div>
      </div>
      <p className="mv-hito">{h ? <><b>{fmt(h.t)}</b> {conTokens(h.texto || TIPOS[h.tipo] || h.tipo)}</> : <>&nbsp;</>}</p>
    </div>
  );
}

const TIPOS = { pedido: 'Lo pides', oraculo: 'El oráculo calcula sin revelar', confirmacion: '8 pide confirmación', aprobada: 'Lo apruebas',
  pausa: '8 mira a otro lado', bloqueo: 'Bloqueado', persona: 'Lo haces tú' };
