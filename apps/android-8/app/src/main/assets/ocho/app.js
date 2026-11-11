/* Priv8 - app 8 - los ojos en pantalla completa y los eventos del núcleo (issue #39).
 *
 * Carga docs/ojos.html (copiado en el build, sin tocarlo) en un iframe, deja
 * visible solo el 8 grande y lo mueve con P8.poner() según estados.js.
 *
 * Los eventos llegan de dos formas:
 *  - en la app Android, EventsClient.kt llama a window.Ocho.evento(json);
 *  - en el navegador (vista previa), este archivo abre él mismo el WebSocket
 *    ws://127.0.0.1:8700/events.
 *
 * No guarda ni registra el contenido de los mensajes.
 */
(function () {
  'use strict';
  var E = window.Priv8Estados;
  var marco = document.getElementById('ojos');
  var estado = document.getElementById('estado');
  var P8 = null, pendiente = E.REPOSO, temporizador = null, actual = null;
  /* Voz en vivo: mientras llega el nivel del micrófono o de la salida de audio,
     8 escucha o habla con ese nivel; la cara de los eventos (base) se guarda y
     vuelve FIN_VIVO_MS después del último nivel. */
  var base = E.REPOSO, vivo = null, finVivo = null, FIN_VIVO_MS = 600;
  var CARA_VIVA = { microfono: 'escuchar', voz: 'hablar' };
  var enAndroid = !!window.OchoAndroid;
  var params = new URLSearchParams(location.search);
  /* la línea de estado solo sale si se pide (?debug en el navegador): en el móvil nunca, ni en la build de depuración */
  var depurar = params.has('debug');

  /* ---------- cara ---------- */
  function poner(cara) {
    base = cara;
    if (!vivo) mostrar(cara);
  }

  function mostrar(cara) {
    actual = cara;
    if (!P8) { pendiente = cara; return; }
    if (!P8.poner(cara)) P8.poner(E.REPOSO);
    pintarEstado();
  }

  function aplicar(plan) {
    if (!plan || !plan.length) return;
    clearTimeout(temporizador);
    (function paso(i) {
      if (i >= plan.length) { poner(E.REPOSO); return; }
      poner(plan[i].cara);
      if (plan[i].ms !== null) temporizador = setTimeout(function () { paso(i + 1); }, plan[i].ms);
    })(0);
  }

  /* ---------- solo el 8 grande ---------- */
  var CSS =
    'html,body{margin:0;height:100%;background:#2D45D6;overflow:hidden}' +
    'body{padding:0!important}' +
    'body>*:not(#p8-solo){display:none!important}' +
    '#p8-solo{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}' +
    '#p8-solo #big{width:min(78vw,78vh);max-width:none;margin:0}';

  function prepararOjos() {
    var w = marco.contentWindow, d = marco.contentDocument;
    var big = d && d.getElementById('big');
    if (!w || !w.P8 || !big || !big.querySelector('svg')) { setTimeout(prepararOjos, 50); return; }
    var st = d.createElement('style'); st.textContent = CSS; d.head.appendChild(st);
    var solo = d.createElement('div'); solo.id = 'p8-solo'; d.body.appendChild(solo); solo.appendChild(big);
    P8 = w.P8;
    mostrar(pendiente);
  }
  marco.addEventListener('load', prepararOjos);

  /* ---------- estado para depurar (solo con ?debug) ---------- */
  var conexion = null; // aún no se sabe
  function pintarEstado() {
    if (!depurar) return;
    estado.hidden = false;
    estado.textContent = 'núcleo: ' + (conexion === 'conectado' ? 'conectado' : 'sin conexión') + ' | cara: ' + (actual || '—');
  }

  /* ---------- API para Kotlin y para el navegador ---------- */
  window.Ocho = {
    /* Un mensaje del canal de eventos, como texto JSON. */
    evento: function (texto) {
      var msg;
      try { msg = JSON.parse(texto); } catch (e) { return false; }
      if (msg && msg.type === 'screen') return false; // lleva valores reales: no se usa
      aplicar(E.decidir(msg));
      return true;
    },
    /* 'conectado' | 'sin_conexion'. Con sinCara solo se anota, sin saludar: la pantalla
       de confirmación, cuya petición llegó por el puente con el núcleo en marcha. */
    conexion: function (c, sinCara) {
      if (c === conexion) return;
      conexion = c;
      if (!sinCara) aplicar(E.conexion(c));
      pintarEstado();
    },
    /* Nivel real de la voz, de 0 a 1, unas 30 veces por segundo mientras suena:
       fuente 'microfono' (escuchar) o 'voz' (hablar). Lo envía OjosView.kt. */
    nivel: function (fuente, v) {
      var cara = CARA_VIVA[fuente];
      if (!cara || typeof v !== 'number' || !isFinite(v)) return false;
      if (vivo !== cara) { vivo = cara; mostrar(cara); }
      if (P8 && P8.nivel) P8.nivel(v);
      clearTimeout(finVivo);
      finVivo = setTimeout(function () { vivo = null; mostrar(base); }, FIN_VIVO_MS);
      return true;
    },
    /* Para probar a mano: Ocho.cara('apartar') */
    cara: function (c) { clearTimeout(temporizador); poner(c); },
    get actual() { return actual; }
  };

  /* ---------- navegador: WebSocket propio ---------- */
  if (!enAndroid) {
    var url = params.get('ws') || 'ws://127.0.0.1:8700/events', espera = 1000;
    (function conectar() {
      var ws;
      try { ws = new WebSocket(url); } catch (e) { setTimeout(conectar, espera); return; }
      ws.onopen = function () { espera = 1000; window.Ocho.conexion('conectado'); };
      ws.onmessage = function (m) { if (typeof m.data === 'string') window.Ocho.evento(m.data); };
      ws.onclose = function () {
        window.Ocho.conexion('sin_conexion');
        setTimeout(conectar, espera); espera = Math.min(espera * 2, 30000);
      };
    })();
  }
  pintarEstado();
})();
