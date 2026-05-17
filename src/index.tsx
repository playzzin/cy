import * as Sentry from "@sentry/react";
// Build timestamp: 2026-01-20T16:50:00+09:00 - Force rebuild for menu sync fix
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupPwaInstallPromptCapture } from './pwaInstallPrompt';
import { registerServiceWorker } from './serviceWorkerRegistration';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { AuthProvider } from './contexts/AuthContext';

const CHUNK_RECOVERY_KEY = 'cy-erp-chunk-recovery-at';
const CHUNK_RECOVERY_WINDOW_MS = 10000;

function getErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (error && typeof error === 'object') {
    const maybeError = error as { name?: unknown; message?: unknown; reason?: unknown };
    return [maybeError.name, maybeError.message, getErrorText(maybeError.reason)]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' ');
  }
  return '';
}

function isChunkLoadError(error: unknown): boolean {
  return /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    getErrorText(error),
  );
}

async function clearRuntimeCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

function recoverFromChunkLoadError() {
  const lastRecoveryAt = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? 0);
  const now = Date.now();

  if (now - lastRecoveryAt < CHUNK_RECOVERY_WINDOW_MS) {
    return;
  }

  window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now));
  void clearRuntimeCaches().finally(() => {
    window.location.reload();
  });
}

function setupChunkLoadRecovery() {
  window.addEventListener('error', (event) => {
    if (!isChunkLoadError(event.error ?? event.message)) return;
    event.preventDefault();
    recoverFromChunkLoadError();
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    recoverFromChunkLoadError();
  });
}

// Add all Font Awesome solid icons to the library
library.add(fas);


Sentry.init({
  dsn: "https://7c5adaa2e7b902a5a3e84ce1f4bd0fb5@o4510608324100096.ingest.us.sentry.io/4510608412770304",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

setupChunkLoadRecovery();
setupPwaInstallPromptCapture();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
