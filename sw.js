const CACHE_NAME = 'bingo-images-v2';

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

  try {
    const url = new URL(req.url);
    const pathname = url.pathname || url.href;
    const isImageExt = /\.(png|jpg|jpeg|gif|webp|svg)$/.test(pathname);
    const isColorPath = /\/(?:图片|大红|金|紫|蓝|绿|白)\//.test(pathname) || /\/(?:大红|金|紫|蓝|绿|白)\//.test(pathname.replace(/^\//, ''));
    if (!isImageExt && !isColorPath) return; // only handle likely image/color requests

    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) {
        return cached;
      }

      const networkResp = await fetch(req);
      try {
        if (networkResp && networkResp.ok) {
          cache.put(req, networkResp.clone()).catch(() => {});
        }
      } catch (e) {
        // ignore cache put errors
      }
      return networkResp;
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
