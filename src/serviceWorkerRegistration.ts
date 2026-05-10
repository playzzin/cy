export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const publicUrl = process.env.PUBLIC_URL || '';
    const serviceWorkerUrl = `${publicUrl}/service-worker.js`;

    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
