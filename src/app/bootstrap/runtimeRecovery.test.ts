import { isChunkLoadError } from './runtimeRecovery';

describe('runtimeRecovery', () => {
  it('detects browser and webpack dynamic import failures', () => {
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 42 failed'))).toBe(true);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
    expect(isChunkLoadError('Loading CSS chunk 42 failed.')).toBe(true);
    expect(isChunkLoadError({ code: 'CSS_CHUNK_LOAD_FAILED', message: 'Loading CSS chunk 42 failed.' })).toBe(true);
    expect(isChunkLoadError(new Error('permission-denied'))).toBe(false);
  });

  it('finds a chunk failure in a nested rejection reason', () => {
    expect(isChunkLoadError({
      message: 'route failed',
      reason: new Error('Importing a module script failed'),
    })).toBe(true);
  });

  it('handles cyclic rejection objects without recursing forever', () => {
    const cyclic: { message: string; reason?: unknown } = { message: 'ordinary failure' };
    cyclic.reason = cyclic;

    expect(isChunkLoadError(cyclic)).toBe(false);
  });
});

describe('asset recovery', () => {
  const location = window.location;
  const workerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  const cacheDescriptor = Object.getOwnPropertyDescriptor(window, 'caches');
  let reload: jest.Mock;
  let deleteCache: jest.Mock;
  let update: jest.Mock;
  let unrelatedUpdate: jest.Mock;
  let recover: typeof import('./runtimeRecovery').recoverFromChunkLoadError;
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers('modern');
    jest.setSystemTime(1700000000000);
    window.sessionStorage.clear();
    reload = jest.fn();
    Reflect.deleteProperty(window, 'location');
    Object.defineProperty(window, 'location', { configurable: true, value: { origin: location.origin, reload } });
    document.head.innerHTML = '<script src="/static/js/main.deadbeef.js"></script>';
    deleteCache = jest.fn().mockResolvedValue(true);
    update = jest.fn().mockResolvedValue(undefined);
    unrelatedUpdate = jest.fn();
    Object.defineProperty(window, 'caches', { configurable: true, value: {
      keys: jest.fn().mockResolvedValue(['cy-erp-pwa-v4-assets', 'unrelated-cache']), delete: deleteCache,
    } });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      getRegistrations: jest.fn().mockResolvedValue([
        { active: { scriptURL: `${location.origin}/service-worker.js` }, update },
        { active: { scriptURL: `${location.origin}/other/service-worker.js` }, update: unrelatedUpdate },
      ]),
    } });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    recover = require('./runtimeRecovery').recoverFromChunkLoadError;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    Object.defineProperty(window, 'location', { configurable: true, value: location });
    for (const [target, key, descriptor] of [
      [navigator, 'serviceWorker', workerDescriptor], [navigator, 'onLine', onlineDescriptor], [window, 'caches', cacheDescriptor],
    ] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
    document.head.innerHTML = '';
  });

  it('recovers once, clearing only app file caches while retaining user storage', async () => {
    window.localStorage.setItem('runtime-test-preference', 'keep');
    window.sessionStorage.setItem('runtime-test-draft', 'keep');
    expect(recover()).toBe(true);
    expect(recover()).toBe(false);
    await flush();
    expect(deleteCache.mock.calls).toEqual([['cy-erp-pwa-v4-assets']]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(unrelatedUpdate).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('runtime-test-preference')).toBe('keep');
    expect(window.sessionStorage.getItem('runtime-test-draft')).toBe('keep');
    window.localStorage.removeItem('runtime-test-preference');
  });

  it('prevents another automatic reload of the same runtime even after a slow reload', async () => {
    recover();
    await flush();
    jest.resetModules();
    jest.setSystemTime(Date.now() + 60000);
    const nextDocument = require('./runtimeRecovery');
    expect(nextDocument.recoverFromChunkLoadError()).toBe(false);
    expect(nextDocument.recoverFromChunkLoadError({ manual: true })).toBe(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('permits recovery after the application runtime changes', async () => {
    recover();
    await flush();
    jest.resetModules();
    jest.setSystemTime(Date.now() + 60000);
    document.head.innerHTML = '<script src="/static/js/main.abcdef12.js"></script>';
    expect(require('./runtimeRecovery').recoverFromChunkLoadError()).toBe(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('bounds a stalled worker update instead of leaving recovery stuck forever', async () => {
    update.mockReturnValue(new Promise(() => {}));
    expect(recover()).toBe(true);
    await flush();
    expect(reload).not.toHaveBeenCalled();
    jest.advanceTimersByTime(4000);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not discard the current screen automatically while offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    expect(recover()).toBe(false);
    expect(deleteCache).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('allows explicit recovery when tab storage is unavailable without an automatic loop', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(recover()).toBe(false);
    expect(recover({ manual: true })).toBe(true);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
