import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';
import type { EditLock, PlanStatus } from '../types';

export const GET_CONSTRUCTION_PLAN_CONTROL_CAPABILITIES_CALLABLE = 'getConstructionPlanControlCapabilitiesServer';
export const REQUEST_CONSTRUCTION_PLAN_UNLOCK_CALLABLE = 'requestConstructionPlanUnlockServer';
export const FORCE_RELEASE_CONSTRUCTION_PLAN_LOCK_CALLABLE = 'forceReleaseConstructionPlanLockServer';
export const TRANSITION_CONSTRUCTION_PLAN_LIFECYCLE_CALLABLE = 'transitionConstructionPlanLifecycleServer';

export type ConstructionPlanBoundLock = EditLock & { fingerprint: string };

export type ConstructionPlanControlCapabilities = {
  planId: string;
  lockVersion: number;
  lock?: ConstructionPlanBoundLock;
  canRequestUnlock: boolean;
  canForceUnlock: boolean;
  unlockRequest?: {
    id: string;
    status: 'pending' | 'resolved';
    requestedAt: string;
    resolvedAt?: string;
  };
  canWithdrawReview: boolean;
  canVoid: boolean;
  canArchive: boolean;
};

export type ConstructionPlanLifecycleAction = 'withdraw_review' | 'void' | 'archive';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const stringValue = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`construction-plan-control-invalid-response:${field}`);
  return value;
};

const integerValue = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Error(`construction-plan-control-invalid-response:${field}`);
  return Number(value);
};

const booleanValue = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`construction-plan-control-invalid-response:${field}`);
  return value;
};

const parseLock = (value: unknown): ConstructionPlanBoundLock | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('construction-plan-control-invalid-response:lock');
  const expiresAtEpochMs = integerValue(value.expiresAtEpochMs, 'lock.expiresAtEpochMs');
  const fingerprint = stringValue(value.fingerprint, 'lock.fingerprint').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('construction-plan-control-invalid-response:lock.fingerprint');
  return {
    userId: stringValue(value.userId, 'lock.userId'),
    userName: stringValue(value.userName, 'lock.userName'),
    acquiredAt: stringValue(value.acquiredAt, 'lock.acquiredAt'),
    heartbeatAt: typeof value.heartbeatAt === 'string' && value.heartbeatAt
      ? value.heartbeatAt
      : stringValue(value.acquiredAt, 'lock.acquiredAt'),
    expiresAt: stringValue(value.expiresAt, 'lock.expiresAt'),
    expiresAtEpochMs,
    fingerprint,
  };
};

const parseCapabilities = (value: unknown): ConstructionPlanControlCapabilities => {
  if (!isRecord(value)) throw new Error('construction-plan-control-invalid-response:capabilities');
  const request = value.unlockRequest;
  let unlockRequest: ConstructionPlanControlCapabilities['unlockRequest'];
  if (request !== undefined) {
    if (!isRecord(request) || !['pending', 'resolved'].includes(String(request.status || ''))) {
      throw new Error('construction-plan-control-invalid-response:unlockRequest');
    }
    unlockRequest = {
      id: stringValue(request.id, 'unlockRequest.id'),
      status: request.status as 'pending' | 'resolved',
      requestedAt: stringValue(request.requestedAt, 'unlockRequest.requestedAt'),
      ...(typeof request.resolvedAt === 'string' && request.resolvedAt ? { resolvedAt: request.resolvedAt } : {}),
    };
  }
  const lock = parseLock(value.lock);
  return {
    planId: stringValue(value.planId, 'planId'),
    lockVersion: integerValue(value.lockVersion, 'lockVersion'),
    ...(lock ? { lock } : {}),
    canRequestUnlock: booleanValue(value.canRequestUnlock, 'canRequestUnlock'),
    canForceUnlock: booleanValue(value.canForceUnlock, 'canForceUnlock'),
    ...(unlockRequest ? { unlockRequest } : {}),
    canWithdrawReview: booleanValue(value.canWithdrawReview, 'canWithdrawReview'),
    canVoid: booleanValue(value.canVoid, 'canVoid'),
    canArchive: booleanValue(value.canArchive, 'canArchive'),
  };
};

const lockRequestProjection = (
  planId: string,
  expectedLockVersion: number,
  lock: ConstructionPlanBoundLock,
) => ({
  planId,
  expectedLockVersion,
  expectedLockUserId: lock.userId,
  expectedLockAcquiredAt: lock.acquiredAt,
  expectedLockFingerprint: lock.fingerprint,
});

export const createConstructionPlanControlIdempotencyKey = (): string => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
};

export const getConstructionPlanControlCapabilities = async (
  planId: string,
): Promise<ConstructionPlanControlCapabilities> => {
  const callable = httpsCallable<{ planId: string }, unknown>(functions, GET_CONSTRUCTION_PLAN_CONTROL_CAPABILITIES_CALLABLE);
  const response = parseCapabilities((await callable({ planId })).data);
  if (response.planId !== planId) throw new Error('construction-plan-control-invalid-response:planId-binding');
  return response;
};

export const requestConstructionPlanUnlock = async (input: {
  planId: string;
  expectedLockVersion: number;
  lock: ConstructionPlanBoundLock;
  reason?: string;
}): Promise<{ requestId: string; status: 'pending'; requestedAt: string; idempotent: boolean }> => {
  const callable = httpsCallable<Record<string, unknown>, unknown>(functions, REQUEST_CONSTRUCTION_PLAN_UNLOCK_CALLABLE);
  const data = (await callable({
    ...lockRequestProjection(input.planId, input.expectedLockVersion, input.lock),
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
  })).data;
  if (!isRecord(data) || data.status !== 'pending' || typeof data.idempotent !== 'boolean') {
    throw new Error('construction-plan-control-invalid-response:unlock');
  }
  return {
    requestId: stringValue(data.requestId, 'requestId'),
    status: 'pending',
    requestedAt: stringValue(data.requestedAt, 'requestedAt'),
    idempotent: data.idempotent,
  };
};

export const forceReleaseConstructionPlanLock = async (input: {
  planId: string;
  expectedLockVersion: number;
  lock: ConstructionPlanBoundLock;
  reason: string;
}): Promise<{ planId: string; lockVersion: number; released: true }> => {
  const callable = httpsCallable<Record<string, unknown>, unknown>(functions, FORCE_RELEASE_CONSTRUCTION_PLAN_LOCK_CALLABLE);
  const data = (await callable({
    ...lockRequestProjection(input.planId, input.expectedLockVersion, input.lock),
    reason: input.reason.trim(),
  })).data;
  if (!isRecord(data) || data.released !== true) throw new Error('construction-plan-control-invalid-response:force-unlock');
  const responsePlanId = stringValue(data.planId, 'planId');
  if (responsePlanId !== input.planId) throw new Error('construction-plan-control-invalid-response:planId-binding');
  return {
    planId: responsePlanId,
    lockVersion: integerValue(data.lockVersion, 'lockVersion'),
    released: true,
  };
};

export const transitionConstructionPlanLifecycle = async (input: {
  planId: string;
  action: ConstructionPlanLifecycleAction;
  expectedLockVersion: number;
  reason: string;
  idempotencyKey: string;
}): Promise<{ planId: string; status: PlanStatus; lockVersion: number; idempotent: boolean }> => {
  const callable = httpsCallable<typeof input, unknown>(functions, TRANSITION_CONSTRUCTION_PLAN_LIFECYCLE_CALLABLE);
  const data = (await callable(input)).data;
  if (!isRecord(data) || typeof data.idempotent !== 'boolean') throw new Error('construction-plan-control-invalid-response:lifecycle');
  const responsePlanId = stringValue(data.planId, 'planId');
  const status = stringValue(data.status, 'status') as PlanStatus;
  const expectedStatus: PlanStatus = input.action === 'withdraw_review' ? 'draft' : input.action === 'void' ? 'void' : 'archived';
  if (responsePlanId !== input.planId || status !== expectedStatus) {
    throw new Error('construction-plan-control-invalid-response:lifecycle-binding');
  }
  return {
    planId: responsePlanId,
    status,
    lockVersion: integerValue(data.lockVersion, 'lockVersion'),
    idempotent: data.idempotent,
  };
};
