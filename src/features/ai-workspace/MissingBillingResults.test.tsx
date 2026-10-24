import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { AiResult, AI_WORKSPACE_VERSION } from './contract';
import { MissingBillingMetrics, MissingBillingResults } from './MissingBillingResults';
const result = (): AiResult => ({ id: 'missing', version: AI_WORKSPACE_VERSION, createdAt: '2026-09-28T00:00:00Z', expiresAt: '2026-09-28T01:00:00Z',
  plan: { dataset: 'settlementMissing', operation: 'aggregate', entity: 'team', groupBy: 'settlementTeam', range: { startDate: '2026-08-01', endDate: '2026-08-31' },
    comparison: null, filters: [], missingAccount: false, status: '', sortBy: 'name', direction: 'asc', clarification: '',
    report: { title: '미연결 점검', format: 'none', includeAmount: true, includeDetails: true, splitByGroup: false } },
  rows: [], records: [], details: [], totals: { amount: 0, manDay: 0, reports: 0, workers: 0 }, previousTotals: null, warnings: [], completeness: 'partial', summary: '후보 점검',
  missingBilling: { rows: [{ teamId: 't1', teamName: '검증팀', yearMonth: '2026-08', category: '카드', sourceId: 'bill-new', sourceCollection: 'cardBillings', settlementId: 'settlement', lineIds: [], sourceAmount: 90000, status: 'candidate', reason: '정산 이후 청구 여부를 확인하세요.' },
    { teamId: 't2', teamName: '미확정팀', yearMonth: '2026-08', category: '차량', sourceId: 'bill-2', sourceCollection: 'vehicle_billing_documents', settlementId: '', lineIds: [], sourceAmount: null, status: 'invalid', reason: '금액 형식 오류' }],
    candidateAmount: 90000, counts: { candidate: 1, linked: 0, review: 0, invalid: 1, noSettlement: 0, zero: 0 }, excludedUnconfirmed: 2,
    teams: [{ id: 't1', name: '검증팀', confirmed: true, settlementId: 'settlement', bills: 1 }, { id: 't2', name: '미확정팀', confirmed: false, settlementId: '', bills: 1 }] } });
test('candidate values and team coverage do not claim confirmed omission or interpret invalid as zero', () => {
  render(<><MissingBillingMetrics result={result()} /><MissingBillingResults result={result()} view="table" /></>);
  expect(screen.getByText(/실제 누락·미지급 확정이 아닙니다/)).toBeInTheDocument();
  expect(within(screen.getByRole('table', { name: '미연결 청구서 점검' })).getByText('90,000원')).toBeInTheDocument();
  expect(within(screen.getByRole('table', { name: '미연결 청구서 점검' })).getByText('확인 불가')).toBeInTheDocument();
  expect(within(screen.getByRole('table', { name: '팀별 점검 범위' })).getByText('확정 정산 확인 불가')).toBeInTheDocument();
});
test('amount exclusion keeps statuses and sources without numeric monetary values', () => {
  const value = result(); value.plan.report.includeAmount = false;
  const { rerender } = render(<MissingBillingResults result={value} view="table" />);
  expect(screen.queryByText(/90,000/)).not.toBeInTheDocument(); expect(screen.queryByRole('columnheader', { name: '현재 청구액' })).not.toBeInTheDocument();
  rerender(<MissingBillingResults result={value} view="sources" />);
  expect(screen.getByText('카드 · bill-new')).toBeInTheDocument(); expect(screen.getAllByText('직접 연결 없음')).toHaveLength(2);
});
test('chart and empty coverage explain their scope instead of reporting no omissions', () => {
  const value = result(), { rerender } = render(<MissingBillingResults result={value} view="chart" />);
  expect(screen.getByLabelText('청구서 연결 점검 그래프')).toHaveTextContent('미연결 후보');
  value.missingBilling!.rows = [];
  rerender(<MissingBillingResults result={value} view="table" />);
  expect(screen.getByText(/전체 업무의 누락이 없다는 뜻은 아닙니다/)).toBeInTheDocument();
  expect(screen.getByRole('table', { name: '팀별 점검 범위' })).toBeInTheDocument();
});
