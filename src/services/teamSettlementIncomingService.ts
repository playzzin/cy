import { getTeamScopedRows } from './teamScopedReadService';
import { aggregateIncomingSettlementTeams } from '../utils/teamSettlementIncomingAggregation';
import { auth } from '../config/firebase';

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

export const getTeamSettlementIncomingRows = async (params: { yearMonth: string; teamId: string }): Promise<TeamSettlementIncomingRow[]> => {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(params.yearMonth) || !params.teamId.trim()) {
    throw new Error('정산 조회 월과 팀을 확인해 주세요.');
  }
  const account = auth.currentUser;
  const scoped = await getTeamScopedRows<TeamSettlementIncomingRow>('team_settlement_incoming', params);
  if (scoped !== null) return scoped;

  // null means the existing unrestricted route, not a successful empty result.
  // Do not fall back here when a team leader's callable rejects the request.
  const [{ dailyReportService }, { teamService }, { siteService }, { manpowerService }, { supportRateService }] = await Promise.all([
    import('./dailyReportService'), import('./teamService'), import('./siteService'),
    import('./manpowerService'), import('./supportRateService')
  ]);
  const [year, month] = params.yearMonth.split('-').map(Number);
  const endDate = `${params.yearMonth}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
  const [reports, teams, sites, workers, siteRates] = await Promise.all([
    dailyReportService.getReportsByRange(`${params.yearMonth}-01`, endDate),
    teamService.getTeams(), siteService.getSites(), manpowerService.getWorkers(), supportRateService.getAllSiteRates()
  ]);
  if (auth.currentUser !== account) throw new Error('로그인 계정이 변경되었습니다. 다시 조회해 주세요.');
  return aggregateIncomingSettlementTeams({ ...params, reports, teams, sites, workers, siteRates });
};
