const CACHE_PREFIX = 'cy-erp-pwa-';

async function clearAppCaches() {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  );
}

async function clearDevelopmentServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  const hadController = Boolean(navigator.serviceWorker.controller);

  await Promise.all(registrations.map((registration) => registration.unregister()));
  await clearAppCaches();

  if (hadController && registrations.length > 0) {
    window.location.reload();
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    window.addEventListener('load', () => {
      clearDevelopmentServiceWorkers().catch((error) => {
        console.warn('Development service worker cleanup failed:', error);
      });
    });
    return;
  }

  window.addEventListener('load', () => {
    const publicUrl = process.env.PUBLIC_URL || '';
    const serviceWorkerUrl = `${publicUrl}/service-worker.js`;

    navigator.serviceWorker
      .register(serviceWorkerUrl, { updateViaCache: 'none' })
      .then((registration) => {
        registration.update().catch((error) => {
          console.warn('Service worker update check failed:', error);
        });
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  });
}
