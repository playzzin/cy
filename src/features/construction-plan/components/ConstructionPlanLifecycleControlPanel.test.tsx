import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ConstructionPlan } from '../types';
import {
  createConstructionPlanControlIdempotencyKey,
  getConstructionPlanControlCapabilities,
  requestConstructionPlanUnlock,
  transitionConstructionPlanLifecycle,
} from '../services/constructionPlanLifecycleControlApi';
import ConstructionPlanLifecycleControlPanel from './ConstructionPlanLifecycleControlPanel';

jest.mock('../services/constructionPlanLifecycleControlApi', () => ({
  createConstructionPlanControlIdempotencyKey: jest.fn(() => 'stable-control-key'),
  forceReleaseConstructionPlanLock: jest.fn(),
  getConstructionPlanControlCapabilities: jest.fn(),
  requestConstructionPlanUnlock: jest.fn(),
  transitionConstructionPlanLifecycle: jest.fn(),
}));

const getCapabilities = getConstructionPlanControlCapabilities as jest.MockedFunction<typeof getConstructionPlanControlCapabilities>;
const createKey = createConstructionPlanControlIdempotencyKey as jest.MockedFunction<typeof createConstructionPlanControlIdempotencyKey>;
const requestUnlock = requestConstructionPlanUnlock as jest.MockedFunction<typeof requestConstructionPlanUnlock>;
const transitionLifecycle = transitionConstructionPlanLifecycle as jest.MockedFunction<typeof transitionConstructionPlanLifecycle>;
const plan = { id: 'plan-1', status: 'in_review', lockVersion: 7 } as ConstructionPlan;
const lock = {
  userId: 'holder-1', userName: '잠금 보유자', acquiredAt: '2026-08-22T01:00:00.000Z',
  heartbeatAt: '2026-08-22T01:00:30.000Z', expiresAt: '2099-08-22T01:02:00.000Z',
  expiresAtEpochMs: new Date('2099-08-22T01:02:00.000Z').getTime(), fingerprint: 'a'.repeat(64),
};

describe('ConstructionPlanLifecycleControlPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createKey.mockReturnValue('stable-control-key');
  });

  it('shows the authoritative holder/remaining time and creates one bound unlock request', async () => {
    getCapabilities.mockResolvedValue({
      planId: plan.id, lockVersion: 7, lock,
      canRequestUnlock: true, canForceUnlock: false, canWithdrawReview: false, canVoid: false, canArchive: false,
    });
    requestUnlock.mockResolvedValue({ requestId: 'request-1', status: 'pending', requestedAt: '2026-08-22T01:01:00.000Z', idempotent: false });
    render(<ConstructionPlanLifecycleControlPanel plan={plan} onChanged={jest.fn()} onError={jest.fn()} />);
    expect(await screen.findByText('잠금 보유자')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '잠금 해제 요청' }));
    await waitFor(() => expect(requestUnlock).toHaveBeenCalledWith(expect.objectContaining({
      planId: 'plan-1', expectedLockVersion: 7, lock,
    })));
  });

  it('requires a reason and preserves the generated idempotency key for review withdrawal', async () => {
    getCapabilities.mockResolvedValue({
      planId: plan.id, lockVersion: 7,
      canRequestUnlock: false, canForceUnlock: false, canWithdrawReview: true, canVoid: false, canArchive: false,
    });
    transitionLifecycle.mockResolvedValue({ planId: plan.id, status: 'draft', lockVersion: 8, idempotent: false });
    const onChanged = jest.fn();
    render(<ConstructionPlanLifecycleControlPanel plan={plan} onChanged={onChanged} onError={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '검토 요청 회수' }));
    const confirm = screen.getAllByRole('button', { name: '검토 요청 회수' }).at(-1)!;
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('감사이력에 남길 구체적인 사유를 5자 이상 입력하세요.'), { target: { value: '검토 범위 재작성 필요' } });
    fireEvent.click(screen.getAllByRole('button', { name: '검토 요청 회수' }).at(-1)!);
    await waitFor(() => expect(transitionLifecycle).toHaveBeenCalledWith({
      planId: 'plan-1', action: 'withdraw_review', expectedLockVersion: 7,
      reason: '검토 범위 재작성 필요', idempotencyKey: 'stable-control-key',
    }));
    expect(onChanged).toHaveBeenCalled();
  });
});
