type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

type Listener = () => void;

type InstallPromptState = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  captureSetup: boolean;
  listeners: Set<Listener>;
};

declare global {
  interface Window {
    __cyPwaInstallState?: InstallPromptState;
  }
}

const fallbackState: InstallPromptState = {
  deferredPrompt: null,
  installed: false,
  captureSetup: false,
  listeners: new Set<Listener>()
};

const getState = () => {
  if (typeof window === 'undefined') return fallbackState;
  return window.__cyPwaInstallState ?? (window.__cyPwaInstallState = fallbackState);
};
const PWA_CACHE_PREFIX = 'cy-erp-pwa-';
const PWA_INSTALL_ASSET_PATHS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon-192.png',
  '/icons/maskable-icon-512.png'
];

const notify = () => {
  getState().listeners.forEach((listener) => listener());
};

export const isRunningAsStandaloneApp = () => {
  if (typeof window === 'undefined') return false;

  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
  const navigatorStandalone = 'standalone' in window.navigator
    ? Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    : false;

  return Boolean(standaloneMedia || navigatorStandalone);
};

export const isAppInstalled = () => {
  if (getState().installed) return true;

  return isRunningAsStandaloneApp();
};

export const getInstallPrompt = () => getState().deferredPrompt;

export const getPwaInstallStatus = () => {
  if (isAppInstalled()) return 'installed' as const;
  return getInstallPrompt() ? 'ready' as const : 'waiting' as const;
};

export const subscribeToInstallPrompt = (listener: Listener) => {
  const { listeners } = getState();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getPublicAssetUrl = (path: string, version: string) => {
  const publicUrl = process.env.PUBLIC_URL || '';
  const url = new URL(`${publicUrl}${path}`, window.location.origin);
  url.searchParams.set('v', version);
  return url.toString();
};

const refreshLinkedPwaMetadata = (version: string) => {
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.href = getPublicAssetUrl('/manifest.json', version);
  }

  document
    .querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]')
    .forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || !href.includes('/icons/')) return;

      const url = new URL(href, window.location.origin);
      url.searchParams.set('v', version);
      link.href = url.toString();
    });
};

export const refreshPwaInstallAssets = async () => {
  if (typeof window === 'undefined') return;

  const version = String(Date.now());
  refreshLinkedPwaMetadata(version);

  const tasks: Promise<unknown>[] = [];

  if ('caches' in window) {
    tasks.push(
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(PWA_CACHE_PREFIX))
          .map((cacheName) => caches.delete(cacheName))
      ))
    );
  }

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
        registrations.map((registration) => registration.update())
      ))
    );
  }

  await Promise.all(tasks.map((task) => task.catch(() => undefined)));

  await Promise.all(
    PWA_INSTALL_ASSET_PATHS.map((path) =>
      fetch(getPublicAssetUrl(path, version), {
        cache: 'reload',
        credentials: 'same-origin'
      }).catch(() => undefined)
    )
  );
};

export const setupPwaInstallPromptCapture = () => {
  if (typeof window === 'undefined') return;
  const state = getState();
  if (state.captureSetup) return;
  state.captureSetup = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event as BeforeInstallPromptEvent;
    state.installed = false;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    state.installed = true;
    state.deferredPrompt = null;
    notify();
  });
};

export const promptPwaInstall = async () => {
  const state = getState();
  if (!state.deferredPrompt) {
    return 'unavailable' as const;
  }

  const promptEvent = state.deferredPrompt;
  state.deferredPrompt = null;
  notify();

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  notify();
  return choice.outcome;
};
