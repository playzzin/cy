import type { CardBillingDocument } from '../types/cardBilling';

export const getConfirmedTeamSettlementConfigIdForCardBilling = (
  billing: Partial<CardBillingDocument>
): string => {
  const yearMonth = String(billing.yearMonth ?? '').trim();
  const teamId = String(billing.teamId ?? '').trim();
  return yearMonth && teamId ? `team_settlement_${yearMonth}__${teamId}` : '';
};

export const isConfirmedTeamSettlementConfigData = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const rawData = (value as { data?: unknown }).data;
  let parsed: Record<string, unknown> | null = null;
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    parsed = rawData as Record<string, unknown>;
  } else if (typeof rawData === 'string' && rawData.trim()) {
    try {
      const candidate = JSON.parse(rawData) as unknown;
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      return false;
    }
  }
  return Boolean(String(parsed?.confirmedAt ?? '').trim());
};
