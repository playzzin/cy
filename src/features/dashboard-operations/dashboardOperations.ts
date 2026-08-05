import { calculateTrendPercent } from '../../utils/dashboardKpiTrend';

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

export interface DashboardOperationInsights {
  reportCountTrendPercent: number;
  manDayTrendPercent: number;
  monthlyManDayRunRate: number;
  healthScore: number;
  healthLabel: 'critical' | 'watch' | 'stable';
}

export interface BuildDashboardOperationsInput {
  reports: DashboardOperationReportLike[];
  today?: Date | string;
  reportCoverageRate: number;
  activeSiteCount: number;
  supportBalance: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDate = (date: Date | string): Date => {
  if (date instanceof Date) return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const [year, month, day] = String(date).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return toDate(new Date());
  return new Date(year, month - 1, day);
};

const toDateKey = (date: Date | string): string => {
  const normalized = toDate(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * MS_PER_DAY);

const toNumber = (value: unknown): number => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getReportDateKey = (report: DashboardOperationReportLike): string => String(report.date || '').slice(0, 10);

const getReportManDay = (report: DashboardOperationReportLike): number => toNumber(report.totalManDay);

const uniqueSiteKey = (report: DashboardOperationReportLike): string => {
  const siteId = String(report.siteId || '').trim();
  const siteName = String(report.siteName || '').trim().replace(/\s+/g, '').toLowerCase();
  return siteId || siteName || 'unknown';
};

const buildPoint = (reports: DashboardOperationReportLike[], dateKey: string): DashboardDailyTrendPoint => {
  const dayReports = reports.filter((report) => getReportDateKey(report) === dateKey);
  return {
    date: dateKey,
    reportCount: dayReports.length,
    manDay: Math.round(dayReports.reduce((sum, report) => sum + getReportManDay(report), 0) * 10) / 10,
    siteCount: new Set(dayReports.map(uniqueSiteKey)).size,
  };
};

export const buildDashboardDailyTrend = (
  reports: DashboardOperationReportLike[],
  today: Date | string = new Date(),
  dayCount = 7
): DashboardDailyTrendPoint[] => {
  const normalizedToday = toDate(today);
  return Array.from({ length: Math.max(1, dayCount) }, (_, index) => {
    const date = addDays(normalizedToday, index - (Math.max(1, dayCount) - 1));
    return buildPoint(reports, toDateKey(date));
  });
};

const getMonthBounds = (date: Date) => ({
  monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
  dayOfMonth: date.getDate(),
  daysInMonth: new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
});

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const getHealthLabel = (score: number): DashboardOperationInsights['healthLabel'] => {
  if (score < 60) return 'critical';
  if (score < 80) return 'watch';
  return 'stable';
};

export const buildDashboardOperationInsights = ({
  reports,
  today = new Date(),
  reportCoverageRate,
  activeSiteCount,
  supportBalance,
}: BuildDashboardOperationsInput): DashboardOperationInsights => {
  const normalizedToday = toDate(today);
  const todayKey = toDateKey(normalizedToday);
  const yesterdayKey = toDateKey(addDays(normalizedToday, -1));
  const todayPoint = buildPoint(reports, todayKey);
  const yesterdayPoint = buildPoint(reports, yesterdayKey);
  const { monthKey, dayOfMonth, daysInMonth } = getMonthBounds(normalizedToday);
  const thisMonthManDay = reports
    .filter((report) => getReportDateKey(report).startsWith(monthKey))
    .reduce((sum, report) => sum + getReportManDay(report), 0);

  const monthlyManDayRunRate = dayOfMonth > 0
    ? Math.round((thisMonthManDay / dayOfMonth) * daysInMonth * 10) / 10
    : 0;

  const reportCountTrendPercent = calculateTrendPercent(todayPoint.reportCount, yesterdayPoint.reportCount);
  const manDayTrendPercent = calculateTrendPercent(todayPoint.manDay, yesterdayPoint.manDay);
  const activeSitePenalty = activeSiteCount > 0 && todayPoint.siteCount === 0 ? 15 : 0;
  const supportPenalty = Math.min(20, Math.abs(supportBalance) * 0.5);
  const momentumBonus = Math.max(-10, Math.min(10, manDayTrendPercent / 10));
  const healthScore = clampScore(reportCoverageRate * 0.7 + 25 + momentumBonus - activeSitePenalty - supportPenalty);

  return {
    reportCountTrendPercent,
    manDayTrendPercent,
    monthlyManDayRunRate,
    healthScore,
    healthLabel: getHealthLabel(healthScore),
  };
};
