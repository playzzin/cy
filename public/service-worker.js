const CACHE_VERSION = 'cy-erp-pwa-v5';
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

const isHtmlResponse = (response) => (
  response?.ok && /\btext\/html\b/i.test(response.headers.get('Content-Type') || '')
);

const isValidAsset = (request, response) => {
  if (!response?.ok || response.status === 206 || response.redirected) return false;
  const contentType = (response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  // Hosting rewrites missing chunks to index.html with status 200. Never
  // persist that response under a script, stylesheet, or image URL.
  if (!contentType || /html/.test(contentType)) return false;
  if (['script', 'worker'].includes(request.destination)) {
    return /^(text|application)\/(javascript|ecmascript|x-javascript)$/.test(contentType);
  }
  if (request.destination === 'style') return contentType === 'text/css';
  if (request.destination === 'image') return contentType.startsWith('image/');
  return true;
};

const isHashedAsset = (request) => (
  /^\/static\/.*\.[a-f0-9]{8,}(?:\.chunk)?\.[^/]+$/i.test(new URL(request.url).pathname)
);

const readCache = async (name, request, validate) => {
  try {
    const cache = await caches.open(name);
    const response = await cache.match(request);
    if (response && validate(response)) return response;
    if (response) await cache.delete(request);
  } catch (_error) {
    // Cache storage can be unavailable or full; online loading must still work.
  }
  return undefined;
};

const saveCache = (event, name, request, response) => {
  const copy = response.clone();
  event.waitUntil(caches.open(name).then((cache) => cache.put(request, copy)).catch(() => {}));
};

const loadNavigation = async (event) => {
  try {
    const response = await fetchFresh(event.request);
    if (isHtmlResponse(response)) {
      saveCache(event, APP_SHELL_CACHE, '/index.html', response);
    } else if (response.status >= 500) {
      const cached = await readCache(APP_SHELL_CACHE, '/index.html', isHtmlResponse);
      if (cached) return cached;
    }
    return response;
  } catch (_error) {
    return (await readCache(APP_SHELL_CACHE, '/index.html', isHtmlResponse)) || Response.error();
  }
};

const loadAsset = async (event, cacheFirst) => {
  const { request } = event;
  const validate = (response) => isValidAsset(request, response);
  if (cacheFirst) {
    const cached = await readCache(ASSET_CACHE, request, validate);
    if (cached) return cached;
  }
  try {
    // Also bypass poisoned entries retained in the browser's HTTP cache.
    const response = await fetchFresh(request);
    if (validate(response)) saveCache(event, ASSET_CACHE, request, response);
    return response;
  } catch (_error) {
    return (await readCache(ASSET_CACHE, request, validate)) || Response.error();
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      // Offline preloading is optional. A full or blocked cache must not keep
      // a broken legacy worker active indefinitely.
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('cy-erp-pwa-') && ![APP_SHELL_CACHE, ASSET_CACHE].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (shouldIgnoreRequest(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(loadNavigation(event));
    return;
  }

  if (isPwaInstallAsset(request)) {
    event.respondWith(loadAsset(event, false));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(loadAsset(event, isHashedAsset(request)));
  }
});

const asObject = (value) => (
  value && typeof value === 'object' ? value : {}
);

const readPushPayload = (event) => {
  if (!event.data) return {};

  try {
    return asObject(event.data.json());
  } catch (_error) {
    return { data: { body: event.data.text() } };
  }
};

const sameOriginNotificationUrl = (candidate) => {
  try {
    const url = new URL(String(candidate || '/finance/bank-notifications'), self.location.origin);
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : '/finance/bank-notifications';
  } catch (_error) {
    return '/finance/bank-notifications';
  }
};

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const notification = asObject(payload.notification);
  const data = asObject(payload.data);
  const title = String(notification.title || data.title || '입출금 알림');
  const body = String(notification.body || data.body || '새 은행 거래가 감지되었습니다.');
  const targetUrl = sameOriginNotificationUrl(
    data.actionUrl || data.url || payload.fcmOptions?.link
  );

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visibleClients = clientList.filter((client) => {
      if (client.visibilityState !== 'visible') return false;
      try {
        return new URL(client.url).pathname === '/finance/bank-notifications';
      } catch (_error) {
        return false;
      }
    });
    if (visibleClients.length > 0) {
      visibleClients.forEach((client) => client.postMessage({
        type: 'BANK_PUSH_MESSAGE',
        payload: {
          notification: { title, body },
          data: { ...data, actionUrl: targetUrl },
        },
      }));
      return;
    }

    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/maskable-icon-192.png',
      tag: String(data.tag || data.candidateId || 'bank-transaction'),
      renotify: true,
      data: {
        ...data,
        url: targetUrl,
      },
    });
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage({ type: 'BANK_PUSH_SUBSCRIPTION_CHANGED' }));
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = sameOriginNotificationUrl(event.notification?.data?.url);
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        const sameOriginClient = clientList.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch (_error) {
            return false;
          }
        });

        if (sameOriginClient) {
          if ('navigate' in sameOriginClient) {
            await sameOriginClient.navigate(targetUrl);
          }
          return sameOriginClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});
