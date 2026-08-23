export type SupportMonthlyRateOverrides = {
  bulkSupportRate?: number;
  bulkRate?: number;
  supportTeamRates: Record<string, number>;
  supportAggregateRates: Record<string, number>;
  supportSiteRates: Record<string, number>;
  teamRates: Record<string, number>;
  aggregateRates: Record<string, number>;
  siteRates: Record<string, number>;
};

export const DEFAULT_SUPPORT_UNIT_PRICE = 230000;

export type SupportMonthlyRateOverridePatch = Partial<Pick<
  SupportMonthlyRateOverrides,
  | 'bulkSupportRate'
  | 'bulkRate'
  | 'supportTeamRates'
  | 'supportAggregateRates'
  | 'supportSiteRates'
  | 'teamRates'
  | 'aggregateRates'
  | 'siteRates'
>>;

const toPositiveRate = (value: unknown): number | null => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.replace(/,/g, ''))
      : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

export const normalizeSupportRateOverrides = (
  value: Partial<SupportMonthlyRateOverrides> | undefined
): SupportMonthlyRateOverrides => {
  const normalizeRateMap = (raw: unknown): Record<string, number> => {
    if (!raw || typeof raw !== 'object') return {};
    return Object.entries(raw as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, rate]) => {
      const parsed = toPositiveRate(rate);
      if (parsed) acc[key] = parsed;
      return acc;
    }, {});
  };

  return {
    bulkSupportRate: toPositiveRate(value?.bulkSupportRate) ?? undefined,
    bulkRate: toPositiveRate(value?.bulkRate) ?? undefined,
    supportTeamRates: normalizeRateMap(value?.supportTeamRates),
    supportAggregateRates: normalizeRateMap(value?.supportAggregateRates),
    supportSiteRates: normalizeRateMap(value?.supportSiteRates),
    teamRates: normalizeRateMap(value?.teamRates),
    aggregateRates: normalizeRateMap(value?.aggregateRates),
    siteRates: normalizeRateMap(value?.siteRates)
  };
};

export const hasSupportRateOverrides = (overrides: SupportMonthlyRateOverrides): boolean => Boolean(
  overrides.bulkSupportRate ||
  overrides.bulkRate ||
  Object.keys(overrides.supportTeamRates).length > 0 ||
  Object.keys(overrides.supportAggregateRates).length > 0 ||
  Object.keys(overrides.supportSiteRates).length > 0 ||
  Object.keys(overrides.teamRates).length > 0 ||
  Object.keys(overrides.aggregateRates).length > 0 ||
  Object.keys(overrides.siteRates).length > 0
);

export const mergeSupportRateOverridePatch = (
  current: SupportMonthlyRateOverrides,
  patch: SupportMonthlyRateOverridePatch
): SupportMonthlyRateOverrides => {
  const normalizedPatch = normalizeSupportRateOverrides(patch);
  const hasOwn = (key: keyof SupportMonthlyRateOverridePatch): boolean =>
    Object.prototype.hasOwnProperty.call(patch, key);

  return normalizeSupportRateOverrides({
    ...current,
    bulkSupportRate: hasOwn('bulkSupportRate') ? normalizedPatch.bulkSupportRate : current.bulkSupportRate,
    bulkRate: hasOwn('bulkRate') ? normalizedPatch.bulkRate : current.bulkRate,
    supportTeamRates: hasOwn('supportTeamRates')
      ? { ...current.supportTeamRates, ...normalizedPatch.supportTeamRates }
      : current.supportTeamRates,
    supportAggregateRates: hasOwn('supportAggregateRates')
      ? { ...current.supportAggregateRates, ...normalizedPatch.supportAggregateRates }
      : current.supportAggregateRates,
    supportSiteRates: hasOwn('supportSiteRates')
      ? { ...current.supportSiteRates, ...normalizedPatch.supportSiteRates }
      : current.supportSiteRates,
    teamRates: hasOwn('teamRates')
      ? { ...current.teamRates, ...normalizedPatch.teamRates }
      : current.teamRates,
    aggregateRates: hasOwn('aggregateRates')
      ? { ...current.aggregateRates, ...normalizedPatch.aggregateRates }
      : current.aggregateRates,
    siteRates: hasOwn('siteRates')
      ? { ...current.siteRates, ...normalizedPatch.siteRates }
      : current.siteRates
  });
};
