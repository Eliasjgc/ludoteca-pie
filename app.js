'use strict';
const ui=id=>document.getElementById(id);
const config=window.LUDOTECA_CONFIG || {};
const {codigoValido,extraerCodigo,fichaValida,filtrarCatalogo}=LudotecaTools;
const endpointValido=u=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u || '');
let idActual='',generacion=0,instalacion,scanner,ultimoRechazado='',catalogo=[],catalogoCargado=false,cargaCatalogo=0,categoriaPendiente='',cargandoCatalogo=false;
const {catalogoValido,leerCatalogo,guardarCatalogo}=CatalogoDatos;
const claveCatalogo='ludoteca-catalogo-v271:'+config.publicApiUrl;
let almacenamiento;try{almacenamiento=window.localStorage}catch(error){}
const fotosCatalogo=new CatalogPhotoLoader({almacen:new PhotoStore({api:config.publicApiUrl}),cargar:id=>jsonp({api:'foto',id,v:'27'})});
let inicioCatalogo;
let filtroPendiente,contextoCatalogo;
let catalogoSolicitado=false;
const fichasEnCurso=new Map();
function estado(texto){ui('estado').textContent=texto}function mostrarReintento(valor){ui('reintentar-conexion').hidden=!valor}
function limpiarVista(){fotosCatalogo.pausar();ui('ficha').hidden=true;ui('foto').removeAttribute('src');delete ui('foto').dataset.referencia;delete ui('foto').dataset.version;ui('catalogo').hidden=true}
function guardarUrl(params){const u=new URL(location.href);u.search=new URLSearchParams(params).toString();history.pushState(null,'',u)}
function jsonp(params){
  return new Promise((resolve,reject)=>{
    if(!endpointValido(config.publicApiUrl))return reject(Error('La consulta pública no está configurada.'));
    const name='ludoteca_'+Array.from(crypto.getRandomValues(new Uint32Array(3)),n=>n.toString(16)).join('_');
    const script=document.createElement('script');let terminado=false;
    function finish(error,data){
      if(terminado)return;terminado=true;clearTimeout(timer);script.remove();
      window[name]=()=>{};setTimeout(()=>{delete window[name]},60000);
      error?reject(error):resolve(data);
    }
    window[name]=data=>data&&typeof data.error==='string'?finish(Error(data.error)):finish(null,data);
    const u=new URL(config.publicApiUrl);u.search=new URLSearchParams({...params,callback:name,_:String(Date.now())}).toString();
    script.src=u.href;script.referrerPolicy='no-referrer';
    script.onerror=()=>finish(Error('No se pudo consultar. Comprueba la conexión y vuelve a intentarlo.'));
    const timer=setTimeout(()=>finish(Error('La consulta tardó demasiado. Vuelve a intentarlo.')),25000);
    document.head.appendChild(script);
  });
}
function mostrarFicha(g){
  ui('nombre').textContent=g.nombre;ui('categoria').textContent=g.categoria || 'Sin categoría';
  ui('descripcion').textContent=g.descripcion || 'Descripción no registrada.';
  ui('total').textContent=g.cantidadTotal;ui('disponibles').textContent=g.disponibilidad;
  ui('prestados').textContent=Number.isInteger(g.prestados)?g.prestados:'—';
  ui('nota-prestados').textContent=Number.isInteger(g.prestados)?(g.prestados===0?'No hay ejemplares prestados.':'Los préstamos incluyen la custodia prolongada.')+((g.cantidadTotal-g.disponibilidad-g.prestados)>0?' Hay otros ejemplares no disponibles por su estado.':''):'Actualiza la conexión pública para consultar cuántos están prestados.';
  const mismaFoto38=ui('foto').dataset.referencia===g.referencia&&ui('foto').dataset.version===g.versionFoto;if(!mismaFoto38){ui('foto').hidden=true;ui('sin-foto').hidden=false;ui('sin-foto').textContent='Cargando fotografía…';ui('foto').dataset.referencia=g.referencia;ui('foto').dataset.version=g.versionFoto;}
  ui('foto').alt='Fotografía de '+g.nombre;
  ui('ficha').hidden=false;
  if(!mismaFoto38)fotosCatalogo.observar(ui('ficha'),g.referencia,ui('foto'),ui('sin-foto'),g.versionFoto);
  ui('ficha').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function anticiparFicha(id){
  const g=catalogo.find(g=>g.referencia===id.split('-')[0]);if(!g)return;
  ui('nombre').textContent=g.nombre;ui('categoria').textContent=g.categoria||'Sin categoría';
  ui('descripcion').textContent=typeof g.descripcion==='string'?(g.descripcion||'Descripción no registrada.'):'Consultando descripción…';
  for(const campo of ['total','disponibles','prestados'])ui(campo).textContent='…';
  ui('nota-prestados').textContent='Consultando disponibilidad actual…';
  ui('foto').alt='Fotografía de '+g.nombre;ui('foto').hidden=true;
  ui('sin-foto').hidden=false;ui('sin-foto').textContent='Cargando fotografía…';ui('ficha').hidden=false;
  fotosCatalogo.observar(ui('ficha'),g.referencia,ui('foto'),ui('sin-foto'),g.versionFoto);
  ui('ficha').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function solicitarFicha(id){
  if(fichasEnCurso.has(id))return fichasEnCurso.get(id);
  const p=jsonp({api:'ficha',id,v:'27'}).finally(()=>fichasEnCurso.delete(id));fichasEnCurso.set(id,p);return p;
}

function pintarCatalogo(){
  if(idActual || !catalogoCargado)return;
  const q=ui('consulta').value.trim(),categoria=ui('categoria-filtro').value;
  const arr=filtrarCatalogo(catalogo,q,categoria).sort((a,b)=>Number(a.disponibilidad===0)-Number(b.disponibilidad===0));
  fotosCatalogo.pausar();
  ui('resultados').replaceChildren(...arr.map(g=>{
    const boton=document.createElement('button');boton.type='button';boton.className='game-card';boton.setAttribute('aria-label','Ver ficha de '+g.nombre);
    const media=document.createElement('span');media.className='game-card-media';
    const imagen=document.createElement('img');imagen.alt='';imagen.hidden=true;imagen.decoding='async';imagen.loading='lazy';imagen.width=480;imagen.height=400;
    const nota=document.createElement('span');nota.className='game-card-placeholder';nota.textContent='Cargando fotografía…';media.append(imagen,nota);
    const texto=document.createElement('span');texto.className='game-card-info';
    const nombre=document.createElement('span');nombre.className='game-card-name';nombre.textContent=g.nombre;
    const categoria=document.createElement('span');categoria.className='game-card-category';categoria.textContent=g.categoria||'Sin categoría';texto.append(nombre,categoria);if(Number.isInteger(g.disponibilidad)){const disp=document.createElement('span');disp.className=g.disponibilidad===0?'disponibilidad38 sin-disponibilidad38':'disponibilidad38';disp.textContent=g.disponibilidad===0?'Sin ejemplares disponibles por el momento':g.disponibilidad+' disponible'+(g.disponibilidad===1?'':'s');texto.append(disp);}
    boton.append(media,texto);boton.addEventListener('click',()=>{contextoCatalogo={q:ui('consulta').value,cat:ui('categoria-filtro').value,y:window.scrollY};guardarUrl({id:g.referencia});consultar(g.referencia)});
    fotosCatalogo.observar(boton,g.referencia,imagen,nota,g.versionFoto);return boton;
  }));
  ui('catalogo').hidden=false;ui('limpiar-filtros').hidden=!q&&!categoria;
  estado(arr.length===0?'No se encontraron juegos. Prueba otro nombre o categoría.':arr.length+' juego'+(arr.length===1?'':'s')+(q||categoria?(arr.length===1?' que coincide con tu búsqueda.':' que coinciden con tu búsqueda.'):' en el catálogo.'));
}
function aplicarCatalogo(juegos){
  const cambio=JSON.stringify(catalogo)!==JSON.stringify(juegos);
  catalogo=juegos;catalogoCargado=true;
  const actual=categoriaPendiente||ui('categoria-filtro').value;
  const categorias=[...new Set(catalogo.map(g=>g.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const todas=document.createElement('option');todas.value='';todas.textContent='Todas las categorías';
  ui('categoria-filtro').replaceChildren(todas,...categorias.map(c=>{const op=document.createElement('option');op.value=c;op.textContent=c;return op}));
  ui('categoria-filtro').value=categorias.includes(actual)?actual:'';categoriaPendiente='';
  if(cambio||!ui('resultados').children.length)pintarCatalogo();
}
function prepararCatalogo(){
  if(inicioCatalogo)return inicioCatalogo;
  const guardado=leerCatalogo(almacenamiento,claveCatalogo);if(guardado)fechaCatalogo38=guardado.fecha;
  inicioCatalogo=(async()=>{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
    try{
      const r=await fetch('./catalogo-inicial.json?v=2.9.0',{signal:abort.signal});if(!r.ok)throw Error();const inicial=await r.json();
      if(!catalogoValido(inicial)||!inicial.fotos)throw Error();
      fotosCatalogo.miniaturas=inicial.fotos;
      aplicarCatalogo(guardado&&guardado.fecha>=Date.parse(inicial.generado)?guardado.juegos:inicial.juegos);
    }catch(error){if(guardado)aplicarCatalogo(guardado.juegos)}
    finally{clearTimeout(timer)}
  })();
  return inicioCatalogo;
}

function mostrarCatalogo(){
  clearTimeout(filtroPendiente);
  ++generacion;idActual='';mostrarReintento(false);limpiarVista();ui('catalogo').hidden=false;
  if(catalogoCargado)pintarCatalogo();
  if(!catalogoSolicitado)cargarCatalogo();
}
function leerUbicacion(){
  const u=new URL(location.href),id=u.searchParams.get('id');
  if(id){ui('consulta').value=id;consultar(id.toUpperCase())}
  else{ui('consulta').value=u.searchParams.get('q')||'';categoriaPendiente=u.searchParams.get('cat')||'';ui('categoria-filtro').value=categoriaPendiente;mostrarCatalogo()}
}
function parametrosFiltro(){const params={};if(ui('consulta').value.trim())params.q=ui('consulta').value.trim();if(ui('categoria-filtro').value)params.cat=ui('categoria-filtro').value;return params}
ui('buscar').addEventListener('submit',event=>{
  event.preventDefault();const raw=ui('consulta').value.trim();const id=extraerCodigo(raw,location.href,config.publicApiUrl);
  if(id){guardarUrl({id});consultar(id)}else{guardarUrl(parametrosFiltro());mostrarCatalogo()}
});
ui('consulta').addEventListener('input',()=>{clearTimeout(filtroPendiente);filtroPendiente=setTimeout(()=>{mostrarCatalogo();const u=new URL(location.href);u.search=new URLSearchParams(parametrosFiltro()).toString();history.replaceState(null,'',u)},120)});
ui('categoria-filtro').addEventListener('change',()=>{guardarUrl(parametrosFiltro());mostrarCatalogo()});
ui('limpiar-filtros').addEventListener('click',()=>{ui('consulta').value='';ui('categoria-filtro').value='';categoriaPendiente='';guardarUrl({});mostrarCatalogo()});
ui('refrescar-catalogo').addEventListener('click',cargarCatalogo);ui('reintentar-conexion').addEventListener('click',()=>{if(idActual)consultar(idActual,true);else cargarCatalogo()});
function volverAlCatalogo(restablecer=false){
  clearTimeout(filtroPendiente);const anterior=!restablecer&&contextoCatalogo;
  if(restablecer)contextoCatalogo=null;
  ui('consulta').value=anterior?anterior.q:'';ui('categoria-filtro').value=anterior?anterior.cat:'';categoriaPendiente='';
  guardarUrl(parametrosFiltro());mostrarCatalogo();
  if(anterior)requestAnimationFrame(()=>window.scrollTo({top:anterior.y,behavior:'auto'}));
  else{ui('consulta').focus();ui('buscar').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
}
ui('actualizar-ficha').addEventListener('click',()=>{if(idActual)consultar(idActual,true)});
ui('volver-buscar').addEventListener('click',()=>volverAlCatalogo());
ui('inicio-catalogo').addEventListener('click',()=>volverAlCatalogo(true));

function cerrarLector(){
  if(scanner)scanner.stop();
  const dialog=ui('lector');if(typeof dialog.close==='function'&&dialog.open)dialog.close();else dialog.removeAttribute('open');
  document.body.classList.remove('scanning');
}
function mensajeCamara(error){
  if(error.name==='NotAllowedError'||error.name==='PermissionDeniedError')return 'No se autorizó la cámara. Permite su uso para este sitio en los ajustes de Safari o Chrome, o busca el juego por nombre.';
  if(error.name==='NotFoundError')return 'No se encontró una cámara disponible. Puedes buscar el juego por nombre.';
  if(error.name==='NotReadableError')return 'No se pudo abrir la cámara. Cierra otras aplicaciones que la estén usando y vuelve a intentarlo.';
  if(error.message==='DECODER_UNAVAILABLE')return 'No se cargó el lector QR. Recarga la página con conexión e inténtalo de nuevo.';
  if(error.message==='CANVAS_UNAVAILABLE')return 'El navegador no permite analizar la imagen. Abre la página directamente en Safari o Chrome y vuelve a intentarlo.';
  return 'No se pudo iniciar la cámara. Abre esta página HTTPS directamente en Safari o Chrome; también puedes buscar por nombre.';
}
let cargaLector;
function prepararLector(){
  if(!cargaLector)cargaLector=Promise.all(['vendor/jsQR-1.4.0.js','scanner.js'].map(src=>new Promise((ok,no)=>{
    const script=document.createElement('script');script.src='./'+src+'?v=2.9.0';
    const timer=setTimeout(()=>{script.remove();no(Error('DECODER_UNAVAILABLE'))},15000);
    script.onload=()=>{clearTimeout(timer);ok()};script.onerror=()=>{clearTimeout(timer);script.remove();no(Error('DECODER_UNAVAILABLE'))};document.head.append(script);
  }))).catch(error=>{cargaLector=null;throw error});
  return cargaLector;
}
async function abrirLector(){
  const dialog=ui('lector');
  if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.classList.add('fallback-dialog')}}
  document.body.classList.add('scanning');ui('estado-lector').textContent='Permite el acceso a la cámara cuando el teléfono lo solicite.';ui('reintentar-camara').hidden=true;
  try{await prepararLector()}catch(error){if(dialog.open){ui('estado-lector').textContent=mensajeCamara(error);ui('reintentar-camara').hidden=false}return}
  if(!dialog.open)return;
  if(!scanner)scanner=new CameraQrScanner(ui('camara'),{
    decode:window.jsQR,
    onRead(raw){
      const id=extraerCodigo(raw,location.href,config.publicApiUrl);
      if(!id){if(raw!==ultimoRechazado){ui('estado-lector').textContent='QR reconocido, pero el enlace no corresponde a una etiqueta pública de esta ludoteca. Apunta al código de un juego.';ultimoRechazado=raw}return false}
      cerrarLector();ui('consulta').value=id;guardarUrl({id});consultar(id);return true;
    },
    onProgress(texto){if(dialog.open)ui('estado-lector').textContent=texto},
    onError(error){ui('estado-lector').textContent=error&&['DECODER_UNAVAILABLE','CANVAS_UNAVAILABLE'].includes(error.message)?mensajeCamara(error):'Se interrumpió el análisis de la cámara. Pulsa Intentar de nuevo.';ui('reintentar-camara').hidden=false}
  });
  ultimoRechazado='';
  try{if(await scanner.start())ui('estado-lector').textContent='Cámara lista. Buscando un QR… Mantén la etiqueta completa dentro del recuadro.'}
  catch(error){if(dialog.open){ui('estado-lector').textContent=mensajeCamara(error);ui('reintentar-camara').hidden=false}}
}
ui('escanear').addEventListener('click',abrirLector);
ui('reintentar-camara').addEventListener('click',abrirLector);ui('cerrar-lector').addEventListener('click',cerrarLector);
ui('lector').addEventListener('cancel',cerrarLector);ui('lector').addEventListener('close',()=>{if(scanner)scanner.stop();document.body.classList.remove('scanning')});
window.addEventListener('pagehide',cerrarLector);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cerrarLector()});
window.addEventListener('popstate',leerUbicacion);
window.addEventListener('offline',()=>{const mensaje='Sin conexión. La información visible conserva la última consulta.';if(idActual)estadoFicha38(mensaje);else estado(mensaje);});
window.addEventListener('online',()=>{const mensaje='Conexión recuperada. Pulsa Actualizar para consultar la disponibilidad actual.';if(idActual)estadoFicha38(mensaje);else estado(mensaje);});
const modoAplicacion=matchMedia('(display-mode: standalone)');
let appInstalada=modoAplicacion.matches||navigator.standalone===true;
const esIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const esAndroid=/Android/i.test(navigator.userAgent)&&!esIOS;
ui('instalacion-ios').hidden=esAndroid;
ui('instalacion-android').hidden=esIOS;
ui('instalacion-otros').hidden=esIOS||esAndroid;
function actualizarInstalacion(){ui('instalar').hidden=appInstalada;ui('app-instalada').hidden=!appInstalada}
function mostrarAyudaInstalacion(){
  const ayuda=ui('ayuda-instalacion');ayuda.open=true;
  ayuda.querySelector('summary').focus({preventScroll:true});
  ayuda.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(!appInstalada)instalacion=event;actualizarInstalacion()});
ui('instalar').addEventListener('click',async()=>{
  if(!instalacion){mostrarAyudaInstalacion();return}
  const aviso=instalacion;instalacion=null;
  const boton=ui('instalar');boton.disabled=true;
  try{await aviso.prompt()}catch(error){mostrarAyudaInstalacion()}
  finally{boton.disabled=false;actualizarInstalacion()}
});
window.addEventListener('appinstalled',()=>{appInstalada=true;instalacion=null;ui('ayuda-instalacion').open=false;actualizarInstalacion()});
modoAplicacion.addEventListener?.('change',event=>{appInstalada=event.matches||navigator.standalone===true;actualizarInstalacion()});
actualizarInstalacion();
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
  navigator.serviceWorker.register('./sw.js?v=2.9.0',{scope:'./',updateViaCache:'none'}).catch(()=>{console.warn('No se pudo preparar la interfaz para uso sin conexión.');});
}
const fichasGuardadas38=new Map();
let catalogoVigente38=false,fechaCatalogo38=0,catalogoEnCurso38=null;
function marcarCarga38(id,activa,texto){const b=ui(id);b.disabled=activa;b.classList.toggle('actualizando38',activa);b.setAttribute('aria-busy',String(activa));b.textContent=activa?'Actualizando…':texto;}
function horaConsulta38(fecha){return new Date(fecha).toLocaleString('es-CL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function datosFichaCatalogo38(id){const g=catalogo.find(g=>g.referencia===id);return g&&Number.isInteger(g.disponibilidad)?{...g,fotografia:''}:null;}
function estadoFicha38(texto){estado(texto);ui('estado-ficha38').textContent=texto;}
function recordarFicha38(id,g,fecha=Date.now()){fichasGuardadas38.set(id,{g,fecha});const i=catalogo.findIndex(j=>j.referencia===g.referencia);if(i>=0)catalogo[i]={referencia:g.referencia,nombre:g.nombre,categoria:g.categoria,versionFoto:g.versionFoto,descripcion:g.descripcion,cantidadTotal:g.cantidadTotal,disponibilidad:g.disponibilidad,prestados:g.prestados};}
async function consultar(id,forzar=false){
  clearTimeout(filtroPendiente);const turno=++generacion,mantener=idActual===id&&!ui('ficha').hidden;
  if(!mantener)limpiarVista();idActual=id;
  if(!codigoValido(id)){estadoFicha38('Revisa el código de la etiqueta.');return;}
  mostrarReintento(false);
  const memoria=fichasGuardadas38.get(id),delCatalogo=datosFichaCatalogo38(id),guardada=memoria||(delCatalogo?{g:delCatalogo,fecha:fechaCatalogo38}:null);
  if(!forzar&&guardada&&(memoria||catalogoVigente38)){
    mostrarFicha(guardada.g);marcarCarga38('actualizar-ficha',false,'Actualizar disponibilidad');ui('ficha').setAttribute('aria-busy','false');estadoFicha38('Disponibilidad consultada el '+horaConsulta38(guardada.fecha)+'. Pulsa Actualizar disponibilidad para consultar de nuevo.');return;
  }
  if(!mantener){if(guardada){mostrarFicha(guardada.g);estadoFicha38('Mostrando la última consulta guardada. Consultando disponibilidad…');}else{estadoFicha38('Consultando disponibilidad…');prepararCatalogo().then(()=>{if(turno===generacion&&ui('ficha').hidden)anticiparFicha(id)});}}
  marcarCarga38('actualizar-ficha',true,'Actualizar disponibilidad');ui('ficha').setAttribute('aria-busy','true');
  try{
    if(!navigator.onLine)throw Error('Sin conexión. La información visible conserva la última consulta; actualiza cuando te conectes.');
    let g;
    if(!forzar&&!id.includes('-')){await cargarCatalogo();if(!catalogoVigente38)throw Error('No se pudo consultar la disponibilidad actual. Inténtalo otra vez.');g=datosFichaCatalogo38(id);}
    else g=await solicitarFicha(id);
    if(turno!==generacion)return;
    if(!fichaValida(g))throw Error('Ficha no disponible. Revisa el código o vuelve a intentarlo.');
    const fecha=Date.now();recordarFicha38(id,g,fecha);mostrarFicha(g);estadoFicha38('Disponibilidad consultada el '+horaConsulta38(fecha)+'. Solo se actualizará cuando pulses Actualizar disponibilidad.');
  }catch(error){if(turno===generacion){estadoFicha38(error.message);mostrarReintento(true);}}
  finally{if(turno===generacion){marcarCarga38('actualizar-ficha',false,'Actualizar disponibilidad');ui('ficha').setAttribute('aria-busy','false');}}
}
function cargarCatalogo(){
  if(catalogoEnCurso38)return catalogoEnCurso38;
  cargandoCatalogo=true;const turno=++cargaCatalogo;marcarCarga38('refrescar-catalogo',true,'Actualizar catálogo');
  if(!idActual){mostrarReintento(false);estado(catalogoCargado?'Actualizando catálogo y disponibilidad…':'Cargando catálogo…');}
  catalogoEnCurso38=(async()=>{
    try{
      const inicial=prepararCatalogo();if(!navigator.onLine){await inicial;throw Error('Sin conexión. Se muestra el catálogo guardado.');}
      catalogoSolicitado=true;
      const [r]=await Promise.all([jsonp({api:'catalogo',v:'38'}),inicial]);if(turno!==cargaCatalogo)return;
      if(!catalogoValido(r)||r.juegos.some(g=>!Number.isInteger(g.disponibilidad)))throw Error('No se pudo actualizar el catálogo. Vuelve a intentarlo.');
      fechaCatalogo38=Date.parse(r.consultado)||Date.now();catalogoVigente38=true;
      aplicarCatalogo(r.juegos);fichasGuardadas38.clear();guardarCatalogo(almacenamiento,claveCatalogo,r.juegos,fechaCatalogo38);
      if(!idActual)estado('Catálogo y disponibilidad actualizados el '+horaConsulta38(fechaCatalogo38)+'. '+catalogo.length+' juegos.');
    }catch(error){if(turno===cargaCatalogo&&!idActual){estado(error.message);mostrarReintento(true);}}
    finally{if(turno===cargaCatalogo){marcarCarga38('refrescar-catalogo',false,'Actualizar catálogo');cargandoCatalogo=false;}catalogoEnCurso38=null;}
  })();return catalogoEnCurso38;
}

leerUbicacion();


