import { calculateTrendPercent } from '../../utils/dashboardKpiTrend';
import { shiftDateKey, toKoreanDateKey } from '../../utils/koreanBusinessDate';
import { getExpectedReportSiteCount, isReportCoverageFinal, type DailyReportCoverageSummary } from '../daily-report-coverage/dailyReportCoverage';

export interface DashboardOperationReportLike {
  date?: string;
  totalManDay?: number | string | null;
  siteId?: string | null;
  siteName?: string | null;
}
export interface DashboardDailyTrendPoint {
  date: string;
  reportCount: number;
  manDay: number;
  siteCount: number;
}
export type DashboardHealthLabel = 'critical' | 'watch' | 'stable' | 'collecting' | 'unknown' | 'unavailable' | 'no-work' | 'monitoring';
export const dashboardHealthLabels: Record<DashboardHealthLabel, string> = {
  critical: '위험', watch: '주의', stable: '양호', collecting: '집계 중',
  unknown: '평가 보류', unavailable: '조회 확인 필요', 'no-work': '작업 예정 없음', monitoring: '작성 현황',
};
export interface DashboardHealthDeduction {
  label: string;
  points: number;
  detail: string;
  route: string;
}
export interface DashboardOperationInsights {
  reportCountTrendPercent: number | null;
  manDayTrendPercent: number | null;
  monthlyManDayRunRate: number;
  healthScore: number | null;
  healthLabel: DashboardHealthLabel;
  healthReason?: string;
  healthDeductions?: DashboardHealthDeduction[];
}
export interface BuildDashboardOperationsInput {
  reports: DashboardOperationReportLike[];
  today?: Date | string;
  coverage?: DailyReportCoverageSummary;
}
const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const getReportDateKey = (report: DashboardOperationReportLike): string => String(report.date || '').slice(0, 10);
const getReportManDay = (report: DashboardOperationReportLike): number => toNumber(report.totalManDay);
const uniqueSiteKey = (report: DashboardOperationReportLike): string => String(report.siteId || report.siteName || 'unknown').trim();
const buildPoint = (reports: DashboardOperationReportLike[], date: string): DashboardDailyTrendPoint => {
  const rows = reports.filter((report) => getReportDateKey(report) === date);
  return { date, reportCount: rows.length,
    manDay: Math.round(rows.reduce((sum, report) => sum + getReportManDay(report), 0) * 10) / 10,
    siteCount: new Set(rows.map(uniqueSiteKey)).size };
};
export const formatDashboardTrend = (value: number | null): string => value === null || !Number.isFinite(value)
  ? '비교 자료 없음' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

export const buildDashboardDailyTrend = (
  reports: DashboardOperationReportLike[], today: Date | string = new Date(), dayCount = 7
): DashboardDailyTrendPoint[] => {
  const date = toKoreanDateKey(today);
  const length = Math.max(1, dayCount);
  return Array.from({ length }, (_, index) => buildPoint(reports, shiftDateKey(date, index - length + 1)));
};

export const buildDashboardOperationInsights = ({
  reports, today = new Date(), coverage,
}: BuildDashboardOperationsInput): DashboardOperationInsights => {
  const date = toKoreanDateKey(today);
  const todayPoint = buildPoint(reports, date);
  const yesterdayPoint = buildPoint(reports, shiftDateKey(date, -1));
  const calendarDate = new Date(`${date}T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, 0)).getUTCDate();
  const thisMonthManDay = reports
    .filter((report) => getReportDateKey(report).startsWith(date.slice(0, 7)) && getReportDateKey(report) <= date)
    .reduce((sum, report) => sum + getReportManDay(report), 0);
  const hasBothDays = todayPoint.reportCount > 0 && yesterdayPoint.reportCount > 0;
  const reportCountTrendPercent = hasBothDays ? calculateTrendPercent(todayPoint.reportCount, yesterdayPoint.reportCount) : null;
  const manDayTrendPercent = hasBothDays && yesterdayPoint.manDay > 0
    ? calculateTrendPercent(todayPoint.manDay, yesterdayPoint.manDay) : null;

  const expected = coverage ? getExpectedReportSiteCount(coverage) : 0;
  const canScore = coverage && isReportCoverageFinal(coverage) && expected > 0 && coverage.coverageRate !== null;
  // Only an observed submission failure affects the score. Volume changes and
  // support transfers are contextual signals, not evidence of an operational failure.
  const healthScore = canScore ? Math.max(0, Math.min(100, Math.floor(coverage.reportedSiteCount / expected * 100))) : null;
  const healthLabel: DashboardHealthLabel = healthScore !== null
    ? healthScore < 60 ? 'critical' : healthScore < 80 ? 'watch' : 'stable'
    : coverage?.status === 'collecting' ? 'collecting'
      : coverage?.status === 'no-work' ? 'no-work'
        : coverage?.status === 'unavailable' ? 'unavailable'
          : coverage?.status === 'monitoring' ? 'monitoring' : 'unknown';
  const healthDeductions: DashboardHealthDeduction[] = healthScore !== null && healthScore < 100 ? [{
    label: '마감 후 일보 미작성',
    points: 100 - healthScore,
    detail: `제출 대상 ${expected}개 중 ${coverage!.missingSiteCount}개 현장의 일보가 없습니다.`,
    route: `/reports/daily?tab=list-v2&date=${encodeURIComponent(date)}`,
  }] : [];
  return {
    reportCountTrendPercent, manDayTrendPercent,
    monthlyManDayRunRate: Math.round(thisMonthManDay / calendarDate.getUTCDate() * daysInMonth * 10) / 10,
    healthScore, healthLabel, healthDeductions,
    healthReason: coverage?.detail || '제출 대상과 마감 상태를 확인한 뒤 평가합니다.',
  };
};
