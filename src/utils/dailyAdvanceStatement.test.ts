import { buildDailyAdvanceStatementRows, buildStatementRecruiterFeeValueMap, createDailyAdvanceRowResolver, getReportAmountForEntry } from './dailyAdvanceStatement';
import { buildTeamSettlementInvoiceDeduction } from './teamSettlementInvoice';
import { TeamSettlementDeductionItemSchema } from '../types/teamSettlement';
import type { DailyReportWorkerRow } from '../services/dailyReportService';
import type { Worker } from '../services/manpowerService';
import type { Team } from '../services/teamService';

const teams = [{ id: 'current-team', legacyId: 'old-team', name: '청구팀' }, { id: 'new-team', name: '이동팀' }] as Team[];
const workers = [{ id: 'current-worker', legacyId: 'old-worker', name: '검증 인원', teamId: 'new-team', salaryModel: '월급제', unitPrice: 999000 }] as Worker[];
const resolver = createDailyAdvanceRowResolver(workers, teams);
const report = (patch: Partial<DailyReportWorkerRow> = {}) => ({ reportId: 'r', workerId: 'old-worker', workerName: '검증 인원', workerTeamId: 'old-team', teamId: 'new-team', salaryModel: '일급제', date: '2026-08-01', manDay: 1, unitPrice: 100000, amount: 90000, ...patch } as DailyReportWorkerRow);
const feeValues = buildStatementRecruiterFeeValueMap([
  { month: '2026-08', teamKey: 'current-team', workerId: 'current-worker', amount: 120000 },
  { month: '2026-08', teamKey: 'current-team', workerId: 'absent', amount: 999000 }
]);
const build = (reports: DailyReportWorkerRow[], manDayDrafts?: Record<string, string>) => buildDailyAdvanceStatementRows({
  entries: reports.map(row => resolver.resolveEntry(row).entry), month: '2026-08', teamKey: 'current-team', lastDay: 31,
  recruiterFeeValues: feeValues, manDayDrafts
});

test('일보 당시 소속과 급여제를 우선하고 기존 ID를 현재 ID로 연결한다', () => {
  expect(resolver.resolveEntry(report()).entry).toMatchObject({ workerId: 'current-worker', teamKey: 'current-team', salaryType: '일급제', reportUnitPrice: 100000 });
  expect(build([report()])).toEqual([expect.objectContaining({ workerId: 'current-worker', selectedAmount: 100000, recruiterFee: 120000 })]);
});

test('여러 일보를 인원별로 합산하며 소개비를 한 번만 포함한 금액을 공제한다', () => {
  const rows = build([report(), report({ date: '2026-08-02', manDay: 0.5 }), report({ reportId: 'second-site', manDay: 0.5 })]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ totalManDay: 2, selectedAmount: 200000, recruiterFee: 120000 });
  expect(rows[0].days.slice(0, 2)).toEqual([1.5, 0.5]);
  const deduction = buildTeamSettlementInvoiceDeduction('2026-08', 'current-team', rows);
  expect(deduction).toMatchObject({ amount: 320000, invoiceDetails: [{ workerId: 'current-worker', workerName: '검증 인원', manDay: 2, claimAmount: 200000, recruiterFee: 120000, invoiceAmount: 320000 }] });
  expect(TeamSettlementDeductionItemSchema.safeParse(deduction).success).toBe(true);
});

test('월급제·용역팀·다른 팀 인원 및 청구 인원에 없는 소개비를 제외한다', () => {
  const rows = build([report(), report({ workerId: 'monthly', salaryModel: '월급제' }), report({ workerId: 'agency', salaryModel: '용역팀' }), report({ workerTeamId: 'new-team' })]);
  expect(rows).toHaveLength(1);
  expect(buildTeamSettlementInvoiceDeduction('2026-08', 'current-team', rows).amount).toBe(220000);
  expect(buildTeamSettlementInvoiceDeduction('2026-08', 'current-team', [])).toMatchObject({ amount: 0, invoiceDetails: [] });
});

test('청구서의 수정 공수와 단가가 없는 일보의 금액 환산을 동일하게 적용한다', () => {
  const key = resolver.resolveEntry(report()).entry.key;
  expect(build([report()], { [key]: '1.5' })[0]).toMatchObject({ totalManDay: 1.5, selectedAmount: 150000 });
  expect(getReportAmountForEntry({ reportUnitPrice: 0, manDay: 2, workerAmount: 180000, claimUnitPrice: 0 }, 1.5)).toBe(135000);
  expect(getReportAmountForEntry({ reportUnitPrice: 0, manDay: 0, workerAmount: 0, claimUnitPrice: 100000 }, 0.5)).toBe(50000);
});
