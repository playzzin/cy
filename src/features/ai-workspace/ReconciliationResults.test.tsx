import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { ReconciliationResults, ReconciliationMetrics } from './ReconciliationResults';
import { AI_WORKSPACE_VERSION, AiResult } from './contract';
const example = (): AiResult => ({ id: 'audit', version: AI_WORKSPACE_VERSION, createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-09-01T01:00:00Z',
  plan: { dataset: 'settlementAudit', operation: 'aggregate', entity: 'team', range: { startDate: '2026-08-01', endDate: '2026-08-31' }, comparison: null, groupBy: 'settlementTeam', filters: [], missingAccount: false, status: '', sortBy: 'name', direction: 'asc', clarification: '', report: { format: 'none', title: '대사', includeDetails: true, includeAmount: true, splitByGroup: false } },
  totals: { manDay: 0, amount: 0, workers: 0, reports: 0 }, previousTotals: null, rows: [], records: [], details: [], warnings: [], summary: '대사 결과', completeness: 'partial',
  reconciliation: { counts: { matched: 0, difference: 1, unavailable: 1, unconfirmed: 0, unsupported: 0, duplicate: 0, invalid: 0 }, comparedSettledAmount: 50000, comparedSourceAmount: 70000, absoluteDifference: 20000,
    rows: [{ teamId: 't1', teamName: '검증팀', yearMonth: '2026-08', settlementId: 'settlement-1', lineId: 'line-1', category: '카드', sourceId: 'bill-1', status: 'difference', settledAmount: 50000, sourceAmount: 70000, difference: 20000, reason: '조정 내역 확인' },
      { teamId: 't1', teamName: '검증팀', yearMonth: '2026-08', settlementId: 'settlement-1', lineId: 'line-2', category: '숙소', sourceId: '', status: 'unavailable', settledAmount: 100000, sourceAmount: null, difference: null, reason: '원본 확인 필요' }] } });
test('audit table distinguishes an unavailable bill from zero and shows differences', () => {
  render(<><ReconciliationMetrics result={example()}/><ReconciliationResults result={example()} view="table"/></>);
  const table = within(screen.getByRole('table'));
  expect(table.getByText('70,000원')).toBeInTheDocument(); expect(table.getAllByText('비교 불가')).toHaveLength(2); expect(table.queryByText('0원')).not.toBeInTheDocument();
});
test('amount exclusion still shows statuses and source identity without monetary values', () => {
  const value = example(); value.plan.report.includeAmount = false;
  render(<ReconciliationResults result={value} view="table"/>);
  expect(screen.queryByText('70,000원')).not.toBeInTheDocument(); expect(screen.queryByText('20,000원')).not.toBeInTheDocument(); expect(screen.getByText('원본 확인 불가')).toBeInTheDocument();
});
test('audit source view explains scope and displays accepted references', () => {
  render(<ReconciliationResults result={example()} view="sources"/>);
  expect(screen.getByText('bill-1')).toBeInTheDocument(); expect(screen.getByText(/미연결 청구서 누락/)).toBeInTheDocument();
});
