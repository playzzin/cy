import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import type { CardStatementImportResult } from '../../types/cardStatementImport';
import CardStatementReconciliation from './CardStatementReconciliation';

const result: CardStatementImportResult = {
  id: 'result', jobId: 'job', fileId: 'file', fileIndex: 0, resultIndex: 0, yearMonth: '2026-09',
  matchedCardId: 'card-1', cardLast4: '1234', matchConfidence: 1, matchCandidates: [], status: 'matched',
  subtotalAmount: 15000, statementTotalAvailable: true, transactionCount: 1, warnings: [],
  transactions: [{ id: '1', date: '2026-09-01', merchant: '식당', amount: 15000, category: 'MEAL', confidence: 1 }],
};

test('renders statement, transaction and ledger amounts with a confirmed match', () => {
  render(<CardStatementReconciliation results={[result]} analysisStatus="completed" ledgerTotal={15000} />);
  expect(screen.getByText('일치', { exact: true })).toBeInTheDocument();
  expect(screen.getAllByText('15,000원')).toHaveLength(3);
  expect(screen.getByText('명세서 − 사용내역 차액')).toBeInTheDocument();
});

test('distinguishes ledger disagreement from a matching PDF', () => {
  render(<CardStatementReconciliation results={[result]} analysisStatus="completed" ledgerTotal={17000} />);
  expect(screen.getByText('불일치', { exact: true })).toBeInTheDocument();
  expect(screen.getByText('2,000원')).toBeInTheDocument();
  expect(screen.getByText(/명세서와 사용내역은 일치하지만/)).toBeInTheDocument();
});

test('does not report an unverified legacy total or missing rows as matched', () => {
  const view = render(<CardStatementReconciliation results={[{ ...result, statementTotalAvailable: undefined }]} analysisStatus="completed" />);
  expect(screen.queryByText('일치', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText(/원본에서 확인한 카드 총액이 없습니다/)).toBeInTheDocument();
  view.rerender(<CardStatementReconciliation results={[]} analysisStatus="completed" />);
  expect(screen.getByText(/상세 거래가 없는 명세서/)).toBeInTheDocument();
});

test('withholds definitive monthly comparisons when any connected file is incomplete', () => {
  render(<CardStatementReconciliation results={[result]} analysisStatus="not_analyzed" ledgerTotal={17000} title="월 대조" />);
  const section = screen.getByRole('region', { name: '월 대조' });
  expect(within(section).queryByText('불일치', { exact: true })).not.toBeInTheDocument();
  expect(within(section).getByText(/모든 연결 파일의 분석이 완료/)).toBeInTheDocument();
  expect(within(section).getByText(/대장 − 사용내역 차액/)).toHaveTextContent('미확인');
});

test('compares ledger and complete usage independently when the PDF has no verified subtotal', () => {
  render(<CardStatementReconciliation results={[{ ...result, statementTotalAvailable: false }]} analysisStatus="completed" ledgerTotal={17000} />);
  expect(screen.getByText('대장 대비 불일치')).toBeInTheDocument();
  expect(screen.getByText('2,000원')).toBeInTheDocument();
  expect(screen.getByText(/원본에서 확인한 카드 총액이 없습니다/)).toBeInTheDocument();
});
