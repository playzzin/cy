import {
  buildTeamSettlementTransactionSummary,
  formatTeamSettlementSummaryManDay,
} from './teamSettlementTransactionSummary';

describe('teamSettlementTransactionSummary', () => {
  it('매출 합계를 요청한 강조 문구 형식으로 만든다', () => {
    expect(buildTeamSettlementTransactionSummary('매출', 54079780, 198))
      .toBe('매출 - 54,079,780원 (198공수)');
  });

  it('매입 합계의 소수 공수는 한 자리까지 유지한다', () => {
    expect(buildTeamSettlementTransactionSummary('매입', 20700000, 90.5))
      .toBe('매입 - 20,700,000원 (90.5공수)');
  });

  it('정수 공수의 불필요한 소수점은 제거한다', () => {
    expect(formatTeamSettlementSummaryManDay(90)).toBe('90');
  });
});
