const CACHE_NAME = 'proptenant-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/globe.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests from our own origin
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // 1. NEVER cache API requests (dynamic dashboard and payment data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Network-First strategy for HTML document pages (e.g. dashboard routes)
  // This ensures that the user always gets the latest UI code/updates when online,
  // but can still view the cached app shell if they are offline.
  if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html') ||
    url.pathname.startsWith('/dashboard')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If valid response, clone and cache it
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: try to serve from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Cache-First strategy for static assets (JS, CSS, images, etc.)
  // Static chunks are hashed, so cache-first is safe and fast.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache static files (next assets, images, web manifest)
        const isStaticAsset = 
          url.pathname.includes('/_next/') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.jpeg') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.json') ||
          url.pathname.endsWith('.ico');

        if (isStaticAsset) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Fail silently or offline fallback
      });
    })
  );
});
