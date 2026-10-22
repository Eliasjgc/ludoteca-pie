'use strict';
const VERSION='2.3.1';
const PREFIX='ludoteca-pie-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+VERSION;
const SHELL=['index.html','app.css','catalogo.css','app.js','core.js','scanner.js','config.js','vendor/jsQR-1.4.0.js','vendor/jsQR-LICENSE.txt','manifest.webmanifest','icons/boyeco-192.png','icons/boyeco-512.png','icons/boyeco-maskable-512.png','icons/boyeco-apple-180.png','icons/boyeco-favicon.png','icons/logo-escuela.png'];
const local=name=>new URL(name,self.registration.scope).href;
SHELL.push('identidad.css','fonts/fonts.css','fonts/nunito.woff2','fonts/atkinson.woff2');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(local))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
  if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  // No se guardan resultados, disponibilidad, fotos de juegos ni imágenes de cámara.
  if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(local('index.html')))));return}
  if(!SHELL.map(local).includes(url.href))return;
  if(url.href===local('config.js')){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(local('config.js'),copy)))}return response;
    }).catch(()=>caches.open(CACHE).then(cache=>cache.match(local('config.js')))));
  }else event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>cached||fetch(request)));
});
