import { getReportAmountForEntry, type DailyAdvanceStatementEntry } from './dailyAdvanceStatement';

export const SERVICE_RECRUITER_FEE_PER_DAY = 60000;
const SERVICE_RECRUITER_FEE_MAX_DAYS = 5;
export type ServiceStatementEntry = DailyAdvanceStatementEntry & { recruiterFee: number; cumulativeCount?: number };

/** Count distinct positive service work dates across teams before selecting the invoice team. */
export function applyServiceRecruiterFees<T extends DailyAdvanceStatementEntry>(entries: T[], history: DailyAdvanceStatementEntry[]): Array<T & ServiceStatementEntry> {
  const datesByWorker = new Map<string, Set<string>>();
  history.filter(entry => entry.salaryType === '용역팀' && entry.manDay > 0 && entry.date).forEach(entry => {
    const dates = datesByWorker.get(entry.workerId) || new Set<string>();
    dates.add(entry.date);
    datesByWorker.set(entry.workerId, dates);
  });
  const sortedDates = new Map([...datesByWorker].map(([workerId, dates]) => [workerId, [...dates].sort()]));
  const result = entries.map(entry => ({ ...entry, recruiterFee: 0, cumulativeCount: (sortedDates.get(entry.workerId)?.indexOf(entry.date) ?? -1) + 1 || 999 }));
  const chargedDates = new Set<string>();
  // Stable allocation when a worker has several reports or teams on the same date.
  [...result].sort((a, b) => a.key.localeCompare(b.key)).forEach(entry => {
    const dateKey = `${entry.workerId}__${entry.date}`;
    if (entry.salaryType !== '용역팀' || entry.manDay <= 0 || entry.cumulativeCount > SERVICE_RECRUITER_FEE_MAX_DAYS || chargedDates.has(dateKey)) return;
    entry.recruiterFee = SERVICE_RECRUITER_FEE_PER_DAY;
    chargedDates.add(dateKey);
  });
  return result;
}

export type DailyAdvanceServiceRow = {
  teamKey: string; teamName: string; workerId: string; workerName: string; idNumber: string;
  entriesByDay: Record<number, ServiceStatementEntry>;
  totalManDay: number; totalRecruiterFee: number; totalClaimAmount: number;
};

export function buildDailyAdvanceServiceRows<T extends ServiceStatementEntry>(entries: T[], getManDay: (entry: T) => number = entry => entry.manDay): DailyAdvanceServiceRow[] {
  const grouped = new Map<string, DailyAdvanceServiceRow>();
  entries.filter(entry => entry.salaryType === '용역팀').forEach(entry => {
    const manDay = getManDay(entry);
    const recruiterFee = manDay > 0 ? entry.recruiterFee : 0;
    const key = `${entry.teamKey}__${entry.workerId || entry.workerName}`;
    const row = grouped.get(key) || { teamKey: entry.teamKey, teamName: entry.teamName, workerId: entry.workerId,
      workerName: entry.workerName, idNumber: entry.idNumber || '', entriesByDay: {}, totalManDay: 0, totalRecruiterFee: 0, totalClaimAmount: 0 };
    const previous = row.entriesByDay[entry.day];
    row.entriesByDay[entry.day] = previous ? { ...previous, manDay: previous.manDay + manDay, recruiterFee: previous.recruiterFee + recruiterFee,
      cumulativeCount: previous.recruiterFee > 0 ? previous.cumulativeCount : entry.cumulativeCount } : { ...entry, manDay, recruiterFee };
    row.totalManDay += manDay;
    row.totalRecruiterFee += recruiterFee;
    row.totalClaimAmount += getReportAmountForEntry(entry, manDay);
    grouped.set(key, row);
  });
  return [...grouped.values()].sort((a, b) => a.teamName.localeCompare(b.teamName, 'ko') || a.workerName.localeCompare(b.workerName, 'ko'));
}
