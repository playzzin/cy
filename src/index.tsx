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
