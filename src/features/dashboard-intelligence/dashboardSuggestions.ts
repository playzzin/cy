import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { buildTaskSlaBoard } from '../task-sla/taskSla';

export type DashboardSuggestionTone = 'blue' | 'orange' | 'teal' | 'violet' | 'red';

export interface DashboardFeatureSuggestion {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  route: string;
  priorityLabel: string;
  score: number;
  tone: DashboardSuggestionTone;
}

const createSuggestion = (
  suggestion: Omit<DashboardFeatureSuggestion, 'priorityLabel'>
): DashboardFeatureSuggestion => ({
  ...suggestion,
  priorityLabel: suggestion.score >= 90 ? '높음' : suggestion.score >= 70 ? '중간' : '관찰',
});

const formatManDay = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}공수`;

const summarizeMissingSites = (stats: DashboardExecutiveStats): string => {
  const missingSites = stats.dailyReportCoverage?.missingSites || [];
  if (missingSites.length === 0) return '';

  const names = missingSites.slice(0, 2).map((site) => site.siteName).join(', ');
  const suffix = missingSites.length > 2 ? ` 외 ${missingSites.length - 2}개` : '';
  return ` 누락 현장: ${names}${suffix}.`;
};

export const createDashboardFeatureSuggestions = (
  stats: DashboardExecutiveStats
): DashboardFeatureSuggestion[] => {
  const suggestions: DashboardFeatureSuggestion[] = [];
  const coverage = stats.dailyReportCoverage;
  const missingSiteCount = coverage?.missingSiteCount ?? 0;
  const reportCoverageRate = coverage?.coverageRate ?? stats.operations.reportCoverageRate;
  const taskSlaBoard = buildTaskSlaBoard(stats.recentTasks || []);
  const taskRiskCount = taskSlaBoard.counts.overdue
    + taskSlaBoard.counts.missingAssignee
    + taskSlaBoard.counts.dueToday;
  const supportBalanceAbs = Math.abs(stats.operations.supportBalance);

  if (stats.operations.healthScore > 0 && stats.operations.healthScore < 80) {
    suggestions.push(createSuggestion({
      id: 'operations-health-review',
      title: '운영 건강도 집중 점검',
      description: `운영 건강도 점수가 ${stats.operations.healthScore}점입니다. 일보 커버리지, 당일 활동, 지원 공수 균형을 한 화면에서 재점검하고 병목 현장을 먼저 정리해야 합니다.`,
      actionLabel: '대시보드 확인',
      route: '/dashboard',
      score: stats.operations.healthScore < 60 ? 95 : 78,
      tone: stats.operations.healthScore < 60 ? 'red' : 'orange',
    }));
  }

  if (missingSiteCount > 0 || reportCoverageRate < 85) {
    suggestions.push(createSuggestion({
      id: 'daily-report-reminder',
      title: '일보 누락 자동 리마인더',
      description: `오늘 활성 현장 일보 커버리지가 ${reportCoverageRate}%입니다.${summarizeMissingSites(stats)} 현장별 미작성자를 자동 추적하고 메시지 발송까지 연결하는 기능이 우선입니다.`,
      actionLabel: '메시지 설정',
      route: '/messages/settings',
      score: reportCoverageRate < 60 || missingSiteCount >= 3 ? 96 : 84,
      tone: reportCoverageRate < 60 ? 'red' : 'orange',
    }));
  }

  if (taskRiskCount > 0) {
    suggestions.push(createSuggestion({
      id: 'task-sla-board',
      title: '업무 요청 SLA 보드',
      description: `최근 업무 요청 중 지연 ${taskSlaBoard.counts.overdue}건, 담당자 미지정 ${taskSlaBoard.counts.missingAssignee}건, 오늘 마감 ${taskSlaBoard.counts.dueToday}건이 있습니다. 담당자와 기한 기준으로 자동 분류해 처리 우선순위를 고정해야 합니다.`,
      actionLabel: '업무 요청 보기',
      route: '/todo',
      score: taskSlaBoard.counts.overdue > 0 || taskSlaBoard.counts.missingAssignee > 0 ? 92 : 74,
      tone: taskSlaBoard.counts.overdue > 0 ? 'red' : 'blue',
    }));
  }

  if (stats.support.total > 0 || supportBalanceAbs >= 5) {
    suggestions.push(createSuggestion({
      id: 'support-balance-alert',
      title: '지원 공수 순증감 알림',
      description: `이번 달 지원 순증감이 ${formatManDay(stats.operations.supportBalance)}입니다. 현장과 팀 기준의 정산 알림을 자동화하면 누락 청구와 과다 지원을 더 빨리 잡을 수 있습니다.`,
      actionLabel: '지원 현황 확인',
      route: '/support/status',
      score: supportBalanceAbs >= 20 ? 94 : 76,
      tone: stats.operations.supportBalance >= 0 ? 'teal' : 'orange',
    }));
  }

  if (stats.reports.thisMonthManDay > 0) {
    suggestions.push(createSuggestion({
      id: 'productivity-forecast',
      title: '월간 생산성 예측',
      description: `이번 달 누적 ${stats.reports.thisMonthManDay.toFixed(1)}공수를 기반으로 월말 투입량과 현장별 편차를 예측할 수 있습니다. 다음 단계는 실적 추세와 현장별 위험 구간을 자동 표시하는 것입니다.`,
      actionLabel: '통계 화면',
      route: '/reports/statistics',
      score: stats.reports.thisMonthManDay >= 100 ? 86 : 64,
      tone: 'violet',
    }));
  }

  if (suggestions.length === 0 || reportCoverageRate >= 95) {
    suggestions.push(createSuggestion({
      id: 'data-quality-audit',
      title: 'ERP 데이터 품질 자동 감사',
      description: '운영 지표가 안정적일 때는 인력, 팀, 현장, 회사, 일보, 업무 요청의 연결 끊김과 중복을 정기 감사하는 기능을 우선 고도화해야 합니다.',
      actionLabel: '무결성 감사',
      route: '/admin/integrity',
      score: suggestions.length === 0 ? 72 : 58,
      tone: 'blue',
    }));
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
};
