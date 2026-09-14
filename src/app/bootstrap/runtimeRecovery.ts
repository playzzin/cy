const APP_CACHE_PREFIX = 'cy-erp-pwa-';
const CHUNK_RECOVERY_KEY = 'cy-erp-chunk-recovery-at';
const CHUNK_RECOVERY_RUNTIME_KEY = 'cy-erp-chunk-recovery-runtime';
const CHUNK_RECOVERY_GUARD_MS = 15000;
const ASSET_REFRESH_TIMEOUT_MS = 4000;

let inMemoryLastRecoveryAt = 0;
let recoveryStarted = false;

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
  /ChunkLoadError|CSS_CHUNK_LOAD_FAILED|Loading (?:CSS )?chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
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

const currentRuntime = (): string => (
  Array.from(document.scripts).find((script) => /\/static\/js\/main\.[^/]+\.js(?:\?|$)/.test(script.src))?.src
    || window.location.origin
);

const reserveRecovery = (now: number, manual: boolean): boolean => {
  if (recoveryStarted || (!manual && navigator.onLine === false)) return false;
  try {
    const runtime = currentRuntime();
    // A time-only guard loops when a slow page takes longer than the guard
    // to load. Attempt automatic recovery only once per runtime in this tab.
    if (!manual && (window.sessionStorage.getItem(CHUNK_RECOVERY_RUNTIME_KEY) === runtime
      || now - readLastRecoveryAt() < CHUNK_RECOVERY_GUARD_MS)) return false;
    window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(now));
    window.sessionStorage.setItem(CHUNK_RECOVERY_RUNTIME_KEY, runtime);
  } catch {
    // Without persistent tab storage we cannot prevent an automatic reload
    // loop across documents. The explicit recovery button remains available.
    if (!manual) return false;
  }
  inMemoryLastRecoveryAt = now;
  recoveryStarted = true;
  return true;
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
              const worker = registration.active || registration.waiting || registration.installing;
              const expected = new URL(`${process.env.PUBLIC_URL || ''}/service-worker.js`, window.location.origin);
              return Boolean(worker && new URL(worker.scriptURL).href === expected.href);
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

export const recoverFromChunkLoadError = (options: { manual?: boolean } = {}): boolean => {
  if (typeof window === 'undefined') return false;

  if (!reserveRecovery(Date.now(), options.manual === true)) return false;

  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, ASSET_REFRESH_TIMEOUT_MS);
  });
  void Promise.race([refreshRuntimeAssets(), deadline]).finally(() => {
    clearTimeout(timeout);
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
