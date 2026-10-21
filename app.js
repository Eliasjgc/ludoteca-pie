'use strict';
const ui = id => document.getElementById(id);
const config = window.LUDOTECA_CONFIG || {};
const codigoValido = id => /^J\d{3,8}(?:-\d{2,8})?$/.test(id);
const endpointValido = u => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u || '');
let idActual = new URL(location.href).searchParams.get('id') || '';
let generacion = 0, instalacion;

function estado(texto) { ui('estado').textContent = texto; }
function fichaValida(g) {
  const claves = ['nombre','fotografia','cantidadTotal','disponibilidad','categoria','descripcion'];
  return g && Object.keys(g).length === 6 && claves.every(k => Object.hasOwn(g,k)) &&
    ['nombre','fotografia','categoria','descripcion'].every(k => typeof g[k] === 'string') &&
    Number.isInteger(g.cantidadTotal) && Number.isInteger(g.disponibilidad) &&
    g.disponibilidad >= 0 && g.disponibilidad <= g.cantidadTotal;
}
function jsonp(id) {
  return new Promise((resolve,reject) => {
    const name = 'ludoteca_' + Array.from(crypto.getRandomValues(new Uint32Array(3)),n => n.toString(16)).join('_');
    const script = document.createElement('script');
    let finalizado = false;
    function terminar(error,data) {
      if (finalizado) return; finalizado = true;
      clearTimeout(timer); script.remove();
      window[name] = () => {}; // Ignorar una respuesta tardía tras el timeout.
      setTimeout(() => { delete window[name]; },60000);
      error ? reject(error) : resolve(data);
    }
    window[name] = data => terminar(null,data);
    const url = new URL(config.publicApiUrl);
    url.search = new URLSearchParams({api:'ficha',id,callback:name,_:String(Date.now())}).toString();
    script.src = url.href; script.referrerPolicy = 'no-referrer';
    script.onerror = () => terminar(Error('No se pudo consultar. Comprueba la conexión y vuelve a intentarlo.'));
    const timer = setTimeout(() => terminar(Error('La consulta tardó demasiado. Vuelve a intentarlo.')),25000);
    document.head.appendChild(script);
  });
}
async function consultar(id) {
  const turno = ++generacion;
  idActual = id;
  ui('ficha').hidden = true; ui('foto').removeAttribute('src');
  if (!codigoValido(id)) { estado('Escribe un código válido, como J001 o J001-01.'); return; }
  if (!endpointValido(config.publicApiUrl)) { estado('La consulta pública todavía no está configurada. La persona administradora debe completar config.js.'); return; }
  if (!navigator.onLine) { estado('Sin conexión. Conéctate para consultar la disponibilidad actual.'); return; }
  estado('Consultando disponibilidad…');
  try {
    const g = await jsonp(id);
    if (turno !== generacion) return;
    if (!fichaValida(g)) throw Error('Ficha no disponible. Revisa el código o vuelve a intentarlo más tarde.');
    ui('nombre').textContent = g.nombre;
    ui('categoria').textContent = g.categoria || 'Sin categoría';
    ui('descripcion').textContent = g.descripcion || 'Descripción no registrada.';
    ui('total').textContent = g.cantidadTotal;
    ui('disponibles').textContent = g.disponibilidad;
    const fotoValida = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(g.fotografia) && g.fotografia.length <= 1400000;
    ui('foto').hidden = !fotoValida; ui('sin-foto').hidden = fotoValida;
    if (fotoValida) { ui('foto').src = g.fotografia; ui('foto').alt = 'Fotografía de '+g.nombre; }
    ui('ficha').hidden = false;
    estado('Consulta realizada a las '+new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+'.');
  } catch (error) { if (turno === generacion) estado(error.message); }
}
ui('buscar').addEventListener('submit',event => {
  event.preventDefault();
  const id = ui('codigo').value.trim().toUpperCase();
  if (!codigoValido(id)) { estado('Revisa el código de la etiqueta.'); return; }
  const u = new URL(location.href); u.search = new URLSearchParams({id}).toString();
  history.pushState(null,'',u); consultar(id);
});
ui('actualizar').addEventListener('click',() => consultar(idActual));
window.addEventListener('popstate',() => { idActual = new URL(location.href).searchParams.get('id') || ''; ui('codigo').value = idActual; if (idActual) consultar(idActual); else { ++generacion; ui('ficha').hidden=true; estado('Escanea un QR o escribe el código de la etiqueta.'); } });
window.addEventListener('offline',() => { ++generacion; ui('ficha').hidden=true; estado('Sin conexión. Conéctate para consultar la disponibilidad actual.'); });
window.addEventListener('online',() => { if (codigoValido(idActual)) consultar(idActual); });
document.addEventListener('visibilitychange',() => { if (!document.hidden && codigoValido(idActual)) consultar(idActual); });
window.addEventListener('beforeinstallprompt',event => { event.preventDefault(); instalacion=event; ui('instalar').hidden=false; });
ui('instalar').addEventListener('click',async () => { if (!instalacion) return; await instalacion.prompt(); instalacion=null; ui('instalar').hidden=true; });
window.addEventListener('appinstalled',() => { ui('instalar').hidden=true; instalacion=null; });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(() => estado('La consulta funciona. No se pudo preparar el acceso sin conexión; vuelve a abrir la página para instalarla.'));
}
if (idActual) { ui('codigo').value=idActual; consultar(idActual); }
else estado(navigator.onLine ? 'Escanea un QR o escribe el código de la etiqueta.' : 'Sin conexión. Conéctate para consultar juegos.');
