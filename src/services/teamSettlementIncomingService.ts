import { getTeamScopedRows } from './teamScopedReadService';

// Team totals only, with no individual wages or worker identities.
export interface TeamSettlementIncomingRow {
  id: string;
  date: string;
  siteId: string;
  siteName: string;
  teamId: string;
  teamName: string;
  manDay: number;
  teamLegacyId?: string;
  siteLegacyId?: string;
  supportRate?: number;
  supportAmount?: number;
  rateSource?: string;
}

export const getTeamSettlementIncomingRows = async (params: { yearMonth: string; teamId: string }) => (
  getTeamScopedRows<TeamSettlementIncomingRow>('team_settlement_incoming', params)
);
