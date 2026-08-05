const APP_CACHE_PREFIX = 'cy-erp-pwa-';
const CHUNK_RECOVERY_KEY = 'cy-erp-chunk-recovery-at';
const CHUNK_RECOVERY_GUARD_MS = 15000;

let inMemoryLastRecoveryAt = 0;

const errorText = (error: unknown, seen = new WeakSet<object>()): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (!error || typeof error !== 'object') return '';
  if (seen.has(error)) return '';

  seen.add(error);
  const candidate = error as { name?: unknown; message?: unknown; reason?: unknown };
  return [candidate.name, candidate.message, errorText(candidate.reason, seen)]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ');
};

export const isChunkLoadError = (error: unknown): boolean => (
  /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    errorText(error),
  )
);

const readLastRecoveryAt = (): number => {
  try {
    return Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) ?? 0);
  } catch {
    return inMemoryLastRecoveryAt;
  }
};

const writeLastRecoveryAt = (value: number) => {
  inMemoryLastRecoveryAt = value;
  try {
    window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(value));
  } catch {
    // Some privacy modes block sessionStorage. The in-memory guard still
    // prevents a reload loop for the lifetime of the current document.
  }
};

const refreshRuntimeAssets = async () => {
  const tasks: Promise<unknown>[] = [];

  if ('caches' in window) {
    tasks.push(
      caches.keys().then((cacheNames) => Promise.allSettled(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(APP_CACHE_PREFIX))
          .map((cacheName) => caches.delete(cacheName)),
      )),
    );
  }

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) => Promise.allSettled(
        registrations
          .filter((registration) => {
            try {
              return new URL(registration.scope).origin === window.location.origin;
            } catch {
              return false;
            }
          })
          .map((registration) => registration.update()),
      )),
    );
  }

  await Promise.allSettled(tasks);
};

export const recoverFromChunkLoadError = (): boolean => {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (now - readLastRecoveryAt() < CHUNK_RECOVERY_GUARD_MS) {
    return false;
  }

  writeLastRecoveryAt(now);
  void refreshRuntimeAssets().finally(() => {
    window.location.reload();
  });
  return true;
};

export const setupChunkLoadRecovery = () => {
  const handleError = (event: ErrorEvent) => {
    if (!isChunkLoadError(event.error ?? event.message)) return;
    if (recoverFromChunkLoadError()) event.preventDefault();
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!isChunkLoadError(event.reason)) return;
    if (recoverFromChunkLoadError()) event.preventDefault();
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
};
