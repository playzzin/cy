import { applyServiceRecruiterFees, buildDailyAdvanceServiceRows } from './dailyAdvanceServiceStatement';
import { buildTeamSettlementInvoiceDeduction } from './teamSettlementInvoice';
import { TeamSettlementDeductionItemSchema } from '../types/teamSettlement';
import type { DailyAdvanceStatementEntry } from './dailyAdvanceStatement';
const entry = (date: string, patch: Partial<DailyAdvanceStatementEntry> = {}): DailyAdvanceStatementEntry => ({
  key: `${date}__a`, workerId: 'w', workerName: '검증', teamId: 'a', teamKey: 'a', teamName: '가팀',
  salaryType: '용역팀', date, day: Number(date.slice(-2)), manDay: 1, reportUnitPrice: 100000, workerAmount: 90000, claimUnitPrice: 100000, ...patch
});

test('최초 5개 실제 근무일만 소개비를 부과하며 같은 날짜의 여러 일보·소수 공수를 합산한다', () => {
  const current = [entry('2026-08-01', { manDay: 0.5 }), entry('2026-08-01', { key: 'second', manDay: 1.5 }), entry('2026-08-02'), entry('2026-08-03')];
  const history = [...[27, 28, 29, 30].map(day => entry(`2026-07-${day}`)), entry('2026-07-01', { manDay: 0 }), ...current];
  const rows = buildDailyAdvanceServiceRows(applyServiceRecruiterFees(current, history));
  expect(rows[0]).toMatchObject({ totalManDay: 4, totalRecruiterFee: 60000, totalClaimAmount: 400000 });
  expect(rows[0].entriesByDay[1]).toMatchObject({ manDay: 2, recruiterFee: 60000, cumulativeCount: 5 });
  expect(rows[0].entriesByDay[2].recruiterFee).toBe(0);
});

test('팀 필터 전 소개비를 한 번만 배정하고 입력 순서가 달라도 같은 팀에 배정한다', () => {
  const current = [entry('2026-08-01', { key: 'b', teamKey: 'b' }), entry('2026-08-01', { key: 'a', manDay: 0.5 }), entry('2026-08-01', { key: '0', manDay: 0 })];
  const a = applyServiceRecruiterFees(current, current);
  const b = applyServiceRecruiterFees([...current].reverse(), current);
  expect(a.filter(row => row.recruiterFee)).toEqual(b.filter(row => row.recruiterFee));
  expect(a.find(row => row.key === 'a')?.recruiterFee).toBe(60000);
  expect(a.reduce((sum, row) => sum + row.recruiterFee, 0)).toBe(60000);
});

test('용역 노무비와 소개비를 한 번만 공제하고 저장 스키마에서 용역 구분을 유지한다', () => {
  const current = [entry('2026-08-01')];
  const rows = buildDailyAdvanceServiceRows(applyServiceRecruiterFees(current, current));
  const deduction = TeamSettlementDeductionItemSchema.parse(buildTeamSettlementInvoiceDeduction('2026-08', 'a', [], rows));
  expect(deduction).toMatchObject({ amount: 160000, invoiceDetails: [{ invoiceType: 'service', claimAmount: 100000, recruiterFee: 60000, invoiceAmount: 160000, recruiterFeeDates: ['2026-08-01'] }] });
});
