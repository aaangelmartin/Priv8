/* Motor de 8, extraído de docs/ojos.html (el script de la página sin el taller ni la página; solo cambia la llamada a setBig por cfg.onEnd). Si cambia docs/ojos.html, se vuelve a copiar ese bloque. */
export function createEngine(){
  var NOCHE='#0B1B33', COB='#2D45D6', W='#FFFFFF', CL='#8FA2FF', NIEBLA='#EEF2F8';
  var TONES={ok:'#1F8A5B',warn:'#A86400',bad:'#C23A2E'};
  var FONT='Sora, "Segoe UI", system-ui, sans-serif';
  var M=null;

  /* Mide el 8 de la fuente: caja del glifo y los dos huecos (inferior y superior). */
  function measure8(){
    var S=300, c=document.createElement('canvas'); c.width=420; c.height=440;
    var x=c.getContext('2d'); x.font='700 '+S+'px '+FONT; x.textBaseline='alphabetic'; x.fillStyle='#000';
    var ox=60, oy=380, m=x.measureText('8'); x.fillText('8',ox,oy);
    var d=x.getImageData(0,0,c.width,c.height).data;
    function ink(px,py){ return d[(py*c.width+px)*4+3]>128; }
    var L=m.actualBoundingBoxLeft, R=m.actualBoundingBoxRight, A=m.actualBoundingBoxAscent, D=m.actualBoundingBoxDescent;
    var cx=Math.round(ox+(R-L)/2), gaps=[], state=0, start=0;
    for(var y=Math.round(oy+D)+2; y>oy-A-2; y--){
      var i=ink(cx,y);
      if(state===0 && i) state=1;
      else if(state===1 && !i){ state=2; start=y; }
      else if(state===2 && i){ gaps.push([y+1,start]); state=1; if(gaps.length===2) break; }
    }
    function counter(g){
      var top=g[0], bot=g[1], cy=(top+bot)/2, r=Math.round(cy), xl=cx, xr=cx;
      while(xl>0 && !ink(xl,r)) xl--; while(xr<c.width && !ink(xr,r)) xr++;
      return {x:(xl+xr)/2, y:cy, rx:(xr-xl)/2, ry:(bot-top)/2};
    }
    var lo, waist;
    if(gaps.length>=2){ lo=counter(gaps[0]); waist=(gaps[0][0]+gaps[1][1])/2; }
    else { var gw=(R+L); lo={x:ox+(R-L)/2,y:oy-A*0.27,rx:gw*0.2,ry:A*0.15}; waist=oy-A*0.5; }
    var wr=Math.round(waist), nl=Math.round(ox-L)-2, nr=Math.round(ox+R)+2;
    while(nl<nr && !ink(nl,wr)) nl++; while(nr>nl && !ink(nr,wr)) nr--;
    return {S:S,ox:ox,oy:oy,L:L,R:R,A:A,D:D,lo:lo,waist:waist,nl:nl,nr:nr};
  }
  var UID=0;
  function f(n){ return n.toFixed(2); }

  /* El 8 simétrico: la mitad inferior del 8 de Sora, reflejada arriba. Cintura en y=32.
     lying = girado 90° (los ojos). Devuelve el svg y los dos huecos ya colocados. */
  function eight(lying, target, fill){
    var half=(M.oy+M.D)-M.waist, s=target/(2*half), W8=(M.L+M.R)*s;
    var bx=32-((M.R-M.L)/2)*s, base=32-(M.waist-M.oy)*s, id='p8c'+(UID++);
    var t='<text x="'+f(bx)+'" y="'+f(base)+'" font-family=\''+FONT+'\' font-weight="700" font-size="'+f(M.S*s)+'" fill="'+fill+'">8</text>';
    var nx=bx+(M.nl-M.ox)*s, nw=(M.nr-M.nl)*s;
    var body='<clipPath id="'+id+'"><rect x="-40" y="32" width="144" height="80"/></clipPath>'+
      '<g clip-path="url(#'+id+')">'+t+'</g>'+
      '<g transform="translate(0 64) scale(1 -1)"><g clip-path="url(#'+id+')">'+t+'</g></g>'+
      '<rect x="'+f(nx)+'" y="31.5" width="'+f(nw)+'" height="1" fill="'+fill+'"/>';
    var ux=bx+(M.lo.x-M.ox)*s, uy=base+(M.lo.y-M.oy)*s, rx=M.lo.rx*s, ry=M.lo.ry*s;
    var eyes=[{x:ux,y:64-uy,rx:rx,ry:ry},{x:ux,y:uy,rx:rx,ry:ry}];
    if(lying){
      body='<g transform="rotate(-90 32 32)">'+body+'</g>';
      eyes=eyes.map(function(e){ return {x:32+(e.y-32), y:32-(e.x-32), rx:e.ry, ry:e.rx}; });
    }
    return {svg:body, eyes:eyes, halfW:(lying?target:W8)/2, halfH:(lying?W8:target)/2};
  }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function seg(P,a,b){ return clamp((P-a)/(b-a),0,1); }
  function easeOut(x){ return 1-Math.pow(1-x,3); }
  function back(x){ var c=1.7; return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2); }
  function L(x1,y1,x2,y2,c,w,extra){ return '<line x1="'+f(x1)+'" y1="'+f(y1)+'" x2="'+f(x2)+'" y2="'+f(y2)+'" stroke="'+c+'" stroke-width="'+f(w)+'" stroke-linecap="round"'+(extra||'')+'/>'; }
  function eyeClip(e,grow){ var id='q'+(UID++); return {id:id, def:'<clipPath id="'+id+'"><ellipse cx="'+f(e.x)+'" cy="'+f(e.y)+'" rx="'+f(e.rx+(grow||0))+'" ry="'+f(e.ry+(grow||0))+'"/></clipPath>'}; }
  function lidAt(eyes, fg, t){
    var out=''; t=clamp(t,0,1.05);
    eyes.forEach(function(e){
      var c=eyeClip(e,1.8), lry=e.ry*1.3, lrx=e.rx*1.7, open=e.y-e.ry-lry-1, closed=e.y+e.ry*1.02-lry;
      out+=c.def+'<g clip-path="url(#'+c.id+')"><ellipse cx="'+f(e.x)+'" cy="'+f(open+(closed-open)*t)+'" rx="'+f(lrx)+'" ry="'+f(lry)+'" fill="'+fg+'"/></g>';
    });
    return out;
  }
  function pupilAt(e, px, py, r, fg){
    /* pupila redonda con escorzo: se aplasta hacia el borde, como si estuviera sobre una esfera */
    var m=clamp(Math.sqrt(px*px+py*py),0,1), ang=Math.atan2(py,px)*180/Math.PI, mx=e.rx-r-0.7, my=e.ry-r-0.7;
    var x=e.x+px*mx, y=e.y+py*my;
    return '<ellipse cx="'+f(x)+'" cy="'+f(y)+'" rx="'+f(r*(1-0.28*m))+'" ry="'+f(r)+'" transform="rotate('+f(ang)+' '+f(x)+' '+f(y)+')" fill="'+fg+'"/>';
  }
  function pupilR(e){ return Math.min(e.rx,e.ry)*0.46; }


  /* ======================================================================
     8 · ESTADOS
     Emociones: lo que siente. Flujo: lo que hace en cada paso del trámite.
     Todo sale de los mismos ojos: pupilas, párpados (con ángulo para el ceño
     y la tristeza), párpado inferior (sonrisa), tamaño e inclinación.
     ====================================================================== */
  var EMO=[
    {k:'alegria',   g:'Emociones', n:'Alegría',     d:'Ojos sonrientes y un balanceo suave.', use:'saludo, buena noticia'},
    {k:'risa',      g:'Emociones', n:'Risa',        d:'Ojos sonrientes y una carcajada a golpes: ja, ja, ja.', use:'una broma del usuario'},
    {k:'agradecer', g:'Emociones', n:'Agradecer',   d:'Parpadeo lento con sonrisa: señal de confianza.', use:'le das las gracias'},
    {k:'sorpresa',  g:'Emociones', n:'Sorpresa',    d:'Da un salto, abre mucho y encoge las pupilas.', use:'algo inesperado en la pantalla', once:1},
    {k:'tristeza',  g:'Emociones', n:'Tristeza',    d:'Párpados caídos hacia fuera, mirada baja y un suspiro.', use:'error: no se ha podido hacer'},
    {k:'enfado',    g:'Emociones', n:'Enfado',      d:'Ceño firme, pupilas pequeñas y un resoplido.', use:'bloquea una instrucción escondida'},
    {k:'miedo',     g:'Emociones', n:'Miedo',       d:'Se echa atrás, tiembla y mira a los lados.', use:'detecta una acción arriesgada'},
    {k:'curiosidad',g:'Emociones', n:'Curiosidad',  d:'Un ojo más abierto, la cabeza ladeada y un acercamiento.', use:'le pides algo nuevo o pregunta un detalle'},
    {k:'duda',      g:'Emociones', n:'Duda',        d:'Un párpado baja, el otro no; ladea la cabeza.', use:'no entiende la orden'},
    {k:'disculpa',  g:'Emociones', n:'Disculpa',    d:'Mira abajo, se encoge y vuelve a mirarte con media sonrisa.', use:'se ha equivocado', once:1},

    {k:'mirar',     g:'Flujo',     n:'Reposo',      d:'Sigue el puntero, parpadea y a veces mira alrededor o bosteza. Haz clic: tiene cosquillas.', use:'app abierta, sin tarea'},
    {k:'saludar',   g:'Flujo',     n:'Saludar',     d:'Abre los ojos, da un saltito y sonríe.', use:'al abrir la app', once:1},
    {k:'atencion',  g:'Flujo',     n:'Llamar',      d:'Dos saltitos y te mira.', use:'necesita tu respuesta'},
    {k:'interrumpido',g:'Flujo',   n:'Interrumpido',d:'Se calla de golpe, da un respingo y se pone a escucharte.', use:'hablas mientras 8 habla', once:1},
    {k:'escuchar',  g:'Flujo',     n:'Escuchar',    d:'Atento al frente; las pupilas laten con tu voz.', use:'micrófono activo'},
    {k:'hablar',    g:'Flujo',     n:'Hablar',      d:'Pequeños rebotes al ritmo de las sílabas.', use:'responde por voz'},
    {k:'pensar',    g:'Flujo',     n:'Pensar',      d:'Entrecierra y mira arriba en saltos rápidos.', use:'planifica el trámite'},
    {k:'leer',      g:'Flujo',     n:'Leer',        d:'Las pupilas recorren líneas de izquierda a derecha.', use:'lee una pantalla del banco'},
    {k:'cargando',  g:'Flujo',     n:'Cargando',    d:'Las pupilas dan vueltas por el borde del ojo, las dos a la vez.', use:'ejecuta un paso o espera al oráculo'},
    {k:'permiso',   g:'Flujo',     n:'Pedir permiso',d:'Ladea la cabeza y te mira desde abajo, con pupilas grandes.', use:'quiere que le enseñes un dato'},
    {k:'esperar',   g:'Flujo',     n:'Esperar',     d:'Te mira, atento y quieto, con parpadeos lentos.', use:'espera tu confirmación'},
    {k:'apartar',   g:'Flujo',     n:'Mirar a otro lado', d:'Gira la cabeza y aparta la vista mientras escribes.', use:'introduces tu clave o el código del banco'},
    {k:'listo',     g:'Flujo',     n:'Listo',       d:'Rebote con estiramiento y ojos sonrientes.', use:'tarea completada', once:1},
    {k:'asentir',   g:'Flujo',     n:'Confirmado',  d:'Dos cabeceos cortos.', use:'aceptas una operación', once:1},
    {k:'negar',     g:'Flujo',     n:'Cancelado',   d:'Sacude la cabeza de lado a lado.', use:'cancelas una operación', once:1},
    {k:'rechazar',  g:'Flujo',     n:'No puedo',    d:'Un "no" lento con los ojos tranquilos y media sonrisa.', use:'piden asesoría de inversión o un dato rojo', once:1},
    {k:'sinconexion',g:'Flujo',    n:'Sin conexión',d:'Busca arriba a los lados y lo vuelve a intentar con un saltito.', use:'sin conexión, reintentando'},
    {k:'dormir',    g:'Flujo',     n:'Inactivo',    d:'Ojos cerrados que respiran, con zetas en Sora.', use:'app en segundo plano'},

    {k:'ve',        g:'Datos',     n:'Ve',          d:'Ojos abiertos: 8 puede ver esto.', use:'dato verde, interfaz'},
    {k:'nove',      g:'Datos',     n:'Tokenizado',  d:'Los ojos se cierran en dos asteriscos: lo tiene, pero tapado.', use:'dato ámbar: saldos, IBAN, nombres'},
    {k:'nuncasale', g:'Datos',     n:'Nunca sale',  d:'Cierra los ojos como al parpadear y se queda así: ni lo mira.', use:'dato rojo: contraseñas y códigos'}
  ];
  function emo(k){ for(var i=0;i<EMO.length;i++) if(EMO[i].k===k) return EMO[i]; if(typeof CUSTOM!=='undefined' && CUSTOM[k]) return {k:k,n:CUSTOM[k].nombre,use:CUSTOM[k].descripcion||'expresión a medida',once:CUSTOM[k].duracion?1:0}; return EMO[0]; }

  /* No ve: el hueco se cierra desde el borde y queda recortado en forma de asterisco
     macizo de seis brazos, con la proporción del de Sora pero sin sus cortes. */
  function asterisk(E,P,col){
    var out='', Pc=clamp(P,0,1);
    E.eyes.forEach(function(e){
      var x=e.x, y=e.y, cl=eyeClip(e,1.4), q=easeOut(seg(Pc,0,0.55)), pa=back(seg(Pc,0.25,0.95));
      var irx=e.rx*(1-q)+0.0001, iry=e.ry*(1-q)+0.0001, R=e.rx+2, Ry=e.ry+2;
      var ring='M'+f(x-R)+' '+f(y)+' a'+f(R)+' '+f(Ry)+' 0 1 0 '+f(2*R)+' 0 a'+f(R)+' '+f(Ry)+' 0 1 0 '+f(-2*R)+' 0 Z '+
               'M'+f(x-irx)+' '+f(y)+' a'+f(irx)+' '+f(iry)+' 0 1 0 '+f(2*irx)+' 0 a'+f(irx)+' '+f(iry)+' 0 1 0 '+f(-2*irx)+' 0 Z';
      out+=cl.def+'<g clip-path="url(#'+cl.id+')"><path d="'+ring+'" fill-rule="evenodd" fill="'+col.fg+'"/></g>';
      if(pa>0.01){
        var Lh=Math.min(e.rx,e.ry)*0.98, wd=Lh*0.5, rot=(1-clamp(pa,0,1))*-120;
        out+='<g transform="translate('+f(x)+' '+f(y)+') rotate('+f(rot)+') scale('+f(Math.max(pa,0.001))+')">';
        for(var b=0;b<3;b++) out+='<rect x="'+f(-wd/2)+'" y="'+f(-Lh)+'" width="'+f(wd)+'" height="'+f(2*Lh)+'" rx="'+f(wd*0.12)+'" fill="'+col.cut+'" transform="rotate('+(b*60)+')"/>';
        out+='</g>';
      }
    });
    return out;
  }

  /* Párpado superior con ángulo: ang>0 baja la esquina interior (ceño), ang<0 la exterior (tristeza). */
  function lidA(e, fg, t, ang, left){
    if(t<0.01) return '';
    t=clamp(t,0,1.05);
    var c=eyeClip(e,1.8), lry=e.ry*1.3, lrx=e.rx*1.7, open=e.y-e.ry-lry-1, closed=e.y+e.ry*1.02-lry, cy=open+(closed-open)*t;
    var a=(left?1:-1)*(ang||0);
    return c.def+'<g clip-path="url(#'+c.id+')"><ellipse cx="'+f(e.x)+'" cy="'+f(cy)+'" rx="'+f(lrx)+'" ry="'+f(lry)+'" fill="'+fg+'" transform="rotate('+f(a)+' '+f(e.x)+' '+f(e.y)+')"/></g>';
  }
  /* Párpado inferior: sube y hace de sonrisa. */
  function lowLid(e, fg, amt){
    if(amt<0.01) return '';
    var c=eyeClip(e,1.8), lry=e.ry*1.3, lrx=e.rx*1.7, open=e.y+e.ry+lry+1, up=e.y+e.ry*0.2+lry;
    return c.def+'<g clip-path="url(#'+c.id+')"><ellipse cx="'+f(e.x)+'" cy="'+f(open+(up-open)*(amt/0.55))+'" rx="'+f(lrx)+'" ry="'+f(lry)+'" fill="'+fg+'"/></g>';
  }


  /* ======================================================================
     EXPRESIONES A MEDIDA
     Una expresión es un JSON con una postura y una lista de movimientos. El motor
     la valida y recorta cada valor a su rango, así que una expresión inventada por
     el agente nunca rompe a 8 ni se sale de la marca: solo ojos, sin adornos.
     Esquema completo y documentado: brand/8/expresion.schema.json
     ====================================================================== */
  var RANGOS={
    'mirada.x':[-1,1,0], 'mirada.y':[-1,1,0],
    'parpados.izq':[0,0.9,0], 'parpados.der':[0,0.9,0],
    'ceno.izq':[-20,20,0], 'ceno.der':[-20,20,0],
    'sonrisa.izq':[0,0.6,0], 'sonrisa.der':[0,0.6,0],
    'pupilas.izq':[0.5,1.3,1], 'pupilas.der':[0.5,1.3,1],
    'inclinacion':[-15,15,0], 'acercamiento':[0.9,1.08,1],
    'desplazamiento.x':[-3,3,0], 'desplazamiento.y':[-3,3,0],
    'duracion':[0.3,10,0]
  };
  var MOVS={ /* amplitud 0–1 se traduce a unidades de cada movimiento; ritmo en Hz */
    balanceo:'sube y baja suave', vaiven:'inclina la cabeza a un lado y a otro', saltitos:'tres saltitos y pausa',
    sacudir:'niega con la cabeza', asentir:'cabecea', latido:'las pupilas laten', temblor:'tiembla rápido',
    mirar_alrededor:'la mirada salta a puntos al azar', barrido:'la mirada barre de lado a lado', respirar:'se hincha y deshincha despacio'
  };
  function num(v,r,w,k){ var x=(typeof v==='number'&&isFinite(v))?v:r[2]; if(x<r[0]||x>r[1]){ w.push(k+' fuera de rango ('+r[0]+' a '+r[1]+'), recortado'); x=clamp(x,r[0],r[1]); } return x; }
  function pair(o,key,w){ /* acepta número (los dos ojos) u objeto {izq,der} */
    var v=o&&o[key], a=RANGOS[key+'.izq'];
    if(typeof v==='number') v={izq:v,der:v};
    v=v||{}; return [num(v.izq,a,w,key+'.izq'), num(v.der,RANGOS[key+'.der'],w,key+'.der')];
  }
  function normalizar(spec){
    var w=[], o=(spec&&typeof spec==='object')?spec:{};
    if(o.extiende && CUSTOM[o.extiende]){ var base=JSON.parse(JSON.stringify(CUSTOM[o.extiende].fuente)); for(var kk in o) if(kk!=='extiende') base[kk]=o[kk]; o=base; }
    var m=o.mirada||{};
    var n={
      id:String(o.id||'a_medida').replace(/[^a-z0-9_\-]/gi,'_').slice(0,40),
      nombre:String(o.nombre||o.id||'A medida').slice(0,40),
      descripcion:String(o.descripcion||'').slice(0,140),
      mirada:{x:num(m.x,RANGOS['mirada.x'],w,'mirada.x'), y:num(m.y,RANGOS['mirada.y'],w,'mirada.y'), sigue:!!m.sigue},
      parpados:pair(o,'parpados',w), ceno:pair(o,'ceno',w), sonrisa:pair(o,'sonrisa',w), pupilas:pair(o,'pupilas',w),
      inclinacion:num(o.inclinacion,RANGOS.inclinacion,w,'inclinacion'),
      acercamiento:num(o.acercamiento,RANGOS.acercamiento,w,'acercamiento'),
      desplazamiento:{x:num((o.desplazamiento||{}).x,RANGOS['desplazamiento.x'],w,'desplazamiento.x'), y:num((o.desplazamiento||{}).y,RANGOS['desplazamiento.y'],w,'desplazamiento.y')},
      parpadeo:({normal:1,lento:1,nunca:1}[o.parpadeo]?o.parpadeo:(o.parpadeo!==undefined?(w.push('parpadeo desconocido, uso normal'),'normal'):'normal')),
      movimientos:[], duracion:0, despues:'mirar'
    };
    (Array.isArray(o.movimientos)?o.movimientos:[]).slice(0,4).forEach(function(mv){
      if(!mv||!MOVS[mv.tipo]){ w.push('movimiento desconocido: '+(mv&&mv.tipo)); return; }
      n.movimientos.push({tipo:mv.tipo, amplitud:num(mv.amplitud===undefined?0.5:mv.amplitud,[0,1,0.5],w,mv.tipo+'.amplitud'), ritmo:num(mv.ritmo===undefined?1:mv.ritmo,[0.2,3,1],w,mv.tipo+'.ritmo')});
    });
    if(o.movimientos && o.movimientos.length>4) w.push('máximo 4 movimientos, el resto se ignora');
    if(o.duracion){ n.duracion=num(o.duracion,RANGOS.duracion,w,'duracion'); n.despues=(o.despues&&EMO.some(function(e){return e.k===o.despues;}))?o.despues:'mirar'; }
    /* cualquier otra clave (colores, dibujos, texto en los ojos…) no existe: solo ojos */
    for(var k in o) if(['id','nombre','descripcion','mirada','parpados','ceno','sonrisa','pupilas','inclinacion','acercamiento','desplazamiento','parpadeo','movimientos','duracion','despues','extiende'].indexOf(k)<0) w.push('clave ignorada: '+k);
    n.fuente=o; return {expresion:n, avisos:w};
  }
  var CUSTOM={};
  function definir(spec){ var r=normalizar(spec); CUSTOM[r.expresion.id]=r.expresion; return r; }
  function ampMov(mv,t){ return Math.sin(t*mv.ritmo*Math.PI*2); }

  /* ---------------------------------------------------------------- instancia */
  var ALL=[], POINTER=null, LASTP=0, STILL=false, BLINKS=true;
  try{ STILL=window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  /* Muelles con el tiempo real: FDT = fotogramas de 60 Hz transcurridos desde el último
     dibujo (0,5 a 120 Hz). Así el movimiento es igual de suave a 60, 120 o con un fotograma
     tardío, sin acelerarse ni dar saltos. Se integra en pasos de medio fotograma. */
  var FDT=1;
  function spring(cur, vel, target, k, d){
    var n=Math.max(1,Math.ceil(FDT/0.5)), h=FDT/n;
    for(var i=0;i<n;i++){ vel=vel*Math.pow(d,h)+(target-cur)*k*h; cur+=vel*h; }
    return [cur, vel];
  }
  function sp(o,key,vkey,target,k,d){ var r=spring(o[key],o[vkey],target,k,d); o[key]=r[0]; o[vkey]=r[1]; }

  function Eight(el, cfg){
    this.el=el; this.cfg=cfg; this.col=cfg.col||{fg:W,cut:COB};
    this.E=eight(true,46,this.col.fg);
    el.innerHTML='<svg viewBox="0 0 64 64" role="img" aria-label="8, el agente de Priv8"><g class="root"><g>'+this.E.svg+'</g><g class="dyn"></g></g><g class="fx"></g></svg>';
    this.root=el.querySelector('.root'); this.dyn=el.querySelector('.dyn'); this.fx=el.querySelector('.fx');
    var xs=this.E.eyes.map(function(e){return e.x;}); this.xmin=Math.min.apply(null,xs);
    this.s={px:0,pvx:0,py:0,pvy:0,tx:0,ty:0,hx:0,hvx:0,hy:0,hvy:0,tilt:0,tv:0,l0:0,lv0:0,l1:0,lv1:0,a0:0,av0:0,a1:0,av1:0,low0:0,lowv0:0,low1:0,lowv1:0,
      z0:1,zv0:0,z1:1,zv1:0,sx:1,svx:0,sy:1,svy:0,sh:1,shv:0,P:0,Pv:0,ox:0,ovx:0,oy:0,ovy:0,cl:0,clv:0};
    this.blinkQ=[]; this.nextBlink=0; this.nextLook=0; this.visible=true; this.spin=[0,0];
    this.setMode(cfg.mode||'mirar');
    ALL.push(this);
    var self=this;
    if('IntersectionObserver' in window){ new IntersectionObserver(function(en){ self.visible=en[0].isIntersecting; }).observe(el); }
  }
  /* Parpadeo real: cierra rápido (70 ms, acelerando), se queda cerrado un instante
     (30 ms) y abre más despacio (160 ms, frenando). len escala el conjunto (120 = normal). */
  Eight.prototype.blink=function(now,len){ this.blinkQ=[[now,(len||120)/120]]; };
  Eight.prototype.blinkDouble=function(now){ this.blinkQ=[[now,1],[now+260,1]]; };
  function blinkAt(q,now){ var b=0; q.forEach(function(w){ var k=w[1], e=(now-w[0])/k, v=0;
      if(e<0) v=0; else if(e<70) v=Math.pow(e/70,2); else if(e<100) v=1; else if(e<260) v=1-easeOut((e-100)/160); else v=0;
      if(v>b) b=v; }); return b; }
  Eight.prototype.setMode=function(m){
    var s=this.s, prev=this.mode; this.mode=m; this.t0=performance.now(); this.kicked=0;
    var kick={listo:[-0.2,0.26],enfado:[0.1,-0.12],sorpresa:[-0.1,0.2],miedo:[0.06,-0.1],nove:[0.08,-0.1]}[m];
    if(kick){ s.svx=kick[0]; s.svy=kick[1]; }
    if(m==='nove'){ s.P=0; s.Pv=0; }
    if(m==='saludar'){ s.cl=0.9; s.clv=0; }
    if(prev==='cargando' && m!=='cargando'){ s.svx=-0.1; s.svy=0.14; }
    /* transición: pequeña anticipación y un parpadeo, como cuando alguien cambia de atención */
    if(prev && prev!==m && !kick){ s.svx+=0.03; s.svy-=0.05; }
    if(prev && prev!==m && ['nove','nuncasale','risa','dormir','agradecer','saludar'].indexOf(m)<0) this.blinkSoon=true;
    this.idle=null; this.nextIdle=performance.now()+5000+Math.random()*5000;
  };
  Eight.prototype.endIdle=function(now){ this.idle=null; this.nextIdle=now+7000+Math.random()*7000; };
  Eight.prototype.tick=function(now){
    FDT=this.lastNow?clamp((now-this.lastNow)/16.667,0.1,4):1; this.lastNow=now;
    var s=this.s, m=this.mode, t=STILL?0.62:now/1000, e1=STILL?2.5:(now-this.t0)/1000, E=this.E, xmin=this.xmin, left0=(E.eyes[0].x===xmin), col=this.col;
    var lid=[0,0], ang=[0,0], low=[0,0], size=[1,1], tilt=0, ox=0, oy=0, bob=Math.sin(t*1.6)*0.35, blinks=true, k=0.2, d=0.62, sc=1, noPup=false, pre='', post='', fx='';
    var hide=(m==='nove'), clT=0;
    /* mirada que sigue al puntero */
    var follow=(m==='mirar'||m==='ve'||m==='alegria');
    if(follow && POINTER && now-LASTP<3500){
      var r=this.el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, dx=POINTER.x-cx, dy=POINTER.y-cy, dd=Math.sqrt(dx*dx+dy*dy)||1, kk=Math.min(1,dd/(Math.max(r.width,120)*0.75));
      s.tx=dx/dd*kk; s.ty=dy/dd*kk;
    } else if(follow||m==='hablar'){
      if(now>this.nextLook){ var g=[[0.55,-0.45],[-0.6,-0.35],[0,0],[0.75,0.05],[-0.45,0.25],[0.15,-0.7],[0,0]][Math.floor(Math.random()*7)], gk=(m==='hablar'?0.4:1); s.tx=g[0]*gk; s.ty=g[1]*gk; this.nextLook=now+800+Math.random()*1900; }
    }
    switch(m){
      /* ---------------- emociones */
      case 'alegria': { low=[0.5,0.5]; lid=[0.04,0.04]; bob=Math.sin(t*2.2)*0.9; tilt=Math.sin(t*1.1)*4; break; }
      case 'risa': {
        /* Carcajada solo con los ojos: ojos sonrientes (párpado de abajo subido, el de
           arriba libre, pupilas al frente) y la risa a golpes: tres saltitos con
           estiramiento y vaivén, y una pausa para coger aire. Sin párpado de arriba ni
           mirada hacia arriba, que se leen como dolor. */
        blinks=false; bob=0; low=[0.52,0.52]; lid=[0,0]; s.tx=0; s.ty=-0.08; size=[1.05,1.05];
        var cyc=1.7, lp=(e1>0.15?(e1-0.15)%cyc:0), beat=lp<0.9?Math.floor(lp/0.3):-1, bp=lp<0.9?(lp%0.3)/0.3:0;
        if(e1<0.15){ sc=0.95; }
        if(beat>=0){ var hb=Math.sin(bp*Math.PI); oy=-1-hb*(2-beat*0.4); tilt=(beat%2?4:-4)*hb-3; if(bp<0.1 && this.lastBeat!==beat){ s.svx-=0.05; s.svy+=0.09; this.lastBeat=beat; } }
        else { this.lastBeat=-1; oy=-0.5; tilt=-2; }
        break; }
      case 'agradecer': {
        /* parpadeo lento de confianza: cierra despacio, mantiene, abre con sonrisa */
        blinks=false; s.tx=0; s.ty=0.05; var ap=t%2.8; tilt=5;
        clT=(ap<1.1)?0.9:0; /* cierra en almendra como un parpadeo lento y se queda un instante */
        low=[0.4,0.4]; k=0.1; d=0.75; break; }
      case 'disculpa': {
        /* mira abajo y se encoge; a los 1,2 s vuelve a mirarte con media sonrisa */
        if(e1<1.2){ s.tx=-0.35; s.ty=0.75; lid=[0.3,0.3]; ang=[-9,-9]; sc=0.94; tilt=-6; oy=1; }
        else { s.tx=0; s.ty=0; low=[0.25,0.25]; lid=[0.08,0.08]; ang=[-5,-5]; tilt=4; }
        k=0.1; d=0.75; break; }
      case 'sorpresa': { size=[0.6,0.6]; s.tx=0; s.ty=-0.1; if(e1<0.35) oy=-2.5*Math.sin(e1/0.35*Math.PI); break; }
      case 'tristeza': { s.tx=0.15; s.ty=0.65; lid=[0.34,0.34]; ang=[-14,-14]; size=[0.9,0.9]; tilt=-3; bob=Math.sin(t*0.9)*0.25; k=0.08; d=0.8; sc=0.96;
        var sg=t%4.5; if(sg<1.2){ var si=Math.sin(sg/1.2*Math.PI); oy=si*1.3; sc=0.96-0.03*si; } break; }
      case 'enfado': { lid=[0.3,0.3]; ang=[17,17]; size=[0.74,0.74]; s.tx=0; s.ty=0.05; sc=1.03; bob=0; blinks=false;
        var hf=t%3.2; if(hf<0.45){ ox=Math.sin(hf*70)*0.9*(1-hf/0.45); } break; }
      case 'miedo': { size=[0.5,0.5]; sc=0.93; ox=Math.sin(t*45)*0.35; oy=1; blinks=false; bob=0;
        if(now>this.nextLook){ s.tx=Math.random()<0.5?-0.7:0.7; s.ty=-0.15; this.nextLook=now+500+Math.random()*500; } k=0.35; d=0.5; break; }
      case 'curiosidad': {
        /* un ojo más abierto que el otro, cabeza ladeada y se acerca un poco; sigue el puntero */
        size=left0?[1.16,0.92]:[0.92,1.16]; lid=left0?[0,0.14]:[0.14,0]; tilt=-10+Math.sin(t*1.2)*2; sc=1.035; oy=-0.4;
        if(!(POINTER && now-LASTP<3500)){ s.tx=0.35+Math.sin(t*0.9)*0.15; s.ty=-0.25; }
        else { var r2=this.el.getBoundingClientRect(), dx2=POINTER.x-(r2.left+r2.width/2), dy2=POINTER.y-(r2.top+r2.height/2), dd2=Math.sqrt(dx2*dx2+dy2*dy2)||1, k3=Math.min(1,dd2/(Math.max(r2.width,120)*0.75)); s.tx=dx2/dd2*k3; s.ty=dy2/dd2*k3; }
        break; }
      case 'duda': { s.tx=0.45+Math.sin(t*1.1)*0.12; s.ty=-0.55; lid=left0?[0.42,0]:[0,0.42]; ang=left0?[-6,0]:[0,-6]; tilt=9+Math.sin(t*1.4)*2; size=[0.95,1.04]; break; }
      /* ---------------- flujo */
      case 'mirar': {
        /* pequeños gestos de reposo para que no se repita: mirar alrededor, bostezo, saltito */
        if(this.cfg.idle!==false){
          if(!this.idle && now>this.nextIdle){ var acts=['look','yawn','hop','look']; this.idle={k:acts[Math.floor(Math.random()*acts.length)],t0:now}; }
          if(this.idle){ var ie=(now-this.idle.t0)/1000;
            if(this.idle.k==='look'){ if(ie<0.7){ s.tx=-0.9; s.ty=-0.1; tilt=-5; } else if(ie<1.4){ s.tx=0.9; s.ty=-0.1; tilt=5; } else this.endIdle(now); }
            else if(this.idle.k==='yawn'){ if(ie<1.5){ var yy=Math.sin(ie/1.5*Math.PI); lid=[0.75*yy,0.75*yy]; s.svy+=(yy*0.006)*FDT; s.ty=-0.3*yy; blinks=false; } else this.endIdle(now); }
            else if(this.idle.k==='hop'){ if(ie<0.5){ oy=-2.2*Math.sin(ie/0.5*Math.PI); if(!this.idle.kick){ s.svx=-0.06; s.svy=0.1; this.idle.kick=1; } } else this.endIdle(now); }
          }
        }
        break; }
      case 'saludar': { blinks=false; s.tx=0; s.ty=-0.12;
        if(e1<0.3){ clT=0.9; sc=0.92; }
        if(e1>=0.3 && e1<0.8){ oy=-3.2*Math.sin((e1-0.3)/0.5*Math.PI); if(!this.kicked){ s.svx=-0.12; s.svy=0.2; this.kicked=1; } }
        if(e1>=0.45 && e1<2.2) low=[0.45,0.45];
        tilt=(e1>0.4 && e1<2.2)?7:0; break; }
      case 'atencion': {
        /* dos saltitos con estiramiento y te mira de frente; pausa */
        s.tx=0; s.ty=0.05; size=[1.12,1.12]; var at=t%2.2; blinks=at>1;
        if(at<0.9){ var hp=at<0.45?at/0.45:(at-0.45)/0.45; oy=-2.6*Math.sin(hp*Math.PI); if(hp<0.08){ s.svx=-0.05; s.svy=0.09; } }
        break; }
      case 'permiso': {
        /* cabeza ladeada, mirada hacia ti desde abajo, pupilas grandes, cejas de súplica suave */
        s.tx=0.1; s.ty=-0.5; size=[1.18,1.18]; tilt=11; ang=[-8,-8]; lid=[0.06,0.06]; low=[0.12,0.12]; oy=0.8; bob=Math.sin(t*1.4)*0.4; k=0.12; d=0.72; break; }
      case 'apartar': {
        /* gira la cabeza y aparta la vista hacia arriba y a un lado mientras escribes */
        s.tx=-0.95; s.ty=-0.35; tilt=-9; ox=-3; lid=[0.22,0.22]; sc=0.97; k=0.12; d=0.72; break; }
      case 'rechazar': {
        /* un "no" lento y tranquilo: ojos sonrientes casi cerrados y cabeza que niega despacio */
        lid=[0.3,0.3]; ang=[-4,-4]; low=[0.12,0.12]; s.tx=-ox*0.1; s.ty=0.1; blinks=false;
        ox=e1<1.6?Math.sin(e1/1.6*Math.PI*2)*2.4*(1-e1/1.6*0.4):0; tilt=ox*1.2; break; }
      case 'interrumpido': {
        /* se calla de golpe: respingo hacia atrás con los ojos algo más abiertos y, a los
           0,6 s, se queda atento como al escuchar */
        if(e1<0.6){ size=[1.12,1.12]; s.tx=0; s.ty=0; sc=0.95; oy=0.8; if(!this.kicked){ s.svx=0.07; s.svy=-0.1; this.kicked=1; } }
        else { s.tx=0; s.ty=-0.08; tilt=5; size=[1.05,1.05]; }
        bob=0; break; }
      case 'escuchar': { s.tx=Math.sin(t*0.7)*0.12; s.ty=-0.08; var amp=Math.abs(Math.sin(t*7.3))*Math.pow(Math.sin(t*1.9),2); size=[1+0.16*amp,1+0.16*amp]; tilt=5; bob=0; s.svy+=(amp*0.004)*FDT; break; }
      case 'hablar': { var syl=Math.max(0,Math.sin(t*10.5))*(0.6+0.4*Math.sin(t*2.3)); s.svy+=(syl*0.012)*FDT; s.svx-=(syl*0.006)*FDT; lid=[0.1,0.1]; low=[0.14,0.14]; break; }
      case 'pensar': { if(now>this.nextLook){ var q=[[-0.8,-0.65],[0.8,-0.6],[0.45,-0.95],[-0.35,-0.95],[0.9,-0.25],[-0.9,-0.3]][Math.floor(Math.random()*6)]; s.tx=q[0]; s.ty=q[1]; this.nextLook=now+220+Math.random()*380; this.tiltT=q[0]*5; } lid=[0.22,0.22]; tilt=this.tiltT||0; break; }
      case 'leer': { var u=(t*0.55)%1, line=Math.floor(u*3), fr=(u*3)%1; s.tx=fr<0.85?-0.75+1.5*(fr/0.85):0.75-1.5*((fr-0.85)/0.15); s.ty=-0.5+line*0.5; k=0.32; d=0.55; lid=[0.14,0.14]; break; }
      case 'cargando': {
        /* Las mismas pupilas de siempre recorren el borde del ojo, las dos a la vez,
           acelerando y frenando en cada vuelta. La cabeza las sigue con retraso. */
        blinks=false; bob=0; var ph=(t/1.1)%1, ez=ph-Math.sin(ph*Math.PI*2)/(Math.PI*2)*0.35, an=-Math.PI/2+ez*Math.PI*2;
        this.spin=[Math.cos(an)*0.8, Math.sin(an)*0.8];
        break; }
      case 'esperar': { /* te mira a ti, atento y quieto; parpadeo lento de vez en cuando */ s.tx=0; s.ty=0.12; tilt=Math.sin(t*0.8)*2.5; sc=1.02; if(now>this.nextBlink){ this.blink(now,380); this.nextBlink=now+3000+Math.random()*1200; } blinks=false; break; }
      case 'listo': { s.tx=0; s.ty=-0.15; low=[0.55,0.55]; if(e1>1.3) low=[0,0]; break; }
      case 'asentir': { oy=e1<1.1?Math.sin(e1*Math.PI*3.6)*3.2*(1-e1/1.1):0; low=[0.3,0.3]; s.tx=0; s.ty=0.1; break; }
      case 'negar': { ox=e1<1.2?Math.sin(e1*Math.PI*4.4)*4*(1-e1/1.2):0; lid=[0.16,0.16]; ang=[-5,-5]; s.tx=-ox*0.12; s.ty=0.2; break; }
      case 'sinconexion': {
        /* busca la conexión arriba a un lado y a otro, con los párpados algo bajos; cada
           2,4 s lo vuelve a intentar con un saltito y vuelve a quedarse algo decaído */
        var sc2=t%2.4; lid=[0.26,0.26]; ang=[-5,-5]; k=0.08; d=0.8;
        if(sc2<1.8){ s.tx=Math.sin(sc2/1.8*Math.PI*2)*0.75; s.ty=-0.6; tilt=s.tx*5; }
        else { var hp2=(sc2-1.8)/0.6; oy=-2*Math.sin(hp2*Math.PI); s.tx=0; s.ty=-0.2; lid=[0.1,0.1]; ang=[0,0]; if(hp2<0.08 && !this.tried){ s.svx=-0.05; s.svy=0.09; this.tried=1; } }
        if(sc2<0.1) this.tried=0;
        break; }
      case 'dormir': { s.tx=0; s.ty=0.3; var br=0.86+0.04*Math.sin(t*1.3); lid=[br,br]; blinks=false; bob=Math.sin(t*1.3)*0.6; sc=1+0.012*Math.sin(t*1.3);
        for(var z=0;z<3;z++){ var pz=((t/2.7)+z/3)%1, zs=4+pz*5, zx=32+E.halfW-4+pz*7, zy=32-E.halfH+1-pz*12, op=Math.min(1,pz*4)*(1-pz);
          fx+='<text transform="translate('+f(zx)+' '+f(zy)+') scale('+(zs/6).toFixed(4)+')" font-family=\''+FONT+'\' font-weight="700" font-size="6" text-rendering="geometricPrecision" fill="'+col.fg+'" opacity="'+f(op)+'">z</text>'; } break; }
      case 'nove': { blinks=false; s.tx=0; s.ty=0; break; }
      case 'nuncasale': {
        /* nunca sale: el mismo cierre en almendra del parpadeo, más lento, que se queda en
           la línea casi cerrada. Quieto, sin respirar. */
        blinks=false; bob=0; s.tx=0; s.ty=0.15; break; }
      default: {
        var X=CUSTOM[m]; if(!X) break;
        /* postura */
        lid=X.parpados.slice(); ang=X.ceno.slice(); low=X.sonrisa.slice(); size=X.pupilas.slice();
        tilt=X.inclinacion; sc=X.acercamiento; ox=X.desplazamiento.x; oy=X.desplazamiento.y;
        if(!(X.mirada.sigue && POINTER && now-LASTP<3500)){ s.tx=X.mirada.x; s.ty=X.mirada.y; }
        else { var r3=this.el.getBoundingClientRect(), dx3=POINTER.x-(r3.left+r3.width/2), dy3=POINTER.y-(r3.top+r3.height/2), dd3=Math.sqrt(dx3*dx3+dy3*dy3)||1, k4=Math.min(1,dd3/(Math.max(r3.width,120)*0.75)); s.tx=dx3/dd3*k4; s.ty=dy3/dd3*k4; }
        /* movimientos */
        var self2=this;
        X.movimientos.forEach(function(mv){ var a=mv.amplitud, w=ampMov(mv,t);
          if(mv.tipo==='balanceo'){ bob=0; oy+=w*2*a; }
          else if(mv.tipo==='vaiven') tilt+=w*8*a;
          else if(mv.tipo==='saltitos'){ var per=1/mv.ritmo, ph=t%per, hp=ph/(per*0.5); if(hp<1){ var b3=(hp*3)%1; oy-=Math.sin(b3*Math.PI)*3*a; } }
          else if(mv.tipo==='sacudir') ox+=w*4*a;
          else if(mv.tipo==='asentir') oy+=Math.max(0,w)*3*a;
          else if(mv.tipo==='latido'){ var pl=1+0.2*a*Math.abs(w); size=[size[0]*pl,size[1]*pl]; }
          else if(mv.tipo==='temblor') ox+=Math.sin(t*45)*0.6*a;
          else if(mv.tipo==='mirar_alrededor'){ if(now>self2.nextLook){ s.tx=(Math.random()*2-1)*a; s.ty=(Math.random()*2-1)*a*0.8; self2.nextLook=now+1000/mv.ritmo; } }
          else if(mv.tipo==='barrido') s.tx=w*a;
          else if(mv.tipo==='respirar') sc*=1+0.025*a*w;
        });
        if(X.parpadeo==='nunca') blinks=false;
        else if(X.parpadeo==='lento'){ if(now>this.nextBlink){ this.blink(now,380); this.nextBlink=now+3000+Math.random()*1500; } blinks=false; }
        if(X.duracion && e1>X.duracion && !this.cfg.loop && this.cfg.onEnd){ this.cfg.onEnd(X.despues); }
        break; }

    }
    if(this.cfg.loop && emo(m).once && e1>Math.max(2.8,(CUSTOM[m]&&CUSTOM[m].duracion)||0)+0.3) this.setMode(m);
    /* muelles */
    sp(s,'px','pvx',s.tx,k,d); sp(s,'py','pvy',s.ty,k,d);
    if(m==='cargando'){ var bl0=Math.min(1,e1/0.25); s.px=s.px+(this.spin[0]-s.px)*bl0; s.py=s.py+(this.spin[1]-s.py)*bl0; s.pvx=0; s.pvy=0; }
    var hk=(m==='cargando')?0.4:1; sp(s,'hx','hvx',s.px*1.6*hk,0.06,0.78); sp(s,'hy','hvy',s.py*1.2*hk,0.06,0.78);
    sp(s,'tilt','tv',tilt+s.px*2,0.08,0.75);
    if(STILL||!BLINKS){ blinks=false; this.blinkSoon=false; }
    if(blinks && this.blinkSoon){ this.blink(now); this.blinkSoon=false; this.nextBlink=now+1800+Math.random()*2000; }
    if(blinks && now>this.nextBlink){ if(Math.random()<0.28) this.blinkDouble(now); else this.blink(now); this.nextBlink=now+(m==='pensar'?1100+Math.random()*1400:2200+Math.random()*3200); }
    for(var i2=0;i2<2;i2++){
      sp(s,'l'+i2,'lv'+i2,hide?0:lid[i2],0.3,0.45);
      sp(s,'a'+i2,'av'+i2,hide?0:ang[i2],0.2,0.6);
      sp(s,'low'+i2,'lowv'+i2,hide?0:low[i2],0.25,0.55); 
      sp(s,'z'+i2,'zv'+i2,size[i2],0.18,0.6);
    }
    s.b=hide?0:blinkAt(this.blinkQ,now);
    sp(s,'cl','clv',(m==='nuncasale')?0.9:clT,(m==='agradecer')?0.12:0.07,0.8); if(s.cl<0) s.cl=0; if(s.cl>0.92){ s.cl=0.92; if(s.clv>0) s.clv=0; }
    var bAll=Math.max(s.b,s.cl);
    sp(s,'sh','shv',sc,0.12,0.7);
    sp(s,'sx','svx',1,0.18,0.72); sp(s,'sy','svy',1,0.18,0.72);
    sp(s,'P','Pv',hide?1:0,0.07,0.78); if(s.P<0) s.P=0;
    sp(s,'ox','ovx',ox,0.35,0.5); sp(s,'oy','ovy',oy,0.35,0.5);
    if(!this.visible) return;
    /* pintar */
    var dyn=pre, P=s.P;
    this.root.setAttribute('transform','translate('+f(32+s.hx+s.ox)+' '+f(32+s.hy+s.oy+bob)+') rotate('+f(s.tilt)+') scale('+f(s.sx*s.sh)+' '+f(s.sy*s.sh*(1-0.025*s.b))+') translate(-32 -32)');
    if(!noPup) E.eyes.forEach(function(e,i){ var pr=pupilR(e)*s['z'+i]*(1-Math.min(1,P/0.3))*(1-clamp(s.cl/0.75,0,1)); if(pr>0.05) dyn+=pupilAt(e,s.px,Math.min(1,s.py+0.25*bAll),pr,col.fg); });
    E.eyes.forEach(function(e,i){ dyn+=lidA(e,col.fg,s['l'+i],s['a'+i],e.x===xmin)+lowLid(e,col.fg,s['low'+i]); });
    /* Parpadeo: la abertura del ojo es una almendra entre dos arcos que se juntan por las
       esquinas y se cierran en una línea algo por debajo del centro. El de arriba recorre
       más que el de abajo. Parte de la pose: solo se ve cuando pasa por debajo del párpado
       que ya haya. Todo lo que queda fuera de la almendra se rellena con la tinta del 8. */
    if(bAll>0.001) E.eyes.forEach(function(e){
      var bt=bAll, W=e.rx*1.7, yc=e.y+e.ry*0.18, hu=e.ry*1.45*(1-bt), hl=e.ry*1.05*(1-bt), c=eyeClip(e,1.8);
      var R='M'+f(e.x-e.rx-3)+' '+f(e.y-e.ry-3)+'h'+f(2*e.rx+6)+'v'+f(2*e.ry+6)+'h'+f(-2*e.rx-6)+'Z';
      var A=' M'+f(e.x-W)+' '+f(yc)+' Q'+f(e.x)+' '+f(yc-2*hu)+' '+f(e.x+W)+' '+f(yc)+' Q'+f(e.x)+' '+f(yc+2*hl)+' '+f(e.x-W)+' '+f(yc)+' Z';
      dyn+=c.def+'<g clip-path="url(#'+c.id+')"><path d="'+R+A+'" fill-rule="evenodd" fill="'+col.fg+'"/></g>';
    });
    dyn+=post;
    if(P>0.01) dyn+=asterisk(E,P,col);
    this.dyn.innerHTML=dyn;
    this.fx.innerHTML=fx?'<g transform="translate('+f(s.hx+s.ox)+' '+f(s.hy+s.oy+bob)+')">'+fx+'</g>':'';
  };
  function loop(now){ for(var i=0;i<ALL.length;i++){ try{ ALL[i].tick(now); }catch(e){ console.error(e); } } requestAnimationFrame(loop); }
  var started=false;
  function start(){
    if(started) return; started=true;
    M=measure8();
    window.addEventListener('pointermove',function(ev){ POINTER={x:ev.clientX,y:ev.clientY}; LASTP=performance.now(); },{passive:true});
    requestAnimationFrame(loop);
  }
  function mount(el,cfg){ start(); var e=new Eight(el,cfg||{}); if(STILL){ e.cfg.loop=false; e.cfg.idle=false; } return e; }
  function unmount(e){ var i=ALL.indexOf(e); if(i>=0) ALL.splice(i,1); }
  return {mount:mount, unmount:unmount, definir:definir, still:STILL};
}
