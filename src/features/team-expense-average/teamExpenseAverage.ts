import type { DailyReport } from '../../services/dailyReportService';
import type { Team } from '../../services/teamService';

export type TeamAverageExpense = {
  responsibleSiteManDay: number;
  supportManDay: number;
  totalManDay: number;
  averageExpense: number | null;
};

/** Use worker-level historical affiliation, never the report's whole-site total. */
export const calculateTeamAverageExpense = (
  expense: number,
  team: Pick<Team, 'id' | 'legacyId' | 'name'>,
  reports: DailyReport[],
  yearMonth: string
): TeamAverageExpense => {
  const ids = new Set([team.id, team.legacyId].filter(Boolean));
  const matchesTeam = (id?: string | null, name?: string | null) =>
    id ? ids.has(id) : Boolean(name && name === team.name);
  let responsibleSiteManDay = 0;
  let supportManDay = 0;
  const seenReportIds = new Set<string>();
  for (const report of reports) {
    if (!report.date.startsWith(`${yearMonth}-`)) continue;
    if (report.id && seenReportIds.has(report.id)) continue;
    if (report.id) seenReportIds.add(report.id);
    const responsibleId = report.responsibleTeamId || report.teamId;
    const responsibleName = report.responsibleTeamName || report.teamName;
    if (!responsibleId && !responsibleName) continue;
    const isResponsible = matchesTeam(responsibleId, responsibleName);
    for (const worker of report.workers ?? []) {
      const hasWorkerTeam = Boolean(worker.teamId || worker.workerTeamName);
      if (!matchesTeam(
        hasWorkerTeam ? worker.teamId : report.teamId,
        hasWorkerTeam ? worker.workerTeamName : report.teamName
      )) continue;
      const manDay = Number(worker.manDay);
      if (!Number.isFinite(manDay) || manDay <= 0) continue;
      if (isResponsible) responsibleSiteManDay += manDay;
      else supportManDay += manDay;
    }
  }
  const totalManDay = responsibleSiteManDay + supportManDay;
  return {
    responsibleSiteManDay,
    supportManDay,
    totalManDay,
    averageExpense: totalManDay > 0 ? expense / totalManDay : null
  };
};
