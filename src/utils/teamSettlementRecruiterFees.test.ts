import { buildTeamSettlementRecruiterFeeDeductions } from './teamSettlementRecruiterFees';
import type { DailyAdvanceStatementRecruiterFee } from '../services/dailyAdvanceStatementRecruiterFeeService';

const fee = (workerId: string, amount: number, teamKey = 'team-a', month = '2026-08'): DailyAdvanceStatementRecruiterFee =>
  ({ workerId, amount, teamKey, month });
const build = (fees: DailyAdvanceStatementRecruiterFee[]) => buildTeamSettlementRecruiterFeeDeductions({
  yearMonth: '2026-08', teamId: 'team-a', teamIdVariants: new Set(['team-a', 'legacy-a']), fees,
  workerNames: new Map([['a', '가상인력 A'], ['b', '가상인력 B']])
});

test('해당 월·팀의 작업자별 저장 소개비만 합산한다', () => {
  expect(build([
    fee('a', 120000), fee('b', 30000, 'legacy-a'), fee('other', 900000, 'team-b'),
    fee('other-month', 900000, 'team-a', '2026-07'), fee('zero', 0), fee('negative', -100),
    fee('infinite', Infinity), fee('nan', NaN), fee('', 9999)
  ])).toEqual([expect.objectContaining({ source: 'auto', origin: 'daily_advance_recruiter_fee', amount: 150000, memo: '청구서 소개비 2명',
    recruiterFeeDetails: [{ workerId: 'a', workerName: '가상인력 A', amount: 120000 }, { workerId: 'b', workerName: '가상인력 B', amount: 30000 }] })]);
});

test('같은 작업자의 이전 팀 ID 중복은 제외하고 현재 팀의 0원 저장도 우선한다', () => {
  expect(build([fee('a', 10000, 'legacy-a'), fee('a', 20000), fee('b', 0), fee('b', 5000, 'legacy-a')]))
    .toEqual([expect.objectContaining({ amount: 20000, memo: '청구서 소개비 1명' })]);
});

test('소개비가 없거나 0원이면 급여 항목을 만들지 않는다', () => {
  expect(build([])).toEqual([]);
  expect(build([fee('a', 0)])).toEqual([]);
});
