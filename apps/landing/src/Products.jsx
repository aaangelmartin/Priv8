import { useState } from 'react';
import Eight from './eight/Eight.jsx';
import { mood } from './companion.js';

const Tok = ({ children }) => <span className="tok">{children}</span>;

/* ---------------------------------------------------------------- productos */
export function Empresas() {
  return (
    <div className="vert">
      <div className="copy">
        <h3 className="h3big">Automatiza lo que la protección de datos te frenaba</h3>
        <p className="lead">8 trabaja en tu ERP o tu CRM de siempre, aunque no tenga API, y el proveedor del modelo solo recibe tokens.</p>
        <ul className="points">
          <li>Funciona sobre las pantallas que ya tienes, sin integrar nada.</li>
          <li>Un correo no puede cambiar un pago: la procedencia lo impide por diseño.</li>
          <li>Verifica por teléfono con el número que ya tenías, diciendo que es una IA.</li>
          <li>Cada paso queda firmado, listo para tus auditorías.</li>
        </ul>
      </div>
      <ol className="steps" aria-label="Ejemplo: una factura de proveedor">
        <li><b>Llega la factura de Suministros Lumen</b><span>8 la abre en la bandeja de siempre.</span></li>
        <li><b>La lee sin ver los datos</b><span>Al modelo le llegan <Tok>‹CIF_1›</Tok> e <Tok>‹IMPORTE_2›</Tok>.</span></li>
        <li><b>La registra en el ERP</b><span>El ejecutor escribe los valores reales en local.</span></li>
        <li className="trap"><b>El pie del correo pide pagar a un IBAN nuevo</b><span>Bloqueado: un dato que llega por correo no puede entrar en el campo de pago.</span></li>
        <li><b>Llama al proveedor al número de su ficha</b><span>Se presenta como IA y hace una pregunta de comprobación.</span></li>
        <li><b>Contesta el correo y firma el registro</b><span>Qué vio el modelo, qué se bloqueó y quién aprobó.</span></li>
      </ol>
    </div>
  );
}

const SCENES = [
  { id: 'cuanto', label: '¿Cuánto tengo?', mode: 'hablar', state: 'Habla' },
  { id: 'pasa', label: 'Pasa 200 € al bróker', mode: 'esperar', state: 'Espera tu sí' },
  { id: 'clave', label: 'Mientras pones tu clave', mode: 'apartar', state: 'Mira a otro lado' },
  { id: 'fondo', label: '¿En qué fondo lo meto?', mode: 'rechazar', state: 'No puedo' },
];

export function Movil({ pal }) {
  const [scene, setScene] = useState('cuanto');
  const [answer, setAnswer] = useState(null);
  const sc = SCENES.find((s) => s.id === scene);
  const mode = scene === 'pasa' && answer ? (answer === 'si' ? 'listo' : 'negar') : sc.mode;
  const pick = (id) => { setScene(id); setAnswer(null); };
  return (
    <div className="vert">
      <div className="copy">
        <h3 className="h3big">8 maneja tu móvil por ti, sin ver tus cuentas</h3>
        <p className="lead">Le hablas y 8 abre tus apps de banca, lee, suma y prepara. Las cifras te las dice la voz del móvil; a la nube no llegan.</p>
        <div className="chips-row" role="group" aria-label="Escenas">
          {SCENES.map((s) => (
            <button key={s.id} type="button" aria-pressed={scene === s.id} onClick={() => pick(s.id)}>{s.label}</button>
          ))}
        </div>
        <ul className="points">
          <li>Tu clave, tu huella y los códigos los pones tú. 8 mira a otro lado.</li>
          <li>Nada se mueve sin tu «sí», por voz o con un botón.</li>
          <li>Ejecuta, no aconseja: no recomienda inversiones ni firma créditos.</li>
        </ul>
      </div>
      <div className="phone-wrap">
        <div className="phone" aria-label="Simulación de 8 en el móvil">
          <span className="island" aria-hidden="true" />
          <div className="scr">
            <div className="top">
              <Eight className="eye" mode={mode} fg="#FFFFFF" cut={pal.band} label="8 en el móvil" />
              <small>{scene === 'pasa' && answer ? (answer === 'si' ? 'Hecho' : 'Cancelado') : sc.state}</small>
            </div>
            <div className="chat" aria-live="polite">
              {scene === 'cuanto' && (<>
                <p className="bubble me">¿Cuánto tengo entre mis bancos?</p>
                <p className="bubble eight">Entre tus cuentas tienes 15.462,58 €.<span className="local">La cifra la dice la voz del móvil. Al modelo solo le llegó ‹SUMA_1›.</span></p>
              </>)}
              {scene === 'pasa' && (<>
                <p className="bubble me">Pasa 200 € al bróker.</p>
                <p className="bubble eight">Lo tengo preparado. Falta tu confirmación.</p>
                {answer === 'si' && <p className="bubble eight">Hecho. Te dejo el justificante.</p>}
                {answer === 'no' && <p className="bubble eight">Cancelado. No se ha movido nada.</p>}
              </>)}
              {scene === 'clave' && (<>
                <p className="bubble eight">Pon tu clave. No miro.</p>
                <p className="bubble me mono">••••••••</p>
                <p className="bubble eight">Gracias. Sigo.<span className="local">El agente no recibe nada mientras escribes.</span></p>
              </>)}
              {scene === 'fondo' && (<>
                <p className="bubble me">¿En qué fondo lo meto?</p>
                <p className="bubble eight">Eso sería asesorarte y no lo hago. Si eliges un fondo, lo preparo.</p>
              </>)}
            </div>
            {scene === 'pasa' && !answer && (
              <div className="confirm">
                <b>200,00 € a tu cuenta de Nimbo Bróker. ¿Lo confirmas?</b>
                <div className="row2">
                  <button type="button" onClick={() => { setAnswer('no'); mood('negar', 1500); }}>Cancelar</button>
                  <button type="button" className="yes" onClick={() => { setAnswer('si'); mood('asentir', 1500); }}>Confirmar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

