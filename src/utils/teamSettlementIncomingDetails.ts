import type { TeamSettlementIncomingRow } from '../services/teamSettlementIncomingService';
import type { TeamSettlementPurchaseItem, TeamSettlementSalesItem } from '../types/teamSettlement';

type Line = {
  source: string; origin: string; direction: string;
  siteId?: string; siteName?: string; counterTeamId?: string; counterTeamName?: string;
};
const text = (value?: string) => String(value ?? '').trim();
const matches = (id: string | undefined, name: string | undefined, rowId: string, rowName: string, legacyId?: string) => {
  if (!text(id) && !text(name)) return true;
  if (text(id) && rowId) return [rowId, legacyId].includes(text(id));
  return Boolean(text(name) && text(name).replace(/\s/g, '') === text(rowName).replace(/\s/g, ''));
};

export const isIncomingSettlementLine = (line: Line): boolean => line.direction === 'purchase'
  && ['내부지원온곳', '외부지원온곳', 'support_incoming', 'support_fee_incoming'].includes(line.origin);

export const getIncomingTeamsForSettlementLine = (line: Line, rows: TeamSettlementIncomingRow[]): TeamSettlementIncomingRow[] => {
  if (line.source !== 'auto') return [];
  const incoming = isIncomingSettlementLine(line);
  const managedSite = ['daily_report', 'support_client_site'].includes(line.origin) && !line.counterTeamId && !line.counterTeamName;
  if (!incoming && !managedSite) return [];
  return rows.filter(row => matches(line.siteId, line.siteName, row.siteId, row.siteName, row.siteLegacyId)
    && (!incoming || matches(line.counterTeamId, line.counterTeamName, row.teamId, row.teamName, row.teamLegacyId)));
};

export const getOutgoingTeamsForSettlementLine = (line: Line, rows: TeamSettlementIncomingRow[]): TeamSettlementIncomingRow[] => {
  if (line.source !== 'auto' || line.direction !== 'sales'
    || !['내부지원간곳', '외부지원간곳', 'support_outgoing', 'support_fee_outgoing'].includes(line.origin)) return [];
  return rows.filter(row => matches(line.siteId, line.siteName, row.siteId, row.siteName, row.siteLegacyId)
    && matches(line.counterTeamId, line.counterTeamName, row.teamId, row.teamName, row.teamLegacyId));
};

const applySavedSupportRates = (rows: TeamSettlementIncomingRow[], lines: Array<TeamSettlementPurchaseItem | TeamSettlementSalesItem>, direction: 'purchase' | 'sales'): TeamSettlementIncomingRow[] => {
  const groups = new Map<string, { indices: number[]; manDay: number; amount: number }>();
  const result = rows.map((row, index) => {
    const select = direction === 'sales' ? getOutgoingTeamsForSettlementLine : getIncomingTeamsForSettlementLine;
    const matching = lines.filter(line => line.kind === '지원' && select({ ...line, direction }, [row]).length > 0);
    const manDay = matching.reduce((sum, line) => sum + line.manDay, 0);
    if (!matching.length || manDay <= 0) return row;
    const amount = matching.reduce((sum, line) => sum + line.amount, 0);
    const supportRate = amount / manDay;
    const key = JSON.stringify(matching.map(line => line.id).sort());
    const group = groups.get(key) ?? { indices: [], manDay, amount };
    group.indices.push(index);
    groups.set(key, group);
    return { ...row, supportRate, supportAmount: Math.round(row.manDay * supportRate), rateSource: 'saved' };
  });
  groups.forEach(group => {
    const manDay = group.indices.reduce((sum, index) => sum + result[index].manDay, 0);
    if (Math.abs(manDay - group.manDay) > 0.0001) return;
    const amount = group.indices.reduce((sum, index) => sum + (result[index].supportAmount ?? 0), 0);
    const last = group.indices[group.indices.length - 1];
    result[last] = { ...result[last], supportAmount: (result[last].supportAmount ?? 0) + Math.round(group.amount - amount) };
  });
  return result;
};

export const applySavedIncomingSupportRates = (rows: TeamSettlementIncomingRow[], purchases: TeamSettlementPurchaseItem[]) =>
  applySavedSupportRates(rows, purchases, 'purchase');
export const applySavedOutgoingSupportRates = (rows: TeamSettlementIncomingRow[], sales: TeamSettlementSalesItem[]) =>
  applySavedSupportRates(rows, sales, 'sales');
