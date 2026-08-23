import { httpsCallable } from 'firebase/functions';
import {
  forceReleaseConstructionPlanLock,
  getConstructionPlanControlCapabilities,
  requestConstructionPlanUnlock,
  transitionConstructionPlanLifecycle,
} from './constructionPlanLifecycleControlApi';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));

const callable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
const lock = {
  userId: 'holder-1', userName: '잠금 보유자',
  acquiredAt: '2026-08-22T01:00:00.000Z', heartbeatAt: '2026-08-22T01:00:30.000Z',
  expiresAt: '2026-08-22T01:02:00.000Z', expiresAtEpochMs: 1787360520000,
  fingerprint: 'a'.repeat(64),
};

describe('constructionPlanLifecycleControlApi', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts only a server capability projection bound to the requested plan', async () => {
    callable.mockReturnValue(jest.fn().mockResolvedValue({ data: {
      planId: 'plan-1', lockVersion: 7, lock,
      canRequestUnlock: true, canForceUnlock: false,
      unlockRequest: { id: 'request-1', status: 'pending', requestedAt: '2026-08-22T01:01:00.000Z' },
      canWithdrawReview: false, canVoid: false, canArchive: false,
    } }) as never);
    const result = await getConstructionPlanControlCapabilities('plan-1');
    expect(result.lock?.fingerprint).toBe('a'.repeat(64));
    expect(result.unlockRequest?.status).toBe('pending');
  });

  it('binds unlock request and force release to exact holder, acquisition and version', async () => {
    const invoke = jest.fn()
      .mockResolvedValueOnce({ data: { requestId: 'request-1', status: 'pending', requestedAt: '2026-08-22T01:01:00.000Z', idempotent: false } })
      .mockResolvedValueOnce({ data: { planId: 'plan-1', lockVersion: 8, released: true } });
    callable.mockReturnValue(invoke as never);
    await requestConstructionPlanUnlock({ planId: 'plan-1', expectedLockVersion: 7, lock });
    await forceReleaseConstructionPlanLock({ planId: 'plan-1', expectedLockVersion: 7, lock, reason: '관리자 인수인계 처리' });
    expect(invoke.mock.calls[0][0]).toEqual(expect.objectContaining({
      expectedLockVersion: 7,
      expectedLockUserId: 'holder-1',
      expectedLockAcquiredAt: lock.acquiredAt,
      expectedLockFingerprint: lock.fingerprint,
    }));
    expect(invoke.mock.calls[1][0]).toEqual(expect.objectContaining({ reason: '관리자 인수인계 처리' }));
  });

  it('keeps the lifecycle idempotency key and expected version in the callable request', async () => {
    const invoke = jest.fn().mockResolvedValue({ data: { planId: 'plan-1', status: 'void', lockVersion: 9, idempotent: false } });
    callable.mockReturnValue(invoke as never);
    await transitionConstructionPlanLifecycle({
      planId: 'plan-1', action: 'void', expectedLockVersion: 8,
      reason: '중복 문서 폐기 처리', idempotencyKey: 'stable-key-1',
    });
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({ expectedLockVersion: 8, idempotencyKey: 'stable-key-1' }));
  });

  it('rejects a lifecycle response that is not bound to the requested plan and action', async () => {
    callable.mockReturnValue(jest.fn().mockResolvedValue({ data: {
      planId: 'plan-other', status: 'archived', lockVersion: 9, idempotent: false,
    } }) as never);
    await expect(transitionConstructionPlanLifecycle({
      planId: 'plan-1', action: 'void', expectedLockVersion: 8,
      reason: '중복 문서 폐기 처리', idempotencyKey: 'stable-key-2',
    })).rejects.toThrow('construction-plan-control-invalid-response:lifecycle-binding');
  });
});
