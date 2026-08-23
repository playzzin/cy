import { listSystemConfigs } from './firestoreCrudCompat';

type SystemConfigRow = {
  id?: unknown;
  data?: unknown;
};

export interface ConfirmedTeamSettlementKeys {
  teamIds: Set<string>;
  teamNames: Set<string>;
}

export interface TeamSettlementTargetIdentity {
  teamId?: unknown;
  teamName?: unknown;
}

export const normalizeTeamSettlementProtectionKey = (value: unknown): string => (
  String(value ?? '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
);

const extractSystemConfigRows = (value: unknown): SystemConfigRow[] => {
  if (!value || typeof value !== 'object') return [];
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return [];
  const rows = (data as { systemConfigs?: unknown }).systemConfigs;
  return Array.isArray(rows) ? rows as SystemConfigRow[] : [];
};

const parseConfigData = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

export const extractConfirmedTeamSettlementKeys = (
  response: unknown,
  yearMonth: string
): ConfirmedTeamSettlementKeys => {
  const teamIds = new Set<string>();
  const teamNames = new Set<string>();

  extractSystemConfigRows(response).forEach((row) => {
    if (!String(row.id ?? '').startsWith('team_settlement_')) return;
    const data = parseConfigData(row.data);
    if (!data || String(data.yearMonth ?? '') !== yearMonth) return;
    if (!String(data.confirmedAt ?? '').trim()) return;

    const teamId = normalizeTeamSettlementProtectionKey(data.teamId);
    const teamName = normalizeTeamSettlementProtectionKey(data.teamName);
    if (teamId) teamIds.add(teamId);
    if (teamName) teamNames.add(teamName);
  });

  return { teamIds, teamNames };
};

export const isConfirmedTeamSettlementTarget = (
  keys: ConfirmedTeamSettlementKeys,
  target: TeamSettlementTargetIdentity
): boolean => {
  const teamId = normalizeTeamSettlementProtectionKey(target.teamId);
  const teamName = normalizeTeamSettlementProtectionKey(target.teamName);
  return Boolean(
    (teamId && keys.teamIds.has(teamId)) ||
    (teamName && keys.teamNames.has(teamName))
  );
};

export const teamSettlementProtectionService = {
  /**
   * Strict read used before ledger writes. Callers must not replace a failed
   * read with an empty set because doing so could rewrite a confirmed month.
   */
  getConfirmedTeamSettlementKeys: async (yearMonth: string): Promise<ConfirmedTeamSettlementKeys> => {
    // The compatibility list API defaults to 1,000 rows. Team/month snapshots
    // can legitimately exceed that over time, so protection reads must request
    // the complete practical range instead of silently missing older months.
    const response = await listSystemConfigs({ limit: 100_000, offset: 0 });
    return extractConfirmedTeamSettlementKeys(response, yearMonth);
  },
  isConfirmedTarget: isConfirmedTeamSettlementTarget
};
