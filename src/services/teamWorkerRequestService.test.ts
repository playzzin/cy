import { httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { getWorkerCacheRevision } from '../utils/workerCacheRevision';
import { teamWorkerRequestService } from './teamWorkerRequestService';
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'office' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));
const session = auth as unknown as { currentUser: { uid: string } | null };
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
};
beforeEach(() => { jest.resetAllMocks(); session.currentUser = { uid: 'office' }; });

test('샘플 계정에서는 실제 등록 서버를 호출하지 않는다', async () => {
  (isDevAdminSessionEnabled as jest.Mock).mockReturnValue(true);
  await expect(teamWorkerRequestService.list('2026-09')).rejects.toThrow('개발용 샘플 계정');
  await expect(teamWorkerRequestService.review('request', 'approved', '')).rejects.toThrow('개발용 샘플 계정');
  expect(httpsCallable).not.toHaveBeenCalled();
});
test('승인 완료 시에만 기존 작업자 목록 캐시를 무효화한다', async () => {
  const invoke = jest.fn().mockResolvedValue({ data: { status: 'approved' } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const before = getWorkerCacheRevision();
  await teamWorkerRequestService.review('request', 'approved', '');
  expect(getWorkerCacheRevision()).toBe(before + 1);
  await teamWorkerRequestService.review('other', 'rejected', '반려');
  expect(getWorkerCacheRevision()).toBe(before + 1);
  invoke.mockRejectedValueOnce(new Error('승인 실패'));
  await expect(teamWorkerRequestService.review('failed', 'approved', '')).rejects.toThrow('승인 실패');
  expect(getWorkerCacheRevision()).toBe(before + 1);
});

test('동시에 열린 동일 월 목록은 한 번만 호출하고 완료 결과는 캐시하지 않는다', async () => {
  const response = deferred<{ data: any }>();
  const invoke = jest.fn().mockReturnValueOnce(response.promise).mockResolvedValue({ data: { requests: ['fresh'] } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamWorkerRequestService.list('2026-09');
  const strictModeRepeat = teamWorkerRequestService.list('2026-09');
  expect(invoke).toHaveBeenCalledTimes(1);
  response.resolve({ data: { requests: ['initial'] } });
  expect(await first).toEqual(await strictModeRepeat);
  expect(await teamWorkerRequestService.list('2026-09')).toEqual({ requests: ['fresh'] });
  expect(invoke).toHaveBeenCalledTimes(2);
});

test('월과 페이지가 다르면 각각 조회하며 실패한 요청도 다음 조회에 재사용하지 않는다', async () => {
  const response = deferred<{ data: any }>();
  const invoke = jest.fn().mockReturnValueOnce(response.promise).mockResolvedValue({ data: {} });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamWorkerRequestService.list('2026-09');
  const failed = first.catch(cause => cause);
  await teamWorkerRequestService.list('2026-10');
  await teamWorkerRequestService.list('2026-09', 'next');
  expect(invoke).toHaveBeenCalledTimes(3);
  response.reject(new Error('일시 오류')); expect(await failed).toHaveProperty('message', '일시 오류');
  await teamWorkerRequestService.list('2026-09');
  expect(invoke).toHaveBeenCalledTimes(4);
});

test.each(['other', 'office'])('계정 세션이 %s로 교체되면 이전 응답을 거부하고 요청을 공유하지 않는다', async uid => {
  const response = deferred<{ data: any }>();
  const invoke = jest.fn().mockReturnValueOnce(response.promise).mockResolvedValue({ data: { requests: ['current-session'] } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamWorkerRequestService.list('2026-09');
  const rejected = first.catch(cause => cause);
  session.currentUser = { uid };
  expect(await teamWorkerRequestService.list('2026-09')).toEqual({ requests: ['current-session'] });
  expect(invoke).toHaveBeenCalledTimes(2);
  response.resolve({ data: { requests: ['previous-session'] } });
  expect(await rejected).toHaveProperty('message', expect.stringContaining('로그인 계정이 변경'));
});

test('로그아웃 뒤에는 진행 중 응답과 새로운 조회를 모두 거부한다', async () => {
  const response = deferred<{ data: any }>();
  const invoke = jest.fn().mockReturnValue(response.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const first = teamWorkerRequestService.list('2026-09');
  const rejected = first.catch(cause => cause);
  session.currentUser = null;
  await expect(teamWorkerRequestService.list('2026-09')).rejects.toThrow('로그인이 필요');
  response.resolve({ data: {} }); expect(await rejected).toHaveProperty('message', expect.stringContaining('로그인 계정이 변경'));
  expect(invoke).toHaveBeenCalledTimes(1);
});

test('새로고침은 진행 중 조회를 대체하고 이전 조회 완료가 최신 요청을 제거하지 않는다', async () => {
  const firstResponse = deferred<{ data: any }>(), freshResponse = deferred<{ data: any }>();
  const invoke = jest.fn().mockReturnValueOnce(firstResponse.promise).mockReturnValueOnce(freshResponse.promise);
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const initial = teamWorkerRequestService.list('2026-09');
  const fresh = teamWorkerRequestService.list('2026-09', undefined, { forceReload: true });
  firstResponse.resolve({ data: { requests: ['before-refresh'] } }); await initial;
  const repeated = teamWorkerRequestService.list('2026-09');
  expect(invoke).toHaveBeenCalledTimes(2);
  freshResponse.resolve({ data: { requests: ['after-refresh'] } });
  expect(await repeated).toEqual(await fresh);
});

test('승인 시작과 완료 모두 이전 목록 요청을 비워 변경 후 상태를 다시 조회한다', async () => {
  const before = deferred<{ data: any }>(), during = deferred<{ data: any }>(), review = deferred<{ data: any }>();
  const invoke = jest.fn().mockReturnValueOnce(before.promise).mockReturnValueOnce(review.promise).mockReturnValueOnce(during.promise).mockResolvedValue({ data: { requests: ['approved'] } });
  (httpsCallable as jest.Mock).mockReturnValue(invoke);
  const beforeList = teamWorkerRequestService.list('2026-09');
  const mutation = teamWorkerRequestService.review('request', 'approved', '', { payType: '일급제', unitPrice: 150000 });
  const duringList = teamWorkerRequestService.list('2026-09');
  expect(invoke).toHaveBeenCalledTimes(3);
  review.resolve({ data: {} }); await mutation;
  expect(await teamWorkerRequestService.list('2026-09')).toEqual({ requests: ['approved'] });
  expect(invoke).toHaveBeenCalledTimes(4);
  before.resolve({ data: {} }); during.resolve({ data: {} }); await Promise.all([beforeList, duringList]);
});
