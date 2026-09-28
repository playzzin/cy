import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { geminiEvent } from '../utils/geminiUsage';
import { geminiUsageLogService, GEMINI_USAGE_CHANGED } from './geminiUsageLogService';
jest.mock('../config/firebase', () => ({ functions: {}, auth: { currentUser: { uid: 'test-user' } } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn(), createDevAdminUser: () => ({ uid: 'dev-admin', displayName: '개발 테스트' }) }));
const callable = jest.fn();
const event = geminiEvent('gemini-3.8-flash', 'excel-conversion', { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200 } }, 20);
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-29T00:00:00Z'));
  localStorage.clear(); jest.clearAllMocks();
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'fixture-usage-request-00001' } });
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
  (httpsCallable as jest.Mock).mockReturnValue(callable); callable.mockResolvedValue({ data: { saved: true } });
  (auth as any).currentUser = { uid: 'test-user' };
  window.history.replaceState({}, '', '/tools/excel?secret=not-saved');
});
afterEach(() => { jest.useRealTimers(); });
it('stores development usage locally, emits a refresh and preserves cost across reads without cloud calls', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  const changed = jest.fn(); window.addEventListener(GEMINI_USAGE_CHANGED, changed);
  await geminiUsageLogService.record(event);
  const page = await geminiUsageLogService.list('2026-01-01', '2026-12-31');
  expect(page.logs).toHaveLength(1);
  expect(page.logs[0]).toEqual(expect.objectContaining({ estimatedUsd: 0.0015, actorUid: 'dev-admin', path: '/tools/excel' }));
  expect(changed).toHaveBeenCalledTimes(1); expect(httpsCallable).not.toHaveBeenCalled();
  expect((await geminiUsageLogService.list('2025-01-01', '2025-12-31')).logs).toHaveLength(0);
  window.removeEventListener(GEMINI_USAGE_CHANGED, changed);
});
it('reports only metadata to the authenticated collector, leaving identity and price to the server', async () => {
  await geminiUsageLogService.record(event);
  expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'recordGeminiClientUsage', { timeout: 10000 });
  expect(callable).toHaveBeenCalledWith({ ...event, requestId: 'fixture-usage-request-00001', path: '/tools/excel' });
  (auth as any).currentUser = null; callable.mockClear();
  await geminiUsageLogService.record(event); expect(callable).not.toHaveBeenCalled();
});
