import {
  hasSupportRateOverrides,
  mergeSupportRateOverridePatch,
  normalizeSupportRateOverrides,
} from './teamSettlementSupportRateOverrides';

describe('team settlement support-rate overrides', () => {
  it('keeps existing team and site rates when a different site is saved', () => {
    const current = normalizeSupportRateOverrides({
      supportTeamRates: { 'internal::team-a': 230000 },
      supportSiteRates: { 'internal::team-a::site-a': 240000 },
    });

    const next = mergeSupportRateOverridePatch(current, {
      supportSiteRates: { 'internal::team-a::site-b': 250000 },
    });

    expect(next.supportTeamRates).toEqual({ 'internal::team-a': 230000 });
    expect(next.supportSiteRates).toEqual({
      'internal::team-a::site-a': 240000,
      'internal::team-a::site-b': 250000,
    });
  });

  it('normalizes persisted values and ignores zero or invalid rates', () => {
    const overrides = normalizeSupportRateOverrides({
      supportTeamRates: {
        valid: 230000.4,
        zero: 0,
        invalid: Number.NaN,
      },
    });

    expect(overrides.supportTeamRates).toEqual({ valid: 230000 });
    expect(hasSupportRateOverrides(overrides)).toBe(true);
    expect(hasSupportRateOverrides(normalizeSupportRateOverrides(undefined))).toBe(false);
  });
});
