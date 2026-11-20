// Tricity Hold'em service worker: makes the app installable. It never caches anything,
// so every page, script and stylesheet still comes fresh from the server (no-store / no-cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).pathname.startsWith('/socket.io/')) return; // live game traffic goes straight to the network
  event.respondWith(fetch(req));
});
