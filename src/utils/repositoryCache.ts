export interface RepositoryCacheOptions {
  ttlMs: number;
  now?: () => number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface RepositoryCache<T> {
  get: (key: string) => T | null;
  set: (key: string, value: T) => void;
  getOrSet: (key: string, loader: () => Promise<T>) => Promise<T>;
  clear: (key?: string) => void;
  size: () => number;
}

export const createRepositoryCache = <T>({
  ttlMs,
  now = () => Date.now(),
}: RepositoryCacheOptions): RepositoryCache<T> => {
  const cache = new Map<string, CacheEntry<T>>();
  const pending = new Map<string, Promise<T>>();

  const get = (key: string): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  };

  const set = (key: string, value: T) => {
    cache.set(key, {
      value,
      expiresAt: now() + Math.max(0, ttlMs),
    });
  };

  const clear = (key?: string) => {
    if (key) {
      cache.delete(key);
      pending.delete(key);
      return;
    }
    cache.clear();
    pending.clear();
  };

  const getOrSet = async (key: string, loader: () => Promise<T>): Promise<T> => {
    const cached = get(key);
    if (cached !== null) return cached;

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const promise = loader()
      .then((value) => {
        set(key, value);
        return value;
      })
      .finally(() => {
        pending.delete(key);
      });

    pending.set(key, promise);
    return promise;
  };

  return {
    get,
    set,
    getOrSet,
    clear,
    size: () => cache.size,
  };
};
