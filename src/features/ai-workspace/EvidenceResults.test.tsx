import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AiResult, AI_WORKSPACE_VERSION } from './contract';
import { EvidenceMetrics, EvidenceResults } from './EvidenceResults';
import { AiWorkspace } from './AiWorkspace';
const result = (): AiResult => ({ id: 'evidence', version: AI_WORKSPACE_VERSION, createdAt: '2026-09-28T00:00:00Z', expiresAt: '2026-09-28T01:00:00Z',
  plan: { dataset: 'settlementEvidence', operation: 'aggregate', entity: 'team', groupBy: 'settlementTeam', range: { startDate: '2026-08-01', endDate: '2026-08-31' },
    comparison: null, filters: [], missingAccount: false, status: '', sortBy: 'name', direction: 'asc', clarification: '',
    report: { title: '저장 근거 점검', format: 'none', includeAmount: true, includeDetails: true, splitByGroup: false } },
  rows: [], records: [], details: [], totals: { amount: 0, manDay: 0, reports: 0, workers: 0 }, previousTotals: null, warnings: [], completeness: 'partial', summary: '저장 근거 점검 결과',
  evidence: { rows: [{ teamId: 't1', teamName: '검증팀', yearMonth: '2026-08', category: '내부지원간곳', settlementId: 'settlement', capturedAt: '2026-08-31T00:00:00Z', lineIds: ['support-sales'], evidenceCount: 2,
    settledAmount: 150000, evidenceAmount: 180000, difference: 30000, status: 'difference', reason: '저장 근거와 차이가 있습니다.' },
    { teamId: 't1', teamName: '검증팀', yearMonth: '2026-08', category: '일보 금액', settlementId: 'settlement', capturedAt: '2026-08-31T00:00:00Z', lineIds: [], evidenceCount: 1,
      settledAmount: null, evidenceAmount: null, difference: null, status: 'unavailable', reason: '일보 금액 근거가 없습니다.' }],
    absoluteDifference: 30000, counts: { matched: 0, difference: 1, unavailable: 1, review: 0, noSettlement: 0, invalid: 0 } } });
test('missing historical values are non-comparable, not zero; amount exclusion removes monetary columns', () => {
  const value = result(); const { rerender } = render(<><EvidenceMetrics result={value} /><EvidenceResults result={value} view="table" /></>);
  const table = within(screen.getByRole('table', { name: '일보 지원비 저장 근거 점검' }));
  expect(table.getAllByText('비교 불가')).toHaveLength(3); expect(table.getByText('30,000원')).toBeInTheDocument();
  expect(screen.getByText(/금액 비교가 불가능합니다/)).toBeInTheDocument();
  value.plan.report.includeAmount = false; rerender(<EvidenceResults result={value} view="table" />);
  expect(screen.queryByText(/30,000/)).not.toBeInTheDocument(); expect(screen.queryByRole('columnheader', { name: '정산 반영액' })).not.toBeInTheDocument();
  expect(screen.getByText('비교 근거 부족')).toBeInTheDocument();
});
test('sources show saved time and settlement links; chart keeps scope limitations', () => {
  const { rerender } = render(<EvidenceResults result={result()} view="sources" />);
  expect(screen.getByText(/support-sales/)).toBeInTheDocument(); expect(screen.getByText(/과거 금액 대사가 불가능합니다/)).toBeInTheDocument();
  rerender(<EvidenceResults result={result()} view="chart" />);
  expect(screen.getByLabelText('저장 근거 점검 그래프')).toHaveTextContent('현재 원장 전체 대사를 뜻하지 않습니다.');
});
test('workspace routes evidence to its own table instead of settlement financial totals', async () => {
  const value = result(); value.settlement = { rows: [], details: [], totals: {} as any, previousTotals: null };
  const client: any = { analyze: jest.fn().mockResolvedValue({ status: 'complete', plan: value.plan, result: value }), listSaved: jest.fn().mockResolvedValue({ items: [] }) };
  render(<AiWorkspace client={client} />);
  fireEvent.click(screen.getByRole('button', { name: '지난달 확정 정산에 저장된 일보·지원비 근거를 점검해줘' }));
  expect(await screen.findByRole('table', { name: '일보 지원비 저장 근거 점검' })).toBeInTheDocument();
  expect(screen.queryByText('정산 계산액')).not.toBeInTheDocument();
});
