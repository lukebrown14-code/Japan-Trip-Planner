// Minimal service worker: cache-first app shell + map tiles (last 200), network-first /api.
const SHELL = 'japan-shell-v1', TILES = 'japan-tiles-v1', API = 'japan-api-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/today', '/icons/icon.svg']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, TILES, API].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
async function trim(name, max) { const c = await caches.open(name); const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url);
  if ((u.hostname === 'tile.openstreetmap.org' || u.hostname.endsWith('basemaps.cartocdn.com'))) {
    e.respondWith(caches.open(TILES).then(async c => { const hit = await c.match(r); if (hit) return hit;
      try { const res = await fetch(r); if (res.ok || res.type === 'opaque') { c.put(r, res.clone()); trim(TILES, 200); } return res; } catch { return Response.error(); } }));
  } else if (u.origin === location.origin && u.pathname.startsWith('/api/')) {
    return; // never cache authenticated API data
  } else if (u.origin === location.origin && r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(SHELL).then(c => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r).then(h => h || caches.match('/today')).then(h => h || Response.error())));
  } else if (u.origin === location.origin) {
    e.respondWith(caches.open(SHELL).then(async c => { const hit = await c.match(r); if (hit) return hit;
      try { const res = await fetch(r); if (res.ok && res.type === 'basic') c.put(r, res.clone()); return res; }
      catch { if (r.mode === 'navigate') { const h = await c.match('/today'); if (h) return h; } return Response.error(); } }));
  }
});
