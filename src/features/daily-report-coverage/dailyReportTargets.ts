export type DailyReportTargetSource = 'confirmed' | 'dispatch' | 'requests' | 'unknown' | 'unavailable';

export interface ReportTargetAssignment {
  siteId?: string;
  siteName?: string;
  status?: string;
  workerIds?: string[];
  supportTeamIds?: string[];
  supportTeams?: unknown[];
  requestedHeadcount?: number;
  offDutyWorkerIds?: string[];
}

export interface DailyReportTargetPlan {
  source: DailyReportTargetSource;
  assignments: ReportTargetAssignment[];
}

interface TargetSources {
  date: string;
  confirmed: { date: string; assignments: ReportTargetAssignment[] } | null;
  dispatch: { date: string; assignments: ReportTargetAssignment[] } | null;
  requests: Array<ReportTargetAssignment & { date: string }>;
  failed?: boolean;
}

const noWorkStatuses = new Set(['cancelled', 'canceled', 'off', 'off-duty', 'off_duty', '휴무', '미작업', '취소']);
const text = (value: unknown): string => String(value ?? '').trim();

export const resolveDailyReportTargets = ({ date, confirmed, dispatch, requests, failed }: TargetSources): DailyReportTargetPlan => {
  if (failed) return { source: 'unavailable', assignments: [] };
  const dateRequests = requests.filter((request) => request.date === date);
  const board = confirmed?.date === date ? confirmed : null;
  const plan = dispatch?.date === date ? dispatch : null;
  const source: DailyReportTargetSource = board ? 'confirmed'
    : plan && plan.assignments.length > 0 ? 'dispatch'
      : dateRequests.length > 0 ? 'requests' : 'unknown';
  const rows = board?.assignments ?? (source === 'dispatch' ? plan!.assignments : dateRequests);
  const offDuty = new Set([
    ...dateRequests.filter((row) => !noWorkStatuses.has(text(row.status).toLowerCase()))
      .flatMap((row) => row.offDutyWorkerIds || []),
    ...rows.filter((row) => !noWorkStatuses.has(text(row.status).toLowerCase()))
      .flatMap((row) => row.offDutyWorkerIds || []),
  ].map(text).filter(Boolean));
  const assignments = rows.filter((row) => {
    if (text(row.siteId) === '__date_off_duty__') return false;
    if (noWorkStatuses.has(text(row.status).toLowerCase())) return false;
    const workers = (row.workerIds || []).map(text).filter(Boolean);
    const hasSupport = (row.supportTeamIds || []).some((id) => Boolean(text(id))) || (row.supportTeams || []).length > 0;
    if (hasSupport || workers.some((id) => !offDuty.has(id))) return true;
    // A row whose entire assigned crew is off duty is not a working site.
    return workers.length === 0 && Number(row.requestedHeadcount || 0) > 0;
  });
  return { source, assignments };
};
