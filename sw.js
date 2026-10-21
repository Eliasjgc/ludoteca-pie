'use strict';
// Subir VERSION en cada publicación de archivos estáticos.
const VERSION = '2.2.0';
const PREFIX = 'ludoteca-pie-' + new URL(self.registration.scope).pathname + '-';
const CACHE = PREFIX + VERSION;
const SHELL = ['index.html','app.css','app.js','config.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
const local = name => new URL(name,self.registration.scope).href;
self.addEventListener('install',event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(local))).then(() => self.skipWaiting()));
});
self.addEventListener('activate',event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',event => {
  const req = event.request, url = new URL(req.url), scope = new URL(self.registration.scope);
  if (req.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  // Google, JSONP, fotos y administración quedan fuera del caché. Solo se guarda la carcasa pública.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.open(CACHE).then(cache => cache.match(local('index.html')))));
    return;
  }
  if (!SHELL.map(local).includes(url.href)) return;
  if (url.href === local('config.js')) {
    event.respondWith(fetch(req,{cache:'no-store'}).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(local('config.js'),copy))); }
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(local('config.js')))));
  } else event.respondWith(caches.open(CACHE).then(cache => cache.match(req)).then(cached => cached || fetch(req)));
});
