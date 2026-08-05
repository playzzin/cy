import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { buildTaskSlaBoard } from '../task-sla/taskSla';

export type DashboardActionSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface DashboardActionItem {
  id: string;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  actionLabel: string;
  route: string;
  severity: DashboardActionSeverity;
  score: number;
}

interface DashboardActionCenterOptions {
  today?: Date | string;
}

const severityRank: Record<DashboardActionSeverity, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
};

const formatPercent = (value: number): string => `${Math.round(Number(value || 0))}%`;

const formatManDay = (value: number): string => {
  const numericValue = Number(value || 0);
  const sign = numericValue > 0 ? '+' : '';
  return `${sign}${numericValue.toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}공`;
};

const isActionableTaskRisk = (counts: ReturnType<typeof buildTaskSlaBoard>['counts']): boolean => (
  counts.overdue > 0
  || counts.dueToday > 0
  || counts.missingAssignee > 0
  || counts.missingDueDate > 0
);

const normalizeToday = (today?: Date | string): Date | undefined => {
  if (!today) return undefined;
  if (today instanceof Date) return today;
  const parsed = new Date(today);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const sortActions = (actions: DashboardActionItem[]): DashboardActionItem[] => (
  [...actions].sort((a, b) => (
    severityRank[b.severity] - severityRank[a.severity]
    || b.score - a.score
    || a.id.localeCompare(b.id)
  ))
);

export const createDashboardActionItems = (
  stats: DashboardExecutiveStats,
  options: DashboardActionCenterOptions = {}
): DashboardActionItem[] => {
  const coverage = stats.dailyReportCoverage;
  const coverageRate = coverage?.coverageRate ?? stats.operations.reportCoverageRate ?? 0;
  const missingSiteCount = coverage?.missingSiteCount ?? 0;
  const taskBoard = buildTaskSlaBoard(stats.recentTasks || [], normalizeToday(options.today));
  const supportBalance = Number(stats.operations.supportBalance || 0);
  const supportAbs = Math.abs(supportBalance);
  const actions: DashboardActionItem[] = [];

  if (missingSiteCount > 0 || coverageRate < 90) {
    const topMissingSites = coverage?.missingSites?.slice(0, 2).map((site) => site.siteName).filter(Boolean) || [];
    const missingSiteText = topMissingSites.length > 0
      ? ` 우선 확인: ${topMissingSites.join(', ')}${missingSiteCount > topMissingSites.length ? ` 외 ${missingSiteCount - topMissingSites.length}개` : ''}.`
      : '';

    actions.push({
      id: 'daily-report-coverage',
      title: '일보 누락 현장 정리',
      description: `활성 현장 기준 오늘 일보 커버리지가 ${formatPercent(coverageRate)}입니다.${missingSiteText} 누락 현장부터 확인해 당일 마감 전에 보완해야 합니다.`,
      metricLabel: '커버리지',
      metricValue: formatPercent(coverageRate),
      actionLabel: '누락 현장 보기',
      route: `/reports/daily?tab=list-v2&date=${encodeURIComponent(coverage?.date || '')}`,
      severity: coverageRate < 70 || missingSiteCount >= 3 ? 'critical' : 'warning',
      score: 90 + Math.min(10, missingSiteCount * 2) + Math.max(0, 90 - coverageRate),
    });
  }

  if (stats.operations.healthScore > 0 && stats.operations.healthScore < 85) {
    actions.push({
      id: 'operations-health',
      title: '운영 건강도 점검',
      description: '일보 커버리지, 전일 대비 공수 흐름, 지원 공수 균형을 함께 확인해 오늘 병목을 먼저 해소해야 합니다.',
      metricLabel: '건강도',
      metricValue: `${stats.operations.healthScore}/100`,
      actionLabel: '운영 지표 보기',
      route: '/dashboard',
      severity: stats.operations.healthScore < 60 ? 'critical' : 'warning',
      score: 85 + Math.max(0, 85 - stats.operations.healthScore),
    });
  }

  if (isActionableTaskRisk(taskBoard.counts)) {
    const riskCount = taskBoard.counts.overdue
      + taskBoard.counts.dueToday
      + taskBoard.counts.missingAssignee
      + taskBoard.counts.missingDueDate;

    actions.push({
      id: 'task-sla',
      title: '업무 요청 SLA 처리',
      description: `지연 ${taskBoard.counts.overdue}건, 오늘 마감 ${taskBoard.counts.dueToday}건, 담당자/기한 누락 ${taskBoard.counts.missingAssignee + taskBoard.counts.missingDueDate}건이 있습니다. 담당자와 마감일 기준으로 먼저 정리하세요.`,
      metricLabel: '리스크 업무',
      metricValue: `${riskCount}건`,
      actionLabel: '업무 요청 보기',
      route: '/todo',
      severity: taskBoard.counts.overdue > 0 || taskBoard.counts.missingAssignee > 0 ? 'critical' : 'warning',
      score: 80 + Math.min(15, riskCount * 3),
    });
  }

  if (stats.support.total > 0 && supportAbs >= 5) {
    actions.push({
      id: 'support-balance',
      title: '지원 공수 균형 확인',
      description: supportBalance >= 0
        ? '지원받은 공수가 지원나간 공수보다 큽니다. 정산 대상과 현장별 사유를 확인해 누락 청구를 방지해야 합니다.'
        : '지원나간 공수가 지원받은 공수보다 큽니다. 팀별 투입 여력과 원청 정산 연결 상태를 확인해야 합니다.',
      metricLabel: '순증감',
      metricValue: formatManDay(supportBalance),
      actionLabel: '지원 현황 보기',
      route: '/support/status',
      severity: supportAbs >= 20 ? 'warning' : 'info',
      score: 60 + Math.min(25, supportAbs),
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'operations-clear',
      title: '오늘 핵심 운영 지표 안정',
      description: '일보 커버리지, 업무 요청 SLA, 지원 공수 균형에서 즉시 조치할 위험 항목이 없습니다. 다음 점검은 데이터 무결성과 월간 추세입니다.',
      metricLabel: '상태',
      metricValue: '정상',
      actionLabel: '월간 통계 보기',
      route: '/reports/statistics',
      severity: 'success',
      score: 10,
    });
  }

  return sortActions(actions).slice(0, 4);
};
