import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { buildTaskSlaBoard } from '../task-sla/taskSla';

export type DashboardStatisticTone = 'blue' | 'teal' | 'amber' | 'red' | 'slate';

export interface DashboardStatisticItem {
  id: string;
  label: string;
  value: string;
  numericValue: number;
  unit: string;
  precision: number;
  detail: string;
  progress: number;
  tone: DashboardStatisticTone;
}

interface DashboardStatisticsOptions {
  today?: Date | string;
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const roundToOne = (value: number): number => Math.round(Number(value || 0) * 10) / 10;

const toDate = (date?: Date | string): Date => {
  if (date instanceof Date) return date;
  if (typeof date === 'string' && date.trim()) {
    const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const formatManDay = (value: number): string => (
  `${roundToOne(value).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}공`
);

const getCoverageTone = (coverageRate: number): DashboardStatisticTone => {
  if (coverageRate < 70) return 'red';
  if (coverageRate < 90) return 'amber';
  return 'teal';
};

const getStabilityTone = (stabilityRate: number): DashboardStatisticTone => {
  if (stabilityRate < 60) return 'red';
  if (stabilityRate < 85) return 'amber';
  return 'teal';
};

export const createDashboardStatistics = (
  stats: DashboardExecutiveStats,
  options: DashboardStatisticsOptions = {}
): DashboardStatisticItem[] => {
  const baseDate = toDate(options.today || stats.dailyReportCoverage.date);
  const dayOfMonth = baseDate.getDate();
  const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  const monthProgressRate = clampPercent((dayOfMonth / daysInMonth) * 100);
  const coverageRate = stats.dailyReportCoverage.coverageRate ?? stats.operations.reportCoverageRate ?? 0;
  const taskBoard = buildTaskSlaBoard(stats.recentTasks || [], baseDate);
  const taskRiskCount = taskBoard.counts.overdue
    + taskBoard.counts.dueToday
    + taskBoard.counts.missingAssignee
    + taskBoard.counts.missingDueDate;
  const taskStabilityRate = taskBoard.open > 0
    ? clampPercent(((taskBoard.open - taskRiskCount) / taskBoard.open) * 100)
    : 100;

  return [
    {
      id: 'month-progress',
      label: '월 진행률',
      value: `${monthProgressRate}%`,
      numericValue: monthProgressRate,
      unit: '%',
      precision: 0,
      detail: `${dayOfMonth}/${daysInMonth}일 경과`,
      progress: monthProgressRate,
      tone: 'blue',
    },
    {
      id: 'monthly-run-rate',
      label: '예상 월말 공수',
      value: formatManDay(stats.operations.monthlyManDayRunRate),
      numericValue: roundToOne(stats.operations.monthlyManDayRunRate),
      unit: '공',
      precision: 1,
      detail: `현재 누적 ${formatManDay(stats.reports.thisMonthManDay)}`,
      progress: clampPercent(stats.reports.thisMonthManDay > 0
        ? (stats.reports.thisMonthManDay / Math.max(stats.operations.monthlyManDayRunRate, stats.reports.thisMonthManDay)) * 100
        : 0),
      tone: 'slate',
    },
    {
      id: 'report-coverage',
      label: '일보 커버리지',
      value: `${coverageRate}%`,
      numericValue: clampPercent(coverageRate),
      unit: '%',
      precision: 0,
      detail: `작성 ${stats.dailyReportCoverage.reportedSiteCount}개 / 누락 ${stats.dailyReportCoverage.missingSiteCount}개`,
      progress: clampPercent(coverageRate),
      tone: getCoverageTone(coverageRate),
    },
    {
      id: 'task-stability',
      label: '업무 SLA 안정률',
      value: `${taskStabilityRate}%`,
      numericValue: taskStabilityRate,
      unit: '%',
      precision: 0,
      detail: taskBoard.open > 0 ? `리스크 ${taskRiskCount}건 / 진행 ${taskBoard.open}건` : '진행 중 업무 없음',
      progress: taskStabilityRate,
      tone: getStabilityTone(taskStabilityRate),
    },
  ];
};
