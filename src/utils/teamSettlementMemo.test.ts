import { buildTeamExpenseSettlementMemo, compactTeamSettlementAutoMemo, formatTeamSettlementMemo } from './teamSettlementMemo';

describe('team settlement automatic memos', () => {
  test.each([
    ['daily_report', '지원정산 정산금액 기준', '지원정산'],
    ['내부지원간곳', '지원단가 기준 노임총액', '지원단가'],
    ['외부지원온곳', '지원단가 기준 노임총액', '지원단가'],
    ['accommodation_billing', '월별 공과금 대장 자동집계', '월 집계'],
    ['card_billing', '월별 카드 대장 자동집계', '월 집계'],
    ['vehicle_billing', '월별 차량 대장 배정일 자동배분 (12일)', '배분 12일'],
    ['office_expense', '도급+직영 총공수 12.5 * 10,000원', '12.5공수×1만원'],
    ['daily_wage_payroll', '일급제 3명 / 총공수 12.5', '3명·12.5공수'],
    ['monthly_wage_payroll', '월급제 2명 / 총공수 30', '2명·30공수'],
    ['service_team_payroll', '용역팀 4명 / 총공수 28', '4명·28공수']
  ])('shortens %s while retaining calculation values', (origin, memo, expected) => {
    const original = { source: 'auto', origin, memo, amount: 123456 };
    const result = compactTeamSettlementAutoMemo(original);
    expect(result).toEqual({ ...original, memo: expected });
    expect(original.memo).toBe(memo);
    expect(compactTeamSettlementAutoMemo(result)).toBe(result);
  });

  test.each([
    { source: 'manual', origin: 'card_billing', memo: '월별 카드 대장 자동집계' },
    { source: 'auto', origin: 'card_billing', memo: '월별 카드 대장 자동집계 / 다음 달 확인' },
    { source: 'auto', origin: 'manual', memo: '월별 카드 대장 자동집계' },
    { source: 'auto', origin: 'monthly_wage_payroll', memo: '일급제 3명 / 총공수 12.5' },
    { source: 'auto', origin: 'team_expense_claim', memo: '2026-09-01 / 현장 / 카드 / 후청구: 테스트팀 / 전달사항' },
    { source: 'auto', origin: 'vehicle_billing', memo: '' },
    { source: 'auto', origin: 'card_billing' }
  ])('preserves manual, custom, ambiguous or empty notes: %j', item => {
    expect(compactTeamSettlementAutoMemo(item)).toBe(item);
    expect(formatTeamSettlementMemo(item)).toBe(item.memo ?? '');
  });

  const claim = {
    date: '2026-09-01', claimType: 'teamCharge' as const,
    chargeToTeamId: 'team-b', payerTeamName: '사용팀', chargeToTeamName: '청구팀',
    siteName: '긴 현장 이름', cardLabel: '긴 카드 이름', memo: '사용자가 입력한 설명 / 내용 전체 유지'
  };

  test('new claim memos omit repeated site/card metadata but preserve the full user note and direction', () => {
    expect(buildTeamExpenseSettlementMemo(claim, 'deduction')).toBe('2026-09-01 / 후청구: 사용팀 / 사용자가 입력한 설명 / 내용 전체 유지');
    expect(buildTeamExpenseSettlementMemo(claim, 'addition')).toBe('2026-09-01 / 받을 후청구: 청구팀 / 사용자가 입력한 설명 / 내용 전체 유지');
  });

  test('office and other claims retain their source label without empty separators', () => {
    expect(buildTeamExpenseSettlementMemo({ ...claim, claimType: 'officeExpense', memo: '' }, 'deduction')).toBe('2026-09-01 / 사무실경비');
    expect(buildTeamExpenseSettlementMemo({ ...claim, chargeToTeamId: '', memo: undefined }, 'deduction')).toBe('2026-09-01 / 기타청구');
  });
});
