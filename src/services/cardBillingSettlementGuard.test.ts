import {
  getConfirmedTeamSettlementConfigIdForCardBilling,
  isConfirmedTeamSettlementConfigData
} from './cardBillingSettlementGuard';

describe('card billing team-settlement transaction guard', () => {
  it('builds the exact system config id used by team settlement', () => {
    expect(getConfirmedTeamSettlementConfigIdForCardBilling({
      yearMonth: '2026-07',
      teamId: 'team-1'
    })).toBe('team_settlement_2026-07__team-1');
  });

  it('recognizes confirmed JSON and object payloads', () => {
    expect(isConfirmedTeamSettlementConfigData({
      data: JSON.stringify({ confirmedAt: '2026-08-19T01:00:00.000Z' })
    })).toBe(true);
    expect(isConfirmedTeamSettlementConfigData({
      data: { confirmedAt: '2026-08-19T01:00:00.000Z' }
    })).toBe(true);
  });

  it('does not block an unconfirmed, malformed, or unrelated config', () => {
    expect(isConfirmedTeamSettlementConfigData({ data: JSON.stringify({ confirmedAt: null }) })).toBe(false);
    expect(isConfirmedTeamSettlementConfigData({ data: '{bad json' })).toBe(false);
    expect(isConfirmedTeamSettlementConfigData({ other: 'value' })).toBe(false);
  });
});
