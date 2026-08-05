type DeferredStartupOptions = {
  delayMs?: number;
  idleTimeoutMs?: number;
};

export const scheduleAfterInitialLoad = (
  task: () => void,
  { delayMs = 0, idleTimeoutMs = 3000 }: DeferredStartupOptions = {}
) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const schedule = () => {
    window.setTimeout(() => {
      const requestIdleCallback = (window as any).requestIdleCallback;
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(task, { timeout: idleTimeoutMs });
        return;
      }

      task();
    }, delayMs);
  };

  if (document.readyState === 'complete') {
    schedule();
    return;
  }

  window.addEventListener('load', schedule, { once: true });
};
