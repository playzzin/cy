const CACHE_VERSION = 'cy-erp-pwa-v4';
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
