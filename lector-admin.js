'use strict';
const el=id=>document.getElementById(id),p=new URLSearchParams(location.hash.slice(1));
const origen=p.get('origen')||'',clave=p.get('clave')||'',modo=p.get('modo')||'';
const origenValido=/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(origen)||origen==='https://script.google.com';
const conectado=!!window.opener&&origenValido&&/^[a-f0-9]{32}$/.test(clave)&&['prestar','devolver'].includes(modo);
let scanner,leidas=0,ultima='',cuando=0;
function estado(texto){el('estado').textContent=texto}
function detener(){if(scanner)scanner.stop();el('camara').hidden=true;el('iniciar').disabled=!conectado}
function enviar(raw){
 if(!conectado||window.opener.closed){detener();estado('La administración ya no está disponible. Abre de nuevo el lector desde allí.');return}
 const codigo=String(raw||'').trim();if(!codigo||codigo.length>600){estado('Revisa el código de la etiqueta.');return}
 window.opener.postMessage({tipo:'ludoteca-qr34',clave,codigo},origen);estado('Etiqueta enviada. Esperando confirmación de la selección…');
}
async function iniciar(){
 if(!conectado)return;el('iniciar').disabled=true;
 try{
  if(!scanner)scanner=new CameraQrScanner(el('camara'),{decode:window.jsQR,onRead(raw){if(raw===ultima&&Date.now()-cuando<2000)return false;ultima=raw;cuando=Date.now();enviar(raw);return false},onProgress(texto){if(!ultima)estado(texto)},onError(error){detener();estado(error?.message||'Se interrumpió la cámara. Vuelve a iniciarla.')}});
  el('camara').hidden=false;estado('Permite el uso de la cámara cuando lo solicite el navegador.');if(await scanner.start())estado('Cámara lista. Apunta a una etiqueta QR.');
 }catch(error){detener();estado(error?.name==='NotAllowedError'?'No se autorizó la cámara. Revisa el permiso del navegador o vuelve para leer una foto del QR.':error?.name==='NotFoundError'?'No se encontró una cámara. Puedes usar un lector externo o volver a la administración.':'No se pudo abrir la cámara. Cierra otras aplicaciones que la estén usando e inténtalo otra vez.')}
}
window.addEventListener('message',event=>{const d=event.data;if(!conectado||event.source!==window.opener||event.origin!==origen||!d||d.tipo!=='ludoteca-qr34-respuesta'||d.clave!==clave||typeof d.aceptado!=='boolean')return;estado(typeof d.mensaje==='string'?d.mensaje.slice(0,200):'Revisa la selección en administración.');if(d.aceptado&&d.nuevo){leidas++;el('cantidad').textContent=leidas+' ejemplar(es) añadido(s) desde esta ventana. Revisa la selección al volver.'}});
el('iniciar').addEventListener('click',iniciar);el('detener').addEventListener('click',()=>{detener();estado('Cámara detenida.')});
el('codigo-form').addEventListener('submit',event=>{event.preventDefault();enviar(el('codigo').value);el('codigo').select()});
el('volver').addEventListener('click',()=>{detener();if(window.opener&&!window.opener.closed)window.opener.focus();window.close()});
window.addEventListener('pagehide',detener);document.addEventListener('visibilitychange',()=>{if(document.hidden)detener()});
if(conectado){el('iniciar').disabled=false;el('codigo').disabled=false;el('enviar').disabled=false;el('modo').textContent=modo==='prestar'?'Añadir ejemplares al préstamo':'Seleccionar devoluciones';estado('Inicia la cámara o usa un lector externo. Los códigos volverán a tu selección administrativa.')}else estado('Abre este lector desde el botón Iniciar cámara de la administración de Ludoteca.');
