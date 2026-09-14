const CACHE_PREFIX = 'cy-erp-pwa-';
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

async function clearAppCaches() {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  );
}

async function registerDevelopmentServiceWorker() {
  const publicUrl = process.env.PUBLIC_URL || '';
  const workerUrl = new URL(`${publicUrl}/pwa-development-worker.js`, window.location.origin).href;
  const registrations = await navigator.serviceWorker.getRegistrations();
  const previousController = navigator.serviceWorker.controller;
  const hadLegacyController = previousController && previousController.scriptURL !== workerUrl;

  await Promise.all(registrations
    .filter((registration) =>
      (registration.active || registration.waiting || registration.installing)?.scriptURL !== workerUrl)
    .map((registration) => registration.unregister()));
  await clearAppCaches();
  const registration = await navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' });
  await registration.update();

  if (hadLegacyController && registrations.length > 0) {
    window.location.reload();
  }
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const registerForDevelopment = () => {
      registerDevelopmentServiceWorker().catch((error) => {
        console.warn('Development PWA service worker registration failed:', error);
      });
    };
    if (document.readyState === 'complete') registerForDevelopment();
    else window.addEventListener('load', registerForDevelopment, { once: true });
    return;
  }

  const registerForProduction = () => {
    const publicUrl = process.env.PUBLIC_URL || '';
    const serviceWorkerUrl = `${publicUrl}/service-worker.js`;

    navigator.serviceWorker
      .register(serviceWorkerUrl, { updateViaCache: 'none' })
      .then((registration) => {
        let lastCheckAt = 0;
        let updating = false;
        const checkForUpdate = (force = false) => {
          if (updating || navigator.onLine === false) return;
          const now = Date.now();
          if (!force && now - lastCheckAt < UPDATE_CHECK_INTERVAL_MS) return;
          updating = true;
          lastCheckAt = now;
          void registration.update()
            .catch((error) => console.warn('Service worker update check failed:', error))
            .finally(() => { updating = false; });
        };
        checkForUpdate(true);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        window.addEventListener('online', () => checkForUpdate(true));
        // New workers can serve the current document's hashed assets. Reload
        // only on an actual chunk failure, preserving healthy forms and drafts.
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  };
  if (document.readyState === 'complete') registerForProduction();
  else window.addEventListener('load', registerForProduction, { once: true });
}
