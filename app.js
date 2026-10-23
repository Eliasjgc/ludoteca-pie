'use strict';
const ui=id=>document.getElementById(id);
const config=window.LUDOTECA_CONFIG || {};
const {codigoValido,extraerCodigo,fichaValida,filtrarCatalogo}=LudotecaTools;
const endpointValido=u=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u || '');
let idActual='',generacion=0,instalacion,scanner,ultimoRechazado='',catalogo=[],catalogoCargado=false,cargaCatalogo=0,categoriaPendiente='',cargandoCatalogo=false;
const {catalogoValido,leerCatalogo,guardarCatalogo}=CatalogoDatos;
const claveCatalogo='ludoteca-catalogo-v27:'+config.publicApiUrl;
let almacenamiento;try{almacenamiento=window.localStorage}catch(error){}
const fotosCatalogo=new CatalogPhotoLoader({almacen:new PhotoStore({api:config.publicApiUrl}),cargar:id=>jsonp({api:'foto',id,v:'27'})});
let inicioCatalogo;
function estado(texto){ui('estado').textContent=texto}function mostrarReintento(valor){ui('reintentar-conexion').hidden=!valor}
function limpiarVista(){fotosCatalogo.pausar();ui('ficha').hidden=true;ui('foto').removeAttribute('src');ui('catalogo').hidden=true}
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
  ui('foto').hidden=true;ui('sin-foto').hidden=false;ui('sin-foto').textContent='Cargando fotografía…';
  ui('foto').alt='Fotografía de '+g.nombre;
  ui('ficha').hidden=false;
  fotosCatalogo.observar(ui('ficha'),g.referencia,ui('foto'),ui('sin-foto'),g.versionFoto);
  ui('ficha').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
async function consultar(id){
  const turno=++generacion;limpiarVista();idActual=id;
  if(!codigoValido(id)){estado('Revisa el código de la etiqueta.');return}
  if(!navigator.onLine){estado('Sin conexión. Conéctate para consultar disponibilidad actual.');return}
  mostrarReintento(false);estado('Consultando disponibilidad…');
  try{
    const [g]=await Promise.all([jsonp({api:'ficha',id,v:'27'}),prepararCatalogo()]);if(turno!==generacion)return;
    if(!fichaValida(g))throw Error('Ficha no disponible. Revisa el código o vuelve a intentarlo.');
    mostrarFicha(g);estado('Consulta realizada a las '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+'.');
  }catch(error){if(turno===generacion){estado(error.message);mostrarReintento(true)}}
}
function pintarCatalogo(){
  if(idActual || !catalogoCargado)return;
  const q=ui('consulta').value.trim(),categoria=ui('categoria-filtro').value;
  const arr=filtrarCatalogo(catalogo,q,categoria);
  fotosCatalogo.pausar();
  ui('resultados').replaceChildren(...arr.map(g=>{
    const boton=document.createElement('button');boton.type='button';boton.className='game-card';boton.setAttribute('aria-label','Ver ficha de '+g.nombre);
    const media=document.createElement('span');media.className='game-card-media';
    const imagen=document.createElement('img');imagen.alt='';imagen.hidden=true;imagen.decoding='async';imagen.loading='lazy';imagen.width=480;imagen.height=400;
    const nota=document.createElement('span');nota.className='game-card-placeholder';nota.textContent='Cargando fotografía…';media.append(imagen,nota);
    const texto=document.createElement('span');texto.className='game-card-info';
    const nombre=document.createElement('span');nombre.className='game-card-name';nombre.textContent=g.nombre;
    const categoria=document.createElement('span');categoria.className='game-card-category';categoria.textContent=g.categoria||'Sin categoría';texto.append(nombre,categoria);
    boton.append(media,texto);boton.addEventListener('click',()=>{guardarUrl({id:g.referencia});consultar(g.referencia)});
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
  const guardado=leerCatalogo(almacenamiento,claveCatalogo);
  inicioCatalogo=(async()=>{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
    try{
      const r=await fetch('./catalogo-inicial.json?v=2.7.0',{signal:abort.signal});if(!r.ok)throw Error();const inicial=await r.json();
      if(!catalogoValido(inicial)||!inicial.fotos)throw Error();
      fotosCatalogo.miniaturas=inicial.fotos;
      aplicarCatalogo(guardado&&guardado.fecha>=Date.parse(inicial.generado)?guardado.juegos:inicial.juegos);
    }catch(error){if(guardado)aplicarCatalogo(guardado.juegos)}
    finally{clearTimeout(timer)}
  })();
  return inicioCatalogo;
}
async function cargarCatalogo(){
  if(cargandoCatalogo)return;cargandoCatalogo=true;
  const turno=++cargaCatalogo;fotosCatalogo.limpiar();ui('refrescar-catalogo').disabled=true;
  if(!idActual){mostrarReintento(false);if(!catalogoCargado)estado('Cargando catálogo…')}
  try{
    const inicial=prepararCatalogo();
    if(!navigator.onLine){await inicial;throw Error('Sin conexión. Puedes explorar el catálogo guardado; conéctate para consultar disponibilidad.')}
    const [r]=await Promise.all([jsonp({api:'catalogo',v:'27'}),inicial]);if(turno!==cargaCatalogo)return;
    if(!catalogoValido(r))throw Error('No se pudo actualizar el catálogo. Vuelve a intentarlo.');
    aplicarCatalogo(r.juegos);guardarCatalogo(almacenamiento,claveCatalogo,r.juegos);
    if(!idActual)estado('Catálogo actualizado. '+catalogo.length+' juegos.');
  }catch(error){if(turno===cargaCatalogo&&!idActual){estado(error.message);mostrarReintento(true)}}
  finally{if(turno===cargaCatalogo){ui('refrescar-catalogo').disabled=false;cargandoCatalogo=false}}
}
function mostrarCatalogo(){
  ++generacion;idActual='';mostrarReintento(false);limpiarVista();ui('catalogo').hidden=false;
  if(catalogoCargado)pintarCatalogo();else cargarCatalogo();
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
ui('consulta').addEventListener('input',()=>{mostrarCatalogo();const u=new URL(location.href);u.search=new URLSearchParams(parametrosFiltro()).toString();history.replaceState(null,'',u)});
ui('categoria-filtro').addEventListener('change',()=>{guardarUrl(parametrosFiltro());mostrarCatalogo()});
ui('limpiar-filtros').addEventListener('click',()=>{ui('consulta').value='';ui('categoria-filtro').value='';categoriaPendiente='';guardarUrl({});mostrarCatalogo()});
ui('refrescar-catalogo').addEventListener('click',cargarCatalogo);ui('reintentar-conexion').addEventListener('click',()=>{if(idActual)consultar(idActual);else cargarCatalogo()});
function volverAlCatalogo(){ui('consulta').value='';ui('categoria-filtro').value='';categoriaPendiente='';guardarUrl({});mostrarCatalogo();ui('consulta').focus();ui('buscar').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
ui('volver-buscar').addEventListener('click',volverAlCatalogo);
ui('inicio-catalogo').addEventListener('click',volverAlCatalogo);

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
async function abrirLector(){
  const dialog=ui('lector');
  if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.classList.add('fallback-dialog')}}
  document.body.classList.add('scanning');ui('estado-lector').textContent='Permite el acceso a la cámara cuando el teléfono lo solicite.';ui('reintentar-camara').hidden=true;
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
document.addEventListener('visibilitychange',()=>{if(document.hidden)cerrarLector();else if(idActual)consultar(idActual)});
window.addEventListener('popstate',leerUbicacion);
window.addEventListener('offline',()=>{++generacion;idActual='';limpiarVista();if(catalogoCargado)pintarCatalogo();estado('Sin conexión. Puedes explorar el catálogo guardado; conéctate para consultar disponibilidad actual.')});
window.addEventListener('online',leerUbicacion);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();instalacion=event;ui('instalar').hidden=false});
ui('instalar').addEventListener('click',async()=>{if(instalacion){await instalacion.prompt();instalacion=null;ui('instalar').hidden=true}});
window.addEventListener('appinstalled',()=>{ui('instalar').hidden=true;instalacion=null});
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){
  navigator.serviceWorker.register('./sw.js?v=2.7.0',{scope:'./',updateViaCache:'none'}).catch(()=>{console.warn('No se pudo preparar la interfaz para uso sin conexión.');});
}
leerUbicacion();
if(idActual)cargarCatalogo();


