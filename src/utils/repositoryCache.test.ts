import { createRepositoryCache } from './repositoryCache';

describe('repositoryCache', () => {
  it('returns cached values until ttl expires', async () => {
    let currentTime = 1000;
    const cache = createRepositoryCache<string>({
      ttlMs: 100,
      now: () => currentTime,
    });

    cache.set('sites', 'cached');

    expect(cache.get('sites')).toBe('cached');

    currentTime = 1101;
    expect(cache.get('sites')).toBeNull();
  });

  it('deduplicates concurrent loader calls for the same key', async () => {
    const cache = createRepositoryCache<number>({ ttlMs: 1000 });
    const loader = jest.fn(async () => 42);

    const [left, right] = await Promise.all([
      cache.getOrSet('tasks', loader),
      cache.getOrSet('tasks', loader),
    ]);

    expect(left).toBe(42);
    expect(right).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('clears one key or the entire cache', () => {
    const cache = createRepositoryCache<string>({ ttlMs: 1000 });

    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.clear('a');

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('B');

    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
