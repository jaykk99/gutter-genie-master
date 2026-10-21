/* Gutter Genie hub service worker: offline shell for the dashboard.
 *
 * Same-origin GET requests are served stale-while-revalidate from the cache,
 * so index.html and jobs.html keep working with no connection (the jobs page
 * already falls back to its localStorage cache for data). Cross-origin
 * requests (Supabase, satellite apps in iframes) are left alone.
 */
const CACHE = 'gg-hub-v1';
const SHELL = ['./', './index.html', './jobs.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: not ours
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
