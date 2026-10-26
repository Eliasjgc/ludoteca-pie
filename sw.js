'use strict';
const VERSION='2.8.2';
const PREFIX='ludoteca-pie-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+VERSION;
const PHOTO_CACHE='ludoteca-miniaturas-'+new URL(self.registration.scope).pathname+'-v1';
const OPTIONAL=['scanner.js','vendor/jsQR-1.4.0.js'];
const ASSETS=['app.css','catalogo.css','identidad.css','alegria.css','fonts/fonts.css','app.js','fotos.js','catalogo-datos.js','catalogo-inicial.json','core.js','config.js','manifest.webmanifest','icons/boyeco-transparente-192.png','icons/boyeco-transparente-512.png','icons/boyeco-transparente-apple.png','icons/boyeco-transparente-favicon.png','icons/logo-escuela-transparente.png'];
const absolute=name=>new URL(name,self.registration.scope).href;
const SHELL=['index.html',...ASSETS.map(name=>name+'?v='+VERSION),'fonts/nunito.woff2','fonts/atkinson.woff2'];
const allowed=new Set([...SHELL,...OPTIONAL.map(name=>name+'?v='+VERSION)].map(absolute));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(absolute))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.open(CACHE).then(cache=>cache.match(absolute('index.html')))));
  return;
 }
 const foto=url.search===''&&/^fotos\/J\d{3,8}-[a-f0-9]{12}\.webp$/.test(url.pathname.slice(scope.pathname.length));
 if(!allowed.has(url.href)&&!foto)return;
 // Archivos versionados y miniaturas con huella: reutilizarlos hasta que cambie su URL.
 event.respondWith(caches.open(foto?PHOTO_CACHE:CACHE).then(async cache=>{
  const cached=await cache.match(request);if(cached)return cached;
  const response=await fetch(request);
  if(response.ok){const copy=response.clone();event.waitUntil((async()=>{await cache.put(request,copy);if(foto){const keys=await cache.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-150)).map(key=>cache.delete(key)))}})())}
  return response;
 }));
});

