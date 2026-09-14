/* eslint-env es2020, serviceworker */
// Enable local PWA installation without caching development bundles or API responses.
globalThis.addEventListener('install', () => globalThis.skipWaiting());
globalThis.addEventListener('activate', (event) => event.waitUntil(globalThis.clients.claim()));
globalThis.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== globalThis.location.origin) return;
  event.respondWith(fetch(event.request));
});
