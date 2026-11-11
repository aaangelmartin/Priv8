/* Priv8 - app 8 - de eventos del núcleo a caras de 8 (issue #39).
 *
 * Entrada: un mensaje del canal de eventos ws://127.0.0.1:8700/events
 * (docs/contracts/events.schema.json) o un cambio de conexión.
 * Salida: un plan de caras [{cara, ms}], donde cara es un estado del motor
 * de docs/ojos.html (P8.estados) y ms el tiempo que se mantiene. Un paso con
 * ms = null se queda puesto hasta el siguiente evento. Al acabar un plan sin
 * paso fijo, 8 vuelve a reposo ("mirar").
 *
 * Es una función pura: sin red, sin DOM, sin reloj. La usan app.js (WebView
 * y navegador) y dev/test_estados.mjs.
 *
 * Nunca recibe valores reales: el mensaje "screen" (que los lleva para la
 * consola) lo descarta EventsClient.kt antes de llegar aquí, y si llegara se
 * ignora igual.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Priv8Estados = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Duraciones de brand/tokens.css: --p8-dur-gesto (gestos de una vez). */
  var GESTO = 2800;
  var BREVE = 2200;
  var REPOSO = 'mirar';

  function paso(cara, ms) { return { cara: cara, ms: ms === undefined ? null : ms }; }
  function gesto(cara) { return [paso(cara, GESTO)]; }
  function fijo(cara) { return [paso(cara, null)]; }

  /* Motivos de bloqueo (common: fuga, destino, rojo, presupuesto, sin_regla,
     token_desconocido, caducado, cancelado) según el "cuando" de cada cara en
     docs/ojos.html. */
  function porBloqueo(reason) {
    switch (reason) {
      case 'rojo': return [paso('nuncasale', BREVE)];            // dato rojo: ni lo mira
      case 'asesoria': return gesto('rechazar');                 // «no puedo»: 8 ejecuta, no asesora (#43)
      case 'destino':                                            // IBAN de un correo en un pago
      case 'fuga': return gesto('enfado');                       // bloquea una instrucción escondida
      case 'caducado':
      case 'cancelado': return gesto('negar');                   // operación cancelada
      default: return gesto('tristeza');                         // no se ha podido hacer
    }
  }

  /* Tiempo aproximado de una frase de voz, hasta que el reproductor de voz
     mixta (Camino 3) avise de verdad del final. */
  function duracionVoz(segments) {
    var ms = 0;
    (segments || []).forEach(function (s) {
      if (s && typeof s.text === 'string') ms += s.text.length * 70;
      else ms += 1200; // token leído en local: cifra o nombre
    });
    return Math.max(1500, Math.min(ms, 12000));
  }

  function porAuditoria(ev) {
    if (!ev || typeof ev !== 'object') return null;
    switch (ev.kind) {
      case 'task': return fijo('pensar');                        // planifica el trámite
      case 'observe_sent': {                                     // lee una pantalla del banco
        var plan = [paso('leer', BREVE)];
        var c = ev.counts || {};
        if (c.rojo > 0) plan.push(paso('nuncasale', BREVE));
        else if (c.ambar > 0) plan.push(paso('nove', BREVE));    // los datos salen como tokens
        return plan;
      }
      case 'act':
      case 'oracle': return fijo('cargando');                    // ejecuta un paso o espera al oráculo
      case 'held': return fijo('esperar');                       // espera tu confirmación
      case 'approval': return gesto(ev.approved_by === 'persona' ? 'asentir' : 'negar');
      case 'blocked': return porBloqueo(ev.reason);
      case 'paused': return fijo('apartar');                     // pones tu clave, huella u OTP
      case 'call': return fijo('hablar');
      case 'voice_out': return null;                             // ya lo cubre el mensaje voice
      default: return null;
    }
  }

  /* Devuelve el plan de caras, o null si el mensaje no cambia la cara. */
  function decidir(msg) {
    if (!msg || typeof msg !== 'object') return null;
    switch (msg.type) {
      case 'audit': return porAuditoria(msg.event);
      case 'voice': return [paso('hablar', duracionVoz(msg.utterance && msg.utterance.segments))];
      case 'confirm_request': return [paso('atencion', 1200), paso('esperar', null)];
      case 'approval_result':
        return gesto(msg.ok ? 'asentir' : 'negar');
      case 'screen': return null;                                // lleva valores reales: no se usa
      default: return null;
    }
  }

  /* Cambios de conexión con el núcleo. */
  function conexion(estado) {
    if (estado === 'conectado') return [paso('saludar', GESTO)];
    if (estado === 'sin_conexion') return fijo('sinconexion');
    return null;
  }

  return { decidir: decidir, conexion: conexion, REPOSO: REPOSO, GESTO: GESTO };
});
