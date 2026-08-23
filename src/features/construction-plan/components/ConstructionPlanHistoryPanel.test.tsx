import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  ConstructionPlanLineage,
  ConstructionPlanSummary,
  ConstructionPlanWorkflowEvent,
} from '../types';
import {
  getConstructionPlanLineage,
  listConstructionPlanWorkflowEvents,
} from '../services/constructionPlanWorkflowApi';
import ConstructionPlanHistoryPanel from './ConstructionPlanHistoryPanel';

jest.mock('../services/constructionPlanWorkflowApi', () => ({
  getConstructionPlanLineage: jest.fn(),
  listConstructionPlanWorkflowEvents: jest.fn(),
}));

const getLineage = getConstructionPlanLineage as jest.MockedFunction<typeof getConstructionPlanLineage>;
const listEvents = listConstructionPlanWorkflowEvents as jest.MockedFunction<typeof listConstructionPlanWorkflowEvents>;

const summary = (id: string, revision: number, status: ConstructionPlanSummary['status']): ConstructionPlanSummary => ({
  id,
  siteId: 'site-1',
  title: '시스템동바리 시공계획서',
  tradeType: 'system-shoring',
  documentNo: 'CY-SITE-2026-SD-01',
  documentDate: '2026-08-20',
  revision,
  status,
  createdBy: 'user-1',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedBy: 'user-1',
  updatedAt: `2026-08-${20 + revision}T01:00:00.000Z`,
});

const lineage: ConstructionPlanLineage = {
  series: {
    id: 'series-1',
    siteId: 'site-1',
    documentNo: 'CY-SITE-2026-SD-01',
    documentNoKey: 'cy-site-2026-sd-01',
    tradeType: 'system-shoring',
    latestRevisionNo: 2,
    latestPlanId: 'plan-2',
    latestIssuedPlanId: 'plan-1',
  },
  plans: [
    summary('plan-0', 0, 'superseded'),
    { ...summary('plan-1', 1, 'issued'), revisionType: 'site_condition', revisionReason: '현장 조건 변경' },
    { ...summary('plan-2', 2, 'draft'), revisionType: 'method_change' },
  ],
  currentIndex: 1,
  previous: summary('plan-0', 0, 'superseded'),
  next: summary('plan-2', 2, 'draft'),
};

const events: ConstructionPlanWorkflowEvent[] = [{
  id: 'event-1',
  planId: 'plan-1',
  seriesId: 'series-1',
  type: 'revision_created',
  actorId: 'user-1',
  actorName: '홍길동',
  at: '2026-08-21T01:00:00.000Z',
  fromStatus: 'issued',
  toStatus: 'draft',
  sourcePlanId: 'plan-0',
  targetPlanId: 'plan-1',
  revisionNo: 1,
  reason: '현장 조건 변경',
  revisionType: 'site_condition',
  metadata: { approvedSnapshotHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
}];

describe('ConstructionPlanHistoryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLineage.mockResolvedValue(lineage);
    listEvents.mockResolvedValue(events);
  });

  it('renders real lineage and workflow events and navigates between revisions', async () => {
    const onNavigatePlan = jest.fn();
    render(<ConstructionPlanHistoryPanel planId="plan-1" onNavigatePlan={onNavigatePlan} />);

    expect(await screen.findByText('개정 · 감사이력')).toBeInTheDocument();
    expect(screen.getByText('개정본 생성')).toBeInTheDocument();
    expect(screen.getAllByText('현장 조건 변경').length).toBeGreaterThan(0);
    expect(screen.getByText(/HASH 1234567890ab/)).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /다음 Rev\./ }));
    expect(onNavigatePlan).toHaveBeenCalledWith('plan-2');
    fireEvent.click(screen.getByRole('button', { name: '기준 문서 열기' }));
    expect(onNavigatePlan).toHaveBeenCalledWith('plan-0');
  });

  it('shows a recoverable error and retries both history requests', async () => {
    getLineage.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(lineage);
    listEvents.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    render(<ConstructionPlanHistoryPanel planId="plan-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('이력을 표시할 수 없습니다');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getByText('개정 · 감사이력')).toBeInTheDocument());
    expect(getLineage).toHaveBeenCalledTimes(2);
    expect(listEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByText('기록된 감사 이벤트가 없습니다')).toBeInTheDocument();
  });
});
