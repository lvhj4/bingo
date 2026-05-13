const CACHE_NAME = 'bingo-images-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Only handle image requests (and paths under 图片/ or color folders)
  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const isImage = req.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(pathname);
    const isColorFolder = /\/(?:图片|大红|金|紫|蓝|绿|白)\//.test(pathname) || /\/(?:大红|金|紫|蓝|绿|白)\//.test(pathname.replace(/^\//, ''));
    if (!isImage && !isColorFolder) return;

    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      // Start network fetch in background to update cache (stale-while-revalidate)
      const networkPromise = fetch(req).then((networkResp) => {
        if (networkResp && networkResp.ok) {
          cache.put(req, networkResp.clone()).catch(() => {});
        }
        return networkResp;
      }).catch(() => null);

      // Prefer cached response if available, otherwise wait for network
      return cached || networkPromise;
    })());
  } catch (e) {
    // ignore
  }
});

self.addEventListener('message', (event) => {
  const { action } = event.data || {};
  if (action === 'clear-cache') {
    caches.delete(CACHE_NAME);
  }
});
