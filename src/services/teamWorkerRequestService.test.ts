import { httpsCallable } from 'firebase/functions';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { getWorkerCacheRevision } from '../utils/workerCacheRevision';
import { teamWorkerRequestService } from './teamWorkerRequestService';
jest.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'office' } }, functions: {} }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: jest.fn() }));
beforeEach(() => jest.resetAllMocks());

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
