import { isChunkLoadError } from './runtimeRecovery';

describe('runtimeRecovery', () => {
  it('detects browser and webpack dynamic import failures', () => {
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 42 failed'))).toBe(true);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
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
