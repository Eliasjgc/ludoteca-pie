'use strict';
const VERSION='2.4.0';
const PREFIX='ludoteca-pie-'+new URL(self.registration.scope).pathname+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=['app.css','catalogo.css','identidad.css','alegria.css','fonts/fonts.css','app.js','core.js','scanner.js','config.js','vendor/jsQR-1.4.0.js','manifest.webmanifest','icons/boyeco-transparente-192.png','icons/boyeco-transparente-512.png','icons/boyeco-transparente-apple.png','icons/boyeco-transparente-favicon.png','icons/logo-escuela-transparente.png'];
const absolute=name=>new URL(name,self.registration.scope).href;
const SHELL=['index.html',...ASSETS.map(name=>name+'?v='+VERSION),'fonts/nunito.woff2','fonts/atkinson.woff2'];
const allowed=new Set(SHELL.map(absolute));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(absolute))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.open(CACHE).then(cache=>cache.match(absolute('index.html')))));
  return;
 }
 if(!allowed.has(url.href))return;
 // La red tiene prioridad. El caché solo se usa si la red falla y para esta versión exacta.
 event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));return response;}
  return caches.open(CACHE).then(cache=>cache.match(request)).then(cached=>cached||response);
 }).catch(()=>caches.open(CACHE).then(cache=>cache.match(request))));
});
