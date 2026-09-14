import { SUPPORT_WRITE_RETRY_USER_MESSAGE, getErrorMessage, reportSupportWriteError, sanitizeSupportWriteMetadata } from './supportWriteErrorReporting';

describe('closed support diagnostics (no SDK required)', () => {
  it('does not inspect exceptions or context getters, even when observers throw', () => {
    const read = jest.fn(() => { throw new Error('private'); });
    const hostile = Object.defineProperties({}, { message: { get: read }, domain: { get: read }, metadata: { get: read } });
    const output = jest.spyOn(console, 'error').mockImplementation(() => { throw hostile; });
    try {
      expect(() => reportSupportWriteError(hostile, hostile as any)).not.toThrow();
      expect(read).not.toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith('[support-write-operation]', { domain: 'unknown', errorCode: 'SUPPORT_WRITE_UNKNOWN' });
    } finally { output.mockRestore(); }
  });
  it('retains only finite counts, closed stages/statuses and boolean retry flags', () => {
    const read = jest.fn();
    const metadata = Object.defineProperty({ stage: 'billing', status: 'unknown', completedCount: 2,
      failedCount: -1, protectedCount: Infinity, retryAllowed: false, replayed: true,
      name: 'private', email: 'private', memo: 'private', amount: 200, attachment: 'private',
      nested: { completedCount: 5 }, request: {} }, 'error', { get: read });
    expect(sanitizeSupportWriteMetadata(metadata)).toEqual({ stage: 'billing', status: 'unknown', completedCount: 2, retryAllowed: false, replayed: true });
    expect(sanitizeSupportWriteMetadata({ stage: 'private', status: 'private', retryAllowed: 'yes' })).toEqual({});
    expect(read).not.toHaveBeenCalled();
  });
  it('does not serialize or coerce a hostile proxy', () => {
    const read = jest.fn(() => { throw new Error('private'); });
    const hostile = new Proxy({}, { get: read, getPrototypeOf: read, ownKeys: read });
    const output = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      reportSupportWriteError(hostile, { domain: 'card', operationId: 'private', yearMonth: '2026-07', metadata: hostile });
      expect(read).not.toHaveBeenCalled();
    } finally { output.mockRestore(); }
  });
});

it('preserves the exact original shared retry message without caller migration', () => {
  expect(SUPPORT_WRITE_RETRY_USER_MESSAGE).toBe('저장에 실패했습니다. 같은 화면에서 잠시 후 다시 시도해 주세요. 문제가 반복되면 작업 시간과 화면명을 관리자에게 전달해 주세요.');
});

it('preserves the protected accommodation branch message', () => {
  const marker = 'accommodation-billing-protected-modification-blocked';
  expect(getErrorMessage(new Error(marker))).toContain(marker);
  expect(getErrorMessage(marker)).toBe(marker);
  expect(getErrorMessage({ code: 'protected', name: 'Error', message: marker })).toContain(marker);
});

it('does not emit raw errors, IDs, money or arbitrary context', () => {
  const output = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    reportSupportWriteError(new Error('private-error'), { domain: 'card', yearMonth: '2026-07', operationId: 'private-id', metadata: { amount: 123, memo: 'private' } });
    expect(output.mock.calls).toEqual([['[support-write-operation]', { domain: 'card', errorCode: 'SUPPORT_WRITE_UNKNOWN' }]]);
  } finally { output.mockRestore(); }
});
