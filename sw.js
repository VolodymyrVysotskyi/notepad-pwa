// Self-destructing SW: retires every prior service worker (v3/v4 cache-first
// AND any earlier copy of this self-destructor) so users on stale PWA installs
// always get the latest HTML on the next reload — no manual cache clear needed.
//
// Sequence on activate:
//   1. clients.claim()   — take over tabs that were controlled by the old SW
//   2. clear caches      — drop everything the old SW stashed
//   3. unregister()      — remove this registration so future loads bypass SW
//   4. navigate clients  — force every controlled tab to reload via network
//
// Without (1), a freshly-activated SW only controls *future* tabs; existing
// tabs stay attached to the old SW until they reload. With (1), the new SW
// owns them immediately, so the navigate in (4) goes through us (no fetch
// handler beyond pass-through) instead of the old cache-first SW.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.navigate(c.url));
  })());
});

// Network-only pass-through. Defends against the brief window between claim()
// and unregister() where this SW controls the page: every fetch goes straight
// to the network, bypassing any HTTP cache the browser might otherwise consult.
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request, { cache: 'no-store' }));
});
