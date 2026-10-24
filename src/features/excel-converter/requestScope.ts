/** Bounds the whole request, including preparation and callers that ignore abort. */
export const CONVERSION_TIMEOUT_MS = 240_000;

export function createRequestScope(timeoutMs = CONVERSION_TIMEOUT_MS) {
  const controller = new AbortController();
  const cancelled = new Error('요청 처리를 중단했습니다.');
  cancelled.name = 'AbortError';
  let failure = cancelled;
  const timer = setTimeout(() => {
    failure = new Error('처리가 4분 안에 완료되지 않았습니다. 요청과 이전 결과는 유지됩니다. 잠시 후 다시 시도하거나 요청을 나누어 주세요.');
    failure.name = 'TimeoutError';
    controller.abort();
  }, timeoutMs);

  const run = <T,>(work: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const signal = controller.signal;
    if (signal.aborted) { reject(failure); return; }
    const abort = () => { signal.removeEventListener('abort', abort); reject(failure); };
    signal.addEventListener('abort', abort, { once: true });
    // Always observe late rejections, even after the user has cancelled.
    Promise.resolve().then(() => {
      if (signal.aborted) throw failure;
      return work();
    }).then(value => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(failure); else resolve(value);
    }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
  return { controller, run, dispose: () => clearTimeout(timer) };
}
