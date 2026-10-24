import type { TeamSettlementIncomingRow } from '../services/teamSettlementIncomingService';

type DirectoryRow = {
  id?: string; legacyId?: string; name?: string; teamId?: string;
  responsibleTeamId?: string; supportRate?: number;
};
type Report = {
  date: string; siteId?: string; siteName?: string; responsibleTeamId?: string; teamId?: string;
  workers: Array<{ workerId?: string; teamId?: string; workerTeamName?: string; manDay: number }>;
};
const text = (value: unknown) => String(value ?? '').trim();
const ids = (row: DirectoryRow) => [text(row.id), text(row.legacyId)].filter(Boolean);
const positiveRate = (value: unknown) => {
  const number = Number(typeof value === 'string' ? value.replace(/,/g, '') : value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
};

// This is the unrestricted reader's projection of data it may already read.
// Team leaders keep using the server aggregate, including all authorization checks.
export const aggregateIncomingSettlementTeams = (input: {
  yearMonth: string; teamId: string; reports: Report[]; teams: DirectoryRow[];
  sites: DirectoryRow[]; workers: DirectoryRow[];
  siteRates: Array<{ id?: string; siteId: string; defaultRate: number }>;
}): TeamSettlementIncomingRow[] => {
  const selected = input.teams.find(team => ids(team).includes(input.teamId));
  if (!selected) return [];
  const teamIds = ids(selected);
  const ownWorkerIds = new Set(input.workers.filter(worker => teamIds.includes(text(worker.teamId))).flatMap(ids));
  const grouped = new Map<string, TeamSettlementIncomingRow>();
  for (const report of input.reports) {
    if (!report.date.startsWith(`${input.yearMonth}-`)) continue;
    const site = input.sites.find(row => ids(row).includes(text(report.siteId)));
    const responsible = text(report.responsibleTeamId) || text(report.teamId) || text(site?.responsibleTeamId);
    if (!teamIds.includes(responsible)) continue;
    for (const worker of report.workers) {
      const workerTeam = input.teams.find(team => ids(team).includes(text(worker.teamId)));
      if (ownWorkerIds.has(text(worker.workerId)) || teamIds.includes(text(worker.teamId))
        || (workerTeam && ids(workerTeam).some(id => teamIds.includes(id)))) continue;
      const teamId = text(workerTeam?.id) || text(worker.teamId);
      const teamName = text(worker.workerTeamName) || text(workerTeam?.name);
      const manDay = Number(worker.manDay);
      if ((!teamId && !teamName) || !Number.isFinite(manDay) || manDay <= 0) continue;
      const siteId = text(site?.id) || text(report.siteId);
      const siteName = text(report.siteName) || text(site?.name);
      const key = JSON.stringify([report.date, siteId || siteName, teamId || teamName]);
      const configured = input.siteRates.find(rate => [siteId, text(site?.legacyId)].filter(Boolean).includes(text(rate.siteId || rate.id)));
      const siteRate = positiveRate(configured?.defaultRate);
      const teamRate = positiveRate(workerTeam?.supportRate);
      const supportRate = siteRate ?? teamRate ?? 230000;
      const totalManDay = Math.round(((grouped.get(key)?.manDay ?? 0) + manDay) * 10000) / 10000;
      grouped.set(key, {
        id: key, date: report.date, siteId, siteName, teamId, teamName: teamName || '지원팀',
        ...(site?.legacyId ? { siteLegacyId: site.legacyId } : {}),
        ...(workerTeam?.legacyId ? { teamLegacyId: workerTeam.legacyId } : {}),
        manDay: totalManDay, supportRate, supportAmount: Math.round(totalManDay * supportRate),
        rateSource: siteRate ? 'site' : teamRate ? 'team' : 'default'
      });
    }
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date) || a.teamName.localeCompare(b.teamName));
};
