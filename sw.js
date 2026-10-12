// Service worker: działa offline. Pliki główne – najpierw sieć (żeby aktualizacje wchodziły), obrazki – najpierw cache.
const VERSION = 'v1';
const CORE = ['./', './index.html', './pytania.js', './manifest.json', './icon-192.png', './icon-512.png'];
const CACHE = 'rolnik-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('rolnik-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    cacheImages(); // w tle: wszystkie obrazki z banku pytań
  })());
});

async function cacheImages() {
  try {
    const c = await caches.open(CACHE);
    const txt = await (await fetch('./pytania.js', { cache: 'no-cache' })).text();
    const imgs = [...new Set(txt.match(/img\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif|webp)/g) || [])];
    for (const p of imgs) {
      if (await c.match('./' + p)) continue;
      try { await c.add('./' + p); } catch (e) {}
    }
  } catch (e) {}
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !isFont) return;
  const isImg = /\/img\//.test(req.url);
  e.respondWith(isImg || isFont ? cacheFirst(req) : networkFirst(req));
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await c.match(req, { ignoreSearch: true });
    return hit || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }
  catch (e) { return Response.error(); }
}
