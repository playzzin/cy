import type { DailyReportWorkerRow } from '../services/dailyReportService';
import type { Worker } from '../services/manpowerService';
import type { Team } from '../services/teamService';
import type { DailyAdvanceStatementRecruiterFee } from '../services/dailyAdvanceStatementRecruiterFeeService';
import { resolveDailyAdvanceRowSalaryType } from '../pages/payroll/utils/dailyAdvanceSalaryType';

const text = (value: unknown) => String(value ?? '').trim();
const normalizedName = (value: unknown) => text(value).replace(/\s+/g, '').toLowerCase();
const teamNameKey = (value: unknown) => text(value).replace(/\(.*?\)/g, '').replace(/\s+/g, '');
export const statementNumber = (value: unknown): number => {
  const result = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(result) ? result : 0;
};
export const buildStatementRecruiterFeeKey = (month: string, teamKey: string, workerId: string) => `${month}__${teamKey}__${workerId}`;
export const buildStatementRecruiterFeeValueMap = (fees: DailyAdvanceStatementRecruiterFee[]): Record<string, number> =>
  fees.reduce<Record<string, number>>((result, fee) => {
    const key = fee.key || buildStatementRecruiterFeeKey(fee.month, fee.teamKey, fee.workerId);
    if (key) result[key] = Math.max(0, statementNumber(fee.amount));
    return result;
  }, {});

export type DailyAdvanceStatementEntry = {
  key: string; workerId: string; workerName: string; teamId: string; teamKey: string; teamName: string;
  salaryType: string; date: string; day: number; manDay: number;
  reportUnitPrice: number; workerAmount: number; claimUnitPrice: number;
  recruiterFee?: number; idNumber?: string; address?: string;
};
export const getReportAmountForEntry = (entry: Pick<DailyAdvanceStatementEntry, 'reportUnitPrice' | 'manDay' | 'workerAmount' | 'claimUnitPrice'>, manDay: number): number => {
  const unitPrice = entry.reportUnitPrice > 0 ? entry.reportUnitPrice : entry.manDay > 0 ? entry.workerAmount / entry.manDay : entry.claimUnitPrice;
  return manDay * Math.max(0, unitPrice || 0);
};

/** The workbook and settlement resolve the same report-time worker/team identities. */
export function createDailyAdvanceRowResolver(workers: Worker[], teams: Team[]) {
  const workerById = new Map<string, Worker>();
  const workerByName = new Map<string, Worker>();
  const teamById = new Map<string, Team>();
  const teamByName = new Map<string, Team>();
  const stableId = (worker?: Worker) => text(worker?.id) || text(worker?.legacyId) || normalizedName(worker?.name);
  workers.forEach(worker => {
    const current = text(worker.id); const legacy = text(worker.legacyId); const stable = stableId(worker);
    if (current) workerById.set(current, worker);
    if (legacy && !workerById.has(legacy)) workerById.set(legacy, worker);
    if (stable && !workerById.has(stable)) workerById.set(stable, worker);
    const name = normalizedName(worker.name);
    if (name && !workerByName.has(name)) workerByName.set(name, worker);
  });
  teams.forEach(team => {
    const current = text(team.id); const legacy = text(team.legacyId); const name = teamNameKey(team.name);
    if (current) teamById.set(current, team);
    if (legacy && !teamById.has(legacy)) teamById.set(legacy, team);
    if (name && !teamByName.has(name)) teamByName.set(name, team);
  });
  const getWorkerForRow = (row: DailyReportWorkerRow & { name?: string }) => workerById.get(text(row.workerId)) || workerByName.get(normalizedName(row.workerName || row.name));
  const getStableIdForRow = (row: DailyReportWorkerRow & { name?: string }) => stableId(getWorkerForRow(row)) || text(row.workerId) || normalizedName(row.workerName || row.name);
  const resolveEntry = (row: DailyReportWorkerRow & { name?: string }) => {
    const worker = getWorkerForRow(row);
    const workerId = getStableIdForRow(row);
    const workerName = text(worker?.name || row.workerName || row.name || '');
    const team = teamById.get(text(row.workerTeamId)) || teamById.get(text(row.teamId)) || teamById.get(text(worker?.teamId)) || teamByName.get(teamNameKey(row.workerTeamName || worker?.teamName || row.teamName || '')) || null;
    const teamName = text(team?.name || row.workerTeamName || worker?.teamName || row.teamName || '미지정팀');
    const teamId = text(team?.id ?? row.workerTeamId ?? row.teamId ?? worker?.teamId ?? '');
    const teamKey = teamId || `unresolved:${teamNameKey(teamName || workerName || 'unknown')}`;
    const reportUnitPrice = statementNumber(row.unitPrice || worker?.unitPrice || 0);
    const manDay = statementNumber(row.manDay);
    const date = text(row.date);
    const entry: DailyAdvanceStatementEntry = {
      key: `${date}__${teamKey}__${workerId}__${text(row.reportId)}`, workerId, workerName, teamId, teamKey, teamName,
      salaryType: resolveDailyAdvanceRowSalaryType(row, worker), date, day: Number(/^(\d{4})-(\d{2})-(\d{2})/.exec(date)?.[3]) || 0,
      manDay, reportUnitPrice, workerAmount: statementNumber(row.amount ?? manDay * reportUnitPrice), claimUnitPrice: reportUnitPrice
    };
    return { entry, worker, team };
  };
  return { getWorkerForRow, getStableIdForRow, resolveEntry };
}

export type DailyAdvanceStatementRow = {
  workerId: string; workerName: string; idNumber: string; address: string; salaryType: string;
  days: number[]; totalManDay: number; recruiterFee: number; selectedAmount: number;
};
export function buildDailyAdvanceStatementRows(params: {
  entries: DailyAdvanceStatementEntry[]; month: string; teamKey: string; lastDay: number;
  recruiterFeeValues: Record<string, number>; manDayDrafts?: Record<string, string>;
}): DailyAdvanceStatementRow[] {
  const rows = new Map<string, DailyAdvanceStatementRow>();
  params.entries.filter(entry => entry.teamKey === params.teamKey && entry.salaryType === '일급제').forEach(entry => {
    const key = entry.workerId || normalizedName(entry.workerName);
    if (!rows.has(key)) rows.set(key, {
      workerId: entry.workerId, workerName: entry.workerName, idNumber: entry.idNumber || '', address: entry.address || '', salaryType: entry.salaryType,
      days: Array.from({ length: params.lastDay }, () => 0), totalManDay: 0, selectedAmount: 0,
      recruiterFee: entry.recruiterFee || params.recruiterFeeValues[buildStatementRecruiterFeeKey(params.month, params.teamKey, entry.workerId)] || 0
    });
    const target = rows.get(key)!;
    const draft = params.manDayDrafts?.[entry.key];
    const manDay = draft === undefined ? entry.manDay : statementNumber(draft);
    if (entry.day >= 1 && entry.day <= params.lastDay) target.days[entry.day - 1] += manDay;
    target.totalManDay += manDay;
    target.selectedAmount += getReportAmountForEntry(entry, manDay);
    if (!target.idNumber && entry.idNumber) target.idNumber = entry.idNumber;
    if (!target.address && entry.address) target.address = entry.address;
  });
  return [...rows.values()].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ko'));
}
