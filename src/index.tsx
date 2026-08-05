// Build timestamp: 2026-01-20T16:50:00+09:00 - Force rebuild for menu sync fix
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import AppErrorBoundary from './app/bootstrap/AppErrorBoundary';
import { setupChunkLoadRecovery } from './app/bootstrap/runtimeRecovery';
import { setupDeferredSentry } from './app/bootstrap/sentry';
import { setupPwaInstallPromptCapture } from './pwaInstallPrompt';
import { registerServiceWorker } from './serviceWorkerRegistration';
import { installBrowserDownloadAudit } from './services/fileTransferAuditService';

setupChunkLoadRecovery();
setupPwaInstallPromptCapture();
setupDeferredSentry();
installBrowserDownloadAudit();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
