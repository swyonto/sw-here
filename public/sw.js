const CACHE_NAME = 'sw-here-v1';
const STATIC_ASSETS = [
  '/',
  '/about',
  '/css/style.css',
  '/js/script.js',
  '/images/image-dark.png',
  '/images/sw-here-logo.png',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png',
  '/images/icons/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/html5-qrcode'
];

// Perform install & cache core static app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching core application shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Clean up stale caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Removing deprecated cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept requests and serve with custom strategies
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 1. Bypass Caching for Socket.IO and backend API requests
  if (requestUrl.pathname.startsWith('/socket.io') || requestUrl.pathname.startsWith('/api')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Network-First Strategy for HTML/Template routes (/ and /about)
  // This allows the app to fetch the latest server EJS state, falling back to cache if offline
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response and save it to the cache
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request);
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate Strategy for static files (CSS, JS, Fonts, Images)
  // Serve from cache immediately, then fetch and update cache in background
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Fetch latest version in the background to update the cache
        fetch(event.request)
          .then(networkResponse => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => { /* Ignore background fetch failures */ });
        
        return cachedResponse;
      }

      // If not in cache, fetch from network normally
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});
