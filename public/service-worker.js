const CACHE_VERSION = 'cy-erp-pwa-v3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const APP_SHELL_URLS = ['/', '/index.html'];

const shouldIgnoreRequest = (request) => {
  if (request.method !== 'GET') return true;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  if (url.origin !== self.location.origin) return true;

  return url.pathname.startsWith('/__/') || url.pathname.startsWith('/api/');
};

const isStaticAsset = (request) => (
  ['font', 'image', 'script', 'style', 'worker'].includes(request.destination)
);

const isPwaInstallAsset = (request) => {
  const url = new URL(request.url);
  return url.pathname === '/manifest.json' || url.pathname.startsWith('/icons/');
};

const fetchFresh = (request) => fetch(new Request(request, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('cy-erp-pwa-') && !cacheName.startsWith(CACHE_VERSION))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (shouldIgnoreRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (isPwaInstallAsset(request)) {
    event.respondWith(
      fetchFresh(request).catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
