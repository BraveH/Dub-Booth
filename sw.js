/* Dub Booth offline support: keeps the app's files so it opens without a connection.
   Pages come from the saved copy at once while a fresh copy downloads in the background;
   when that copy differs, open pages are told a new version is ready. */
const CACHE = 'dub-booth-v1';
const SHELL = ['./dub-booth.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

// Set when the last page load found a newer copy; a page that starts after the check asks for it.
let updated = false;
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'check' && updated && e.source) e.source.postMessage({ type: 'update-ready' });
});

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // the speech model and its library go straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const was = hit && req.mode === 'navigate' ? hit.clone() : null; // a copy to compare: hit itself goes to the page
    const fresh = fetch(req).then(async (res) => {
      if (res && res.ok && res.type === 'basic') {
        if (was) {
          const [a, b] = await Promise.all([was.text(), res.clone().text()]);
          updated = a !== b;
          if (updated) (await self.clients.matchAll({ type: 'window' })).forEach((c) => c.postMessage({ type: 'update-ready' }));
        }
        await cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    const res = await fresh;
    return res || new Response('Dub Booth can’t open this without a connection yet. Open it once while online.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  })());
});
