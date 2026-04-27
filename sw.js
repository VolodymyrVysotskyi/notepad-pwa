// Self-destructing SW: retires the v3/v4 cache-first SW. Existing PWA installs
// won't see the new HTML otherwise, since the registered SW intercepts every
// fetch. Once activated, this version unregisters itself and reloads clients.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.navigate(c.url));
  })());
});
