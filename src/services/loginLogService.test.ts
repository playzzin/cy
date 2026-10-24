import { Timestamp, doc, setDoc, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { systemMessageService } from './systemMessageService';
import { loginLogService } from './loginLogService';

jest.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn(() => false), createDevAdminUser: () => ({ uid: 'dev-admin', email: 'dev-admin@localhost', displayName: '개발자 관리자' }) }));
jest.mock('./systemMessageService', () => ({ systemMessageService: { notifyLoginLogEvent: jest.fn() } }));
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  collection: jest.fn(), doc: jest.fn(() => ({ id: 'test-log' })), setDoc: jest.fn(),
  query: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), getDocs: jest.fn(), onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (auth as any).currentUser = { uid: 'user-a', email: 'a@example.test', displayName: '테스트' };
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(false);
  (setDoc as jest.Mock).mockResolvedValue(undefined);
  (doc as jest.Mock).mockReturnValue({ id: 'test-log' });
  (serverTimestamp as jest.Mock).mockReturnValue('SERVER_TIMESTAMP');
  window.localStorage.clear();
  window.history.replaceState({}, '', '/admin/login-logs');
});

it('persists the authenticated actor and server time while stripping query strings and fragments', async () => {
  window.history.replaceState({}, '', '/admin/login-logs?token=private-token#private-fragment');
  const referrer = jest.spyOn(document, 'referrer', 'get').mockReturnValue('https://example.test/login?code=private-code#private-fragment');
  const log = await loginLogService.createLog({ action: 'session_access', method: 'session_restore' });
  expect(setDoc).toHaveBeenCalledWith({ id: 'test-log' }, expect.objectContaining({ createdAt: 'SERVER_TIMESTAMP', actor: expect.objectContaining({ uid: 'user-a' }) }));
  expect(serverTimestamp).toHaveBeenCalled();
  expect(log.client.path).toBe('/admin/login-logs');
  expect(log.client.referrer).toBe('https://example.test/login');
  expect(JSON.stringify((setDoc as jest.Mock).mock.calls)).not.toContain('private');
  expect(systemMessageService.notifyLoginLogEvent).not.toHaveBeenCalled();
  referrer.mockRestore();
});

it('never attributes a failed login attempt to a different already signed-in account', async () => {
  const log = await loginLogService.createLog({ action: 'login_failed', email: 'attempt@example.test', errorCode: 'auth/invalid-credential' });
  expect(log.actor.uid).toBeNull();
  expect(log.actor.email).toBe('attempt@example.test');
  expect(log.actor.displayName).toBe('attempt@example.test');
});

it('reports an audit write failure without throwing it into authentication', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  (setDoc as jest.Mock).mockRejectedValue(new Error('permission denied'));
  await expect(loginLogService.safeCreateLog({ action: 'login_success' })).resolves.toBe(false);
  warn.mockRestore();
});

it('round-trips developer access records locally and updates the open history without production writes', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  const receive = jest.fn();
  const stop = loginLogService.subscribeRecentLogs(receive);
  const saved = await loginLogService.createLog({ action: 'session_access' });
  expect(receive).toHaveBeenLastCalledWith([expect.objectContaining({ action: 'session_access', actor: expect.objectContaining({ uid: 'dev-admin' }) })]);
  const rows = await loginLogService.getRecentLogs();
  expect(rows[0].createdAt.toMillis()).toBe(saved.createdAt.toMillis());
  expect(setDoc).not.toHaveBeenCalled();
  expect(onSnapshot).not.toHaveBeenCalled();
  expect(systemMessageService.notifyLoginLogEvent).not.toHaveBeenCalled();
  stop();
  const calls = receive.mock.calls.length;
  await loginLogService.createLog({ action: 'logout' });
  expect(receive).toHaveBeenCalledTimes(calls);
});

it('uses the original ISO date for legacy or pending timestamps instead of pretending the record is new', async () => {
  (getDocs as jest.Mock).mockResolvedValue({ docs: [{ id: 'old', data: () => ({ action: 'login_success', createdAtIso: '2025-01-01T00:00:00Z' }) }] });
  expect((await loginLogService.getRecentLogs())[0].createdAt).toEqual(Timestamp.fromDate(new Date('2025-01-01T00:00:00Z')));
});
