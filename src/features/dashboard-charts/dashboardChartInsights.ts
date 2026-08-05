import type { DashboardDailyTrendPoint } from '../dashboard-operations';

export type DashboardChartDirection = 'up' | 'down' | 'flat';

export interface DashboardChartInsights {
  totalManDay: number;
  totalReports: number;
  averageDailyManDay: number;
  activeDayCount: number;
  peakManDayDate: string;
  peakManDay: number;
  peakReportDate: string;
  peakReportCount: number;
  direction: DashboardChartDirection;
  directionLabel: string;
}

const roundOne = (value: number): number => Math.round(Number(value || 0) * 10) / 10;

const sum = (values: number[]): number => values.reduce((total, value) => total + Number(value || 0), 0);

const getDirection = (points: DashboardDailyTrendPoint[]): DashboardChartDirection => {
  if (points.length < 4) return 'flat';

  const midpoint = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, midpoint);
  const secondHalf = points.slice(midpoint);
  const firstAverage = sum(firstHalf.map((point) => point.manDay)) / Math.max(1, firstHalf.length);
  const secondAverage = sum(secondHalf.map((point) => point.manDay)) / Math.max(1, secondHalf.length);
  const delta = secondAverage - firstAverage;

  if (Math.abs(delta) < 0.5) return 'flat';
  return delta > 0 ? 'up' : 'down';
};
const directionLabel: Record<DashboardChartDirection, string> = {
  up: '상승',
  down: '하락',
  flat: '보합',
};

const maxBy = (
  points: DashboardDailyTrendPoint[],
  pick: (point: DashboardDailyTrendPoint) => number
): DashboardDailyTrendPoint | null => {
  if (points.length === 0) return null;
  return points.reduce((winner, point) => (pick(point) > pick(winner) ? point : winner), points[0]);
};

export const createDashboardChartInsights = (
  points: DashboardDailyTrendPoint[]
): DashboardChartInsights => {
  const normalizedPoints = points.map((point) => ({
    ...point,
    manDay: roundOne(point.manDay),
    reportCount: Math.max(0, Math.round(Number(point.reportCount || 0))),
    siteCount: Math.max(0, Math.round(Number(point.siteCount || 0))),
  }));
  const totalManDay = roundOne(sum(normalizedPoints.map((point) => point.manDay)));
  const totalReports = sum(normalizedPoints.map((point) => point.reportCount));
  const peakManDayPoint = maxBy(normalizedPoints, (point) => point.manDay);
  const peakReportPoint = maxBy(normalizedPoints, (point) => point.reportCount);
  const direction = getDirection(normalizedPoints);

  return {
    totalManDay,
    totalReports,
    averageDailyManDay: normalizedPoints.length > 0 ? roundOne(totalManDay / normalizedPoints.length) : 0,
    activeDayCount: normalizedPoints.filter((point) => point.reportCount > 0 || point.manDay > 0).length,
    peakManDayDate: peakManDayPoint?.date || '',
    peakManDay: peakManDayPoint?.manDay || 0,
    peakReportDate: peakReportPoint?.date || '',
    peakReportCount: peakReportPoint?.reportCount || 0,
    direction,
    directionLabel: directionLabel[direction],
  };
};
