import {
  applySupportTeamOrder,
  getSupportTeamOrderId,
  mergeVisibleSupportTeamOrder,
  normalizeSupportTeamOrder,
} from './supportTeamOrder';

describe('supportTeamOrder', () => {
  const teams = [
    { id: 'team-a', name: '가팀' },
    { id: 'team-b', name: '나팀' },
    { id: 'team-c', name: '다팀' },
  ];

  it('uses id, legacyId, then name as the stable team key', () => {
    expect(getSupportTeamOrderId({ id: 'team-a', legacyId: 'legacy-a', name: '가팀' })).toBe('team-a');
    expect(getSupportTeamOrderId({ legacyId: 'legacy-b', name: '나팀' })).toBe('legacy-b');
    expect(getSupportTeamOrderId({ name: '사무실' })).toBe('사무실');
  });

  it('applies saved ranks and keeps newly added teams in their source order', () => {
    const result = applySupportTeamOrder(teams, ['team-c', 'team-a']);

    expect(result.map(getSupportTeamOrderId)).toEqual(['team-c', 'team-a', 'team-b']);
  });

  it('preserves hidden team positions when a visible subset is reordered', () => {
    const result = mergeVisibleSupportTeamOrder(
      ['team-a', 'hidden-team', 'team-b', 'team-c'],
      ['team-c', 'team-a', 'team-b']
    );

    expect(result).toEqual(['team-c', 'hidden-team', 'team-a', 'team-b']);
  });

  it('removes blank and duplicated saved keys', () => {
    expect(normalizeSupportTeamOrder(['team-a', '', 'team-a', null, ' team-b ']))
      .toEqual(['team-a', 'team-b']);
  });
});
