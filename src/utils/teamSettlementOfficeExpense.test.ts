import { TeamSettlementDeductionItemSchema, type TeamSettlementSalesItem } from '../types/teamSettlement';
import { calculateTeamSettlementOfficeExpense, LEGACY_TEAM_SETTLEMENT_OFFICE_RATES } from './teamSettlementOfficeExpense';

const sale = (kind: TeamSettlementSalesItem['kind'], manDay: number, extra: Partial<TeamSettlementSalesItem> = {}): TeamSettlementSalesItem => ({
  id: kind, source: 'auto', origin: 'daily_report', kind, siteName: '테스트 현장', manDay, amount: 900000, ...extra
});

test('도급과 직영이 같은 현장이어도 각 단가로 계산하고 매출 금액은 사용하지 않는다', () => {
  const result = calculateTeamSettlementOfficeExpense([sale('도급', 10), sale('직영', 8)]);
  expect(result.totalAmount).toBe(140000);
  expect(result.totalManDay).toBe(18);
  expect(result.sites.map(row => [row.kind, row.rate, row.amount])).toEqual([
    ['도급', 10000, 100000], ['직영', 5000, 40000]
  ]);
  expect(result.memo).toBe('도급 10공수×10,000원 + 직영 8공수×5,000원');
});

test('지원 공수와 수기 매출은 사무실비에 포함하지 않는다', () => {
  const result = calculateTeamSettlementOfficeExpense([
    sale('지원', 20), sale('도급', 30, { source: 'manual', origin: 'manual' }),
    sale('직영', 2.5, { origin: 'support_client_site' })
  ]);
  expect(result.totalAmount).toBe(12500);
  expect(result.contractManDay).toBe(0);
  expect(result.directManDay).toBe(2.5);
});

test('소수 공수와 비어 있는 정산을 처리한다', () => {
  expect(calculateTeamSettlementOfficeExpense([sale('도급', 1.5), sale('직영', 0.5)]).totalAmount).toBe(17500);
  expect(calculateTeamSettlementOfficeExpense([]).totalAmount).toBe(0);
});

test('구 정산의 저장 단가는 유지하며 새 단가도 저장 형식을 통과한다', () => {
  expect(calculateTeamSettlementOfficeExpense([sale('직영', 3)], LEGACY_TEAM_SETTLEMENT_OFFICE_RATES).totalAmount).toBe(30000);
  const deduction = { id: 'office', source: 'auto', origin: 'office_expense', category: '사무실비', amount: 15000 };
  expect(TeamSettlementDeductionItemSchema.parse(deduction).officeExpenseRates).toBeUndefined();
  expect(TeamSettlementDeductionItemSchema.parse({ ...deduction, officeExpenseRates: { contract: 10000, direct: 5000 } }).officeExpenseRates)
    .toEqual({ contract: 10000, direct: 5000 });
});
