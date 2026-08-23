import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildConstructionPlanDraft } from '../domain';
import type { ConstructionPlan, ConstructionPlanErpSnapshot } from '../types';
import {
  applyConstructionPlanErpSnapshotFieldsServer,
  getConstructionPlanLatestErpSnapshotServer,
} from '../services/constructionPlanErpRefreshService';
import ConstructionPlanErpRefreshWorkspace from './ConstructionPlanErpRefreshWorkspace';

jest.mock('../../../config/firebase', () => ({ functions: { name: 'test-functions' } }));
jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('../services/constructionPlanErpRefreshService', () => ({
  ...jest.requireActual('../services/constructionPlanErpRefreshService'),
  applyConstructionPlanErpSnapshotFieldsServer: jest.fn(),
  getConstructionPlanLatestErpSnapshotServer: jest.fn(),
}));

const mockedGet = getConstructionPlanLatestErpSnapshotServer as jest.MockedFunction<
  typeof getConstructionPlanLatestErpSnapshotServer
>;
const mockedApply = applyConstructionPlanErpSnapshotFieldsServer as jest.MockedFunction<
  typeof applyConstructionPlanErpSnapshotFieldsServer
>;
const capturedAt = '2026-08-22T00:00:00.000Z';

const snapshot = (address = '서울'): ConstructionPlanErpSnapshot => ({
  schemaVersion: 1,
  capturedAt,
  site: {
    source: 'site',
    sourceId: 'site-1',
    capturedAt,
    value: { id: 'site-1', name: '현장', address },
  },
});

const plan = (lockVersion = 7, address = '서울'): ConstructionPlan => ({
  ...buildConstructionPlanDraft('plan-1', {
    siteId: 'site-1',
    siteName: '현장',
    tradeType: 'system-shoring',
    createdBy: 'author-1',
  }, capturedAt),
  erpSnapshot: snapshot(address),
  lockVersion,
  updatedAt: capturedAt,
});

const organizationComparison = (currentPlan: ConstructionPlan) => ({
  current: currentPlan.organizationSnapshot,
  latestWorkers: [],
  changes: [],
  assignmentIssues: [],
  suggestedAdditionalWorkers: [],
  additionalWorkersChanged: false,
  changed: false,
});

describe('ConstructionPlanErpRefreshWorkspace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('never auto-overwrites and applies a selected field only after an explicit comparison', async () => {
    const currentPlan = plan();
    const appliedPlan = plan(8, '서울 강남구');
    const onPlanApplied = jest.fn();
    const latest = snapshot('서울 강남구');
    mockedGet
      .mockResolvedValueOnce({
        planId: 'plan-1', status: 'draft', lockVersion: 7,
        current: currentPlan.erpSnapshot, latest, changedFieldIds: ['site.address'],
        organizationComparison: organizationComparison(currentPlan), capturedAt,
      })
      .mockResolvedValueOnce({
        planId: 'plan-1', status: 'draft', lockVersion: 8,
        current: appliedPlan.erpSnapshot, latest, changedFieldIds: [],
        organizationComparison: organizationComparison(appliedPlan), capturedAt,
      });
    mockedApply.mockResolvedValueOnce({
      planId: 'plan-1',
      plan: appliedPlan,
      appliedFieldIds: ['site.address'],
      remainingFieldIds: [],
      appliedOrganizationChangeIds: [],
      remainingOrganizationChangeIds: [],
      auditEventId: 'audit-1',
      idempotent: false,
    });

    render(<ConstructionPlanErpRefreshWorkspace
      plan={currentPlan}
      onPrepareApply={async () => currentPlan}
      onPlanApplied={onPlanApplied}
    />);
    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '최신 원천 비교' }));
    await screen.findByText('서울 강남구');
    fireEvent.change(screen.getByLabelText('반영 사유 *'), { target: { value: '현장 주소 변경 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '선택 1개 반영' }));

    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(1));
    expect(mockedApply.mock.calls[0][0]).toMatchObject({
      planId: 'plan-1',
      expectedLockVersion: 7,
      fieldIds: ['site.address'],
      reason: '현장 주소 변경 확인',
    });
    expect(mockedApply.mock.calls[0][0]).not.toHaveProperty('latest');
    await waitFor(() => expect(onPlanApplied).toHaveBeenCalledWith(appliedPlan));
    await screen.findByText('현재 계획서와 ERP 원천 데이터가 일치합니다.');
  });

  it('retries a lost apply response with the same key and pre-request lock version', async () => {
    const currentPlan = plan();
    mockedGet.mockResolvedValue({
      planId: 'plan-1', status: 'draft', lockVersion: 7,
      current: currentPlan.erpSnapshot, latest: snapshot('서울 강남구'),
      changedFieldIds: ['site.address'],
      organizationComparison: organizationComparison(currentPlan), capturedAt,
    });
    mockedApply
      .mockRejectedValueOnce(Object.assign(new Error('network'), { code: 'functions/unavailable' }))
      .mockRejectedValueOnce(Object.assign(new Error('network'), { code: 'functions/unavailable' }));
    const onPrepareApply = jest.fn()
      .mockResolvedValueOnce(plan(7))
      .mockResolvedValueOnce(plan(99));

    render(<ConstructionPlanErpRefreshWorkspace
      plan={currentPlan}
      onPrepareApply={onPrepareApply}
      onPlanApplied={jest.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: '최신 원천 비교' }));
    await screen.findByText('서울 강남구');
    fireEvent.change(screen.getByLabelText('반영 사유 *'), { target: { value: '현장 주소 변경 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '선택 1개 반영' }));
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(
      (screen.getByRole('button', { name: '선택 1개 반영' }) as HTMLButtonElement).disabled,
    ).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '선택 1개 반영' }));
    await waitFor(() => expect(mockedApply).toHaveBeenCalledTimes(2));

    expect(mockedApply.mock.calls[1][0].idempotencyKey)
      .toBe(mockedApply.mock.calls[0][0].idempotencyKey);
    expect(mockedApply.mock.calls[1][0].expectedLockVersion).toBe(7);
  });

  it('shows an actionable retry after comparison failure', async () => {
    mockedGet
      .mockRejectedValueOnce(Object.assign(new Error('network'), { code: 'functions/unavailable' }))
      .mockResolvedValueOnce({
        planId: 'plan-1', status: 'draft', lockVersion: 7,
        current: snapshot(), latest: snapshot(), changedFieldIds: [],
        organizationComparison: organizationComparison(plan()), capturedAt,
      });
    render(<ConstructionPlanErpRefreshWorkspace
      plan={plan()}
      onPrepareApply={async () => plan()}
      onPlanApplied={jest.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: '최신 원천 비교' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '다시 비교' }));
    await screen.findByText('현재 계획서와 ERP 원천 데이터가 일치합니다.');
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});
