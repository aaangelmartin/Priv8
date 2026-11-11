import Eight from '@landing/eight/Eight.jsx';
import Reproductor from './Movil.jsx';
import { MOVIL } from './contenido.js';

/* /movil/?caso=<id>: un caso del móvil a página completa, como la consola abre los de empresa. Arriba la barra
   cobalto de la consola; debajo el encargo y el reproductor grande (el vídeo del emulador y lo que ve el modelo). */
const id = new URLSearchParams(window.location.search).get('caso');
const caso = MOVIL.find((c) => c.id === id) ?? MOVIL[0];

export default function PaginaMovil() {
  document.title = `Priv8 - ${caso.titulo}`;
  return (
    <div className="mp">
      <header className="mp-nav">
        <a className="mp-brand" href="/" aria-label="Priv8, volver a la demo">
          <Eight className="mp-eight" mode="mirar" fg="#FFFFFF" cut="#2D45D6" label="8" />
          <span>Priv8</span>
          <span className="mp-prod">En el móvil</span>
        </a>
        <span className="sp" />
        <a className="mp-volver" href="/#movil">Volver a la demo</a>
      </header>
      <main className="mp-main">
        <div className="mp-head">
          <p className="mp-eyebrow">Grabado en el emulador</p>
          <h1>{caso.titulo}</h1>
          <p className="mp-linea">{caso.linea}</p>
        </div>
        <div className="mv-caja mp-caja">
          {caso.pedido && <div className="mv-cab"><p className="mv-pedido">{caso.pedido}</p></div>}
          <Reproductor caso={caso} />
        </div>
      </main>
    </div>
  );
}
