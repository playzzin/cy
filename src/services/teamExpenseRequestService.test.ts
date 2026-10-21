import { httpsCallable } from 'firebase/functions';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { teamExpenseRequestService } from './teamExpenseRequestService';
import { auth } from '../config/firebase';

jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'office' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));

const session = auth as unknown as { currentUser: { uid: string } | null };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (cause: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => { jest.resetAllMocks(); session.currentUser = { uid: 'office' }; });

test('sample mode never invokes a real expense endpoint even if an auth session remains', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  await expect(teamExpenseRequestService.list('2026-09')).rejects.toThrow('개발용 샘플 계정');
  await expect(teamExpenseRequestService.review('request-a', 'approved', '')).rejects.toThrow('실제 팀장 또는 사무실 계정');
  expect(httpsCallable).not.toHaveBeenCalled();
});

test('authenticated list keeps the selected month and billing directory request', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { requests: [] } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  await expect(teamExpenseRequestService.list('2026-09')).resolves.toEqual({ requests: [] });
  expect(invoke).toHaveBeenCalledWith({ action: 'list', yearMonth: '2026-09', includeBillingTeams: true, includePaymentCards: true });
});

test('같은 세션·월·페이지의 진행 중 조회만 공유하고 완료 결과는 저장하지 않는다', async () => {
  const pending = deferred<{ data: { requests: never[] } }>();
  const invoke = jest.fn().mockReturnValue(pending.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamExpenseRequestService.list('2026-09');
  const replay = teamExpenseRequestService.list('2026-09');
  expect(replay).toBe(first);
  expect(invoke).toHaveBeenCalledTimes(1);
  const otherMonth = teamExpenseRequestService.list('2026-08');
  const otherPage = teamExpenseRequestService.list('2026-09', 'next-page');
  expect(invoke).toHaveBeenCalledTimes(3);
  pending.resolve({ data: { requests: [] } });
  await Promise.all([first, replay, otherMonth, otherPage]);
  await teamExpenseRequestService.list('2026-09');
  expect(invoke).toHaveBeenCalledTimes(4);
});

test('실패한 조회는 공유 대상에서 제거하여 다음 요청으로 재시도한다', async () => {
  const pending = deferred<{ data: { requests: never[] } }>();
  const invoke = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ data: { requests: [] } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamExpenseRequestService.list('2026-09');
  expect(teamExpenseRequestService.list('2026-09')).toBe(first);
  pending.reject(new Error('일시적인 조회 실패'));
  await expect(first).rejects.toThrow('일시적인 조회 실패');
  await expect(teamExpenseRequestService.list('2026-09')).resolves.toEqual({ requests: [] });
  expect(invoke).toHaveBeenCalledTimes(2);
});

test('명시적 새로고침은 진행 중 조회와 별도로 최신 권한과 내역을 요청한다', async () => {
  const pending = deferred<{ data: { requests: never[] } }>();
  const invoke = jest.fn().mockReturnValue(pending.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamExpenseRequestService.list('2026-09');
  const fresh = teamExpenseRequestService.list('2026-09', undefined, { forceReload: true });
  expect(fresh).not.toBe(first);
  expect(teamExpenseRequestService.list('2026-09')).toBe(fresh);
  expect(invoke).toHaveBeenCalledTimes(2);
  pending.resolve({ data: { requests: [] } });
  await Promise.all([first, fresh]);
});

test('승인 시작과 완료 시 진행 중 조회를 무효화한다', async () => {
  const pending = deferred<{ data: { requests: never[] } }>();
  const review = deferred<{ data: {} }>();
  const invoke = jest.fn((input: { action: string }) => input.action === 'review' ? review.promise : pending.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const before = teamExpenseRequestService.list('2026-09');
  const approval = teamExpenseRequestService.review('request-a', 'approved', '');
  const during = teamExpenseRequestService.list('2026-09');
  expect(during).not.toBe(before);
  review.resolve({ data: {} });
  await approval;
  const after = teamExpenseRequestService.list('2026-09');
  expect(after).not.toBe(during);
  expect(invoke.mock.calls.filter(([input]) => input.action === 'list')).toHaveLength(3);
  pending.resolve({ data: { requests: [] } });
  await Promise.all([before, during, after]);
});

test.each(['other-user', 'office'])('계정 변경 또는 동일 계정 재로그인 시 이전 세션 응답을 폐기한다: %s', async uid => {
  const pending = deferred<{ data: { requests: never[] } }>();
  const invoke = jest.fn().mockReturnValue(pending.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const previous = teamExpenseRequestService.list('2026-09');
  session.currentUser = { uid };
  const current = teamExpenseRequestService.list('2026-09');
  expect(current).not.toBe(previous);
  expect(invoke).toHaveBeenCalledTimes(2);
  pending.resolve({ data: { requests: [] } });
  await expect(previous).rejects.toThrow('로그인 계정이 변경되었습니다');
  await expect(current).resolves.toEqual({ requests: [] });
});

test('로그아웃하면 진행 중 응답을 폐기하고 추가 서버 조회를 막는다', async () => {
  const pending = deferred<{ data: { requests: never[] } }>();
  const invoke = jest.fn().mockReturnValue(pending.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const previous = teamExpenseRequestService.list('2026-09');
  session.currentUser = null;
  await expect(teamExpenseRequestService.list('2026-09')).rejects.toThrow('로그인이 필요합니다');
  pending.resolve({ data: { requests: [] } });
  await expect(previous).rejects.toThrow('로그인 계정이 변경되었습니다');
  expect(invoke).toHaveBeenCalledTimes(1);
});
