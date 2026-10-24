import { createLoginAccessTracker, writeLogoutLog } from './loginAccessTracker';
import { loginLogService } from './loginLogService';

jest.mock('./loginLogService', () => ({ loginLogService: { safeCreateLog: jest.fn() } }));
const user = { uid: 'user-a', email: 'a@example.test', displayName: '테스트 사용자', photoURL: null, providerData: [{ providerId: 'password' }] } as any;

it('records a restored session once across duplicate auth callbacks and again in a new page', async () => {
  const write = jest.fn(async () => true);
  const tracker = createLoginAccessTracker(write);
  tracker.observe(user);
  tracker.observe(user);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ action: 'session_access', method: 'session_restore', user: expect.objectContaining({ uid: 'user-a' }) }));
  createLoginAccessTracker(write).observe(user);
  expect(write).toHaveBeenCalledTimes(2);
});

it.each(['before', 'after'] as const)('does not double-count an interactive login when the auth callback occurs %s its result', (timing) => {
  const write = jest.fn(async () => true);
  const tracker = createLoginAccessTracker(write);
  const finish = tracker.beginInteractiveLogin();
  if (timing === 'before') tracker.observe(user);
  finish(user);
  if (timing === 'after') tracker.observe(user);
  finish();
  expect(write).not.toHaveBeenCalled();
});

it('records account changes and sign-in after logout, without attributing an old account to a new login', () => {
  const write = jest.fn(async () => true);
  const tracker = createLoginAccessTracker(write);
  tracker.observe(user);
  const second = { ...user, uid: 'user-b' };
  const finish = tracker.beginInteractiveLogin();
  finish(second);
  tracker.observe(second);
  expect(write).toHaveBeenCalledTimes(1);
  tracker.observe(null);
  tracker.observe(second);
  expect(write).toHaveBeenCalledTimes(2);
});

it('keeps an existing session observable after an interactive login fails', () => {
  const write = jest.fn(async () => true);
  const tracker = createLoginAccessTracker(write);
  const finish = tracker.beginInteractiveLogin();
  tracker.observe(user);
  finish();
  expect(write).toHaveBeenCalledTimes(1);
});

it('allows a subsequent callback to retry a failed access write', async () => {
  const write = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const tracker = createLoginAccessTracker(write);
  tracker.observe(user);
  await Promise.resolve();
  await Promise.resolve();
  tracker.observe(user);
  expect(write).toHaveBeenCalledTimes(2);
});

it('bounds logout logging when the connection never completes', async () => {
  jest.useFakeTimers();
  (loginLogService.safeCreateLog as jest.Mock).mockReturnValue(new Promise(() => undefined));
  const pending = writeLogoutLog({ action: 'logout', user });
  jest.advanceTimersByTime(2000);
  await expect(pending).resolves.toBeUndefined();
  jest.useRealTimers();
});

it('does not let an older failed access write clear a newer successful login', async () => {
  let fail!: (saved: boolean) => void;
  const write = jest.fn(() => new Promise<boolean>((resolve) => { fail = resolve; }));
  const tracker = createLoginAccessTracker(write);
  tracker.observe(user);
  tracker.beginInteractiveLogin()(user);
  fail(false);
  await Promise.resolve();
  await Promise.resolve();
  tracker.observe(user);
  expect(write).toHaveBeenCalledTimes(1);
});
