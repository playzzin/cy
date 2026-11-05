import type { TeamSettlementDocument } from '../types/teamSettlement';
import { TeamSettlementDocumentSchema } from '../types/teamSettlement';
import { getTeamSettlementConfirmationIssues } from './teamSettlementDraft';
import { prepareTeamSettlementManualSales, unlockTeamSettlementManualSales } from './teamSettlementManualSales';

const document = (): TeamSettlementDocument => ({
  yearMonth: '2026-11', teamId: 'team', teamName: '검증팀', confirmedAt: null, updatedAt: '2026-11-01T00:00:00.000Z',
  sales: [
    { id: 'direct', source: 'auto', origin: 'daily_report', kind: '직영', siteName: '자동 직영', manDay: 2, amount: 400000 },
    { id: 'allocated', source: 'auto', origin: 'support_client_site', kind: '직영', siteName: '자동 지원정산', manDay: 1, amount: 500000 },
    { id: 'contract', source: 'auto', origin: 'daily_report', kind: '도급', siteName: '입력 도급', manDay: 3, amount: 900000, amountOverridden: true },
    { id: 'manual', source: 'manual', origin: 'manual', kind: '직영', siteName: '수기 현장', manDay: 1, amount: 300000 },
    { id: 'support', source: 'auto', origin: '내부지원간곳', kind: '지원', siteName: '지원 현장', manDay: 1, amount: 270000 }
  ],
  purchases: [], deductions: [], additions: [], summary: { prevCarryover: 123, deposit: 456 }, transactionMemo: '보존할 메모',
  sourceSnapshot: { version: 2, capturedAt: '2026-11-01T00:00:00.000Z', dailyReports: [], supportDetails: [],
    totals: { sales: 2070000, purchases: 0, deductions: 0, additions: 0, net: 2070000 } }
});

it('미확정 자동금액만 비우고 수기·지원금액·공수·원본 객체를 보존한다', () => {
  const original = document();
  const unchanged = JSON.parse(JSON.stringify(original));
  const result = prepareTeamSettlementManualSales(original);
  expect(result.sales.map(row => row.amount)).toEqual([0, 0, 900000, 300000, 270000]);
  expect(result.sales.map(row => row.manDay)).toEqual([2, 1, 3, 1, 1]);
  expect(result.summary).toEqual(original.summary);
  expect(result.transactionMemo).toBe(original.transactionMemo);
  expect(result.sourceSnapshot?.totals).toEqual({ sales: 270000, purchases: 0, deductions: 0, additions: 0, net: 270000 });
  expect(result.sourceSnapshot?.manualContractDirectAmounts).toBe(true);
  expect(TeamSettlementDocumentSchema.parse(result).sourceSnapshot?.manualContractDirectAmounts).toBe(true);
  expect(original).toEqual(unchanged);
  expect(prepareTeamSettlementManualSales(result)).toEqual(result);
});

it('확정 문서는 그대로 유지하고 확정 취소 후에도 확정했던 금액을 보존한다', () => {
  const confirmed = { ...document(), confirmedAt: '2026-11-02T00:00:00.000Z' };
  expect(prepareTeamSettlementManualSales(confirmed)).toBe(confirmed);
  const unlocked = unlockTeamSettlementManualSales(confirmed);
  expect(unlocked.confirmedAt).toBeNull();
  expect(unlocked.sales.map(row => row.amount)).toEqual(confirmed.sales.map(row => row.amount));
  expect(unlocked.sales.slice(0, 3).every(row => row.amountOverridden)).toBe(true);
  expect(prepareTeamSettlementManualSales(unlocked)).toEqual(unlocked);
  expect(getTeamSettlementConfirmationIssues(unlocked)).toEqual([]);
});

it('직접 입력한 금액은 확정 검사를 통과하고 미입력·지원금액 불일치는 계속 차단한다', () => {
  const draft = prepareTeamSettlementManualSales(document());
  expect(getTeamSettlementConfirmationIssues(draft).map(issue => issue.code)).toEqual(['sales-amount:direct', 'sales-amount:allocated']);
  draft.sales = draft.sales.map(row => row.id === 'direct' || row.id === 'allocated'
    ? { ...row, amount: 700000, amountOverridden: true } : row);
  expect(getTeamSettlementConfirmationIssues(draft)).toEqual([]);
  draft.sales = draft.sales.map(row => row.id === 'support' ? { ...row, amount: 300000 } : row);
  const checked = prepareTeamSettlementManualSales(draft);
  expect(getTeamSettlementConfirmationIssues(checked).map(issue => issue.code)).toEqual(['snapshot-total:sales']);
});

it('명시적으로 지운 금액은 0원으로 유지하며 기존 지원 전용 문서를 변경하지 않는다', () => {
  const draft = document();
  draft.sales[0] = { ...draft.sales[0], amount: 0, amountOverridden: true };
  expect(prepareTeamSettlementManualSales(draft).sales[0]).toEqual(draft.sales[0]);
  const supportOnly = { ...draft, sales: draft.sales.filter(row => row.kind === '지원') };
  expect(prepareTeamSettlementManualSales(supportOnly)).toBe(supportOnly);
});
