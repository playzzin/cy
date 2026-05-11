type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

type Listener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let captureSetup = false;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener());
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
  if (installed) return true;

  return isRunningAsStandaloneApp();
};

export const getInstallPrompt = () => deferredPrompt;

export const subscribeToInstallPrompt = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setupPwaInstallPromptCapture = () => {
  if (typeof window === 'undefined' || captureSetup) return;
  captureSetup = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
};

export const promptPwaInstall = async () => {
  if (!deferredPrompt) {
    return 'unavailable' as const;
  }

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice.outcome === 'accepted') {
    installed = true;
  }

  notify();
  return choice.outcome;
};
