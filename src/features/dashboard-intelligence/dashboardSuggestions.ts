import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { buildTaskSlaBoard } from '../task-sla/taskSla';
import { getExpectedReportSiteCount, isReportCoverageFinal } from '../daily-report-coverage/dailyReportCoverage';
import { formatDashboardTrend } from '../dashboard-operations/dashboardOperations';

export type DashboardSuggestionTone = 'blue' | 'orange' | 'teal' | 'violet' | 'red';
export type DashboardSuggestionCategory = 'automation' | 'insight' | 'quality';

export interface DashboardFeatureSuggestion {
  id: string;
  title: string;
  description: string;
  category: DashboardSuggestionCategory;
  evidence: Array<{ label: string; value: string }>;
  reason: string;
  impact: string;
  steps: string[];
  note: string;
  actionLabel: string;
  route: string;
  priorityLabel: string;
  score: number;
  tone: DashboardSuggestionTone;
}

export const dashboardSuggestionCategoryLabels: Record<DashboardSuggestionCategory, string> = {
  automation: '반복 업무 자동화',
  insight: '운영 분석',
  quality: '데이터 품질',
};

const finite = (value: number | null): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const count = (value: number): number => Math.max(0, Math.floor(finite(value)));
const formatNumber = (value: number): string => finite(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const formatManDay = (value: number): string => `${value > 0 ? '+' : ''}${formatNumber(value)}공수`;

const createSuggestion = (
  suggestion: Omit<DashboardFeatureSuggestion, 'priorityLabel'>
): DashboardFeatureSuggestion => {
  const score = Math.max(0, Math.min(100, Math.round(suggestion.score)));
  return { ...suggestion, score, priorityLabel: score >= 90 ? '높음' : score >= 70 ? '중간' : '관찰' };
};

export const createDashboardFeatureSuggestions = (
  stats: DashboardExecutiveStats,
  today = new Date()
): DashboardFeatureSuggestion[] => {
  const suggestions: DashboardFeatureSuggestion[] = [];
  const coverage = stats.dailyReportCoverage;
  const activeSites = count(getExpectedReportSiteCount(coverage));
  const missingSites = Math.min(activeSites, count(coverage?.missingSiteCount ?? 0));
  const coverageValue = coverage.coverageRate;
  const coverageKnown = coverageValue !== null && Number.isFinite(coverageValue);
  const coverageRate = Math.max(0, Math.min(100, finite(coverageValue)));
  const healthScore = Math.max(0, Math.min(100, finite(stats.operations.healthScore)));
  const supportBalance = finite(stats.operations.supportBalance);
  const supportBalanceAbs = Math.abs(supportBalance);
  const monthlyManDay = Math.max(0, finite(stats.reports.thisMonthManDay));
  const taskBoard = buildTaskSlaBoard(stats.recentTasks || [], today);
  const { overdue, missingAssignee, missingDueDate, dueToday, dueSoon } = taskBoard.counts;
  const reportNeedsAttention = isReportCoverageFinal(coverage) && activeSites > 0 && (missingSites > 0 || (coverageKnown && coverageRate < 85));
  const hasData = activeSites > 0 || count(stats.sites.total) > 0 || count(stats.workers.total) > 0
    || count(stats.teams.total) > 0 || count(stats.reports.thisMonth) > 0 || monthlyManDay > 0
    || finite(stats.support.total) > 0 || supportBalanceAbs > 0 || taskBoard.total > 0;

  if (!hasData) return [];

  if (coverage.status && !isReportCoverageFinal(coverage) && coverage.status !== 'no-work') {
    const collecting = coverage.status === 'collecting' || coverage.status === 'monitoring';
    suggestions.push(createSuggestion({
      id: 'reporting-readiness', title: collecting ? '일보 제출 준비' : '일보 제출 대상 확인', category: 'quality',
      description: collecting ? '작업 일정과 일보 작성 대상을 대조하고 제출을 준비하세요.' : '기준일의 작업 일정을 확인해 일보 제출 대상을 먼저 정하세요.',
      evidence: [{ label: '제출 대상', value: collecting ? `${activeSites}개 현장` : '확인 필요' }, { label: '제출 마감 (한국 시간)', value: coverage.deadlineLabel || '설정 안 함' }],
      reason: coverage.detail || '제출 대상과 마감 상태를 확인한 뒤 평가합니다.',
      impact: '휴무나 일정 미등록을 일보 누락으로 오해하지 않고 실제 제출 대상만 관리합니다.',
      steps: ['기준일의 현장 배치와 휴무·취소 내역을 확인합니다.', '실제 작업 현장과 일보 작성 대상을 대조합니다.', '마감 후에도 미작성인 현장부터 확인합니다.'],
      note: '마감 전이나 제출 대상이 불명확할 때는 건강도 점수 평가를 보류합니다.',
      actionLabel: collecting ? '기준일 일보 확인' : '제출 대상 일정 확인',
      route: collecting ? `/reports/daily?tab=list-v2&date=${encodeURIComponent(coverage.date)}` : `/assignment/field-schedule?date=${encodeURIComponent(coverage.date)}`,
      score: collecting ? 62 : 75, tone: 'blue',
    }));
  }

  if (reportNeedsAttention) {
    const names = (coverage?.missingSites || []).slice(0, 2).map((site) => site.siteName).join(', ');
    const remaining = Math.max(0, missingSites - Math.min(2, coverage?.missingSites?.length || 0));
    suggestions.push(createSuggestion({
      id: 'daily-report-reminder',
      title: '일보 누락 자동 리마인더',
      category: 'automation',
      description: '미작성 현장과 담당 팀을 모아 확인하고, 일보 제출 안내를 연결하세요.',
      evidence: [
        { label: '일보 작성률', value: coverageKnown ? `${formatNumber(coverageRate)}%` : '확인 필요' },
        { label: '미작성 현장', value: `${missingSites} / ${activeSites}개` },
      ],
      reason: names ? `미작성 현장: ${names}${remaining > 0 ? ` 외 ${remaining}개` : ''}.` : '제출 대상 현장의 일보 작성 현황을 확인해야 합니다.',
      impact: '현장별 제출 확인과 반복 연락에 드는 수작업을 줄입니다.',
      steps: ['기준일의 일보 목록에서 실제 작업 현장과 미작성 현장을 대조합니다.', '현장별 담당 팀과 제출 마감 시간을 확인합니다.', '대시보드의 누락 알림 초안 작성에서 안내 내용을 준비하고 자동화할 범위를 정합니다.'],
      note: '등록된 작업 일정과 실제 일보를 기준으로 집계합니다. 휴무·취소 내역을 확인하세요. 메시지는 자동 발송되지 않습니다.',
      actionLabel: '기준일 일보 확인',
      route: `/reports/daily?tab=list-v2${coverage?.date ? `&date=${encodeURIComponent(coverage.date)}` : ''}`,
      score: 80 + (coverageKnown ? (100 - coverageRate) * 0.17 : 0) + Math.min(3, missingSites),
      tone: coverageKnown && coverageRate < 60 ? 'red' : 'orange',
    }));
  }

  if (activeSites > 0 && stats.operations.healthScore !== null && Number.isFinite(stats.operations.healthScore) && healthScore < 80) {
    suggestions.push(createSuggestion({
      id: 'operations-health-review',
      title: '운영 건강도 집중 점검',
      category: 'insight',
      description: '마감 후 미작성 현장과 감점 근거를 확인하고 일보를 보완하세요.',
      evidence: [
        { label: '운영 건강도', value: `${healthScore} / 100점` },
        { label: '공수 전일 대비', value: formatDashboardTrend(stats.operations.manDayTrendPercent) },
      ],
      reason: reportNeedsAttention ? '일보 미작성과 겹치는 신호여서 일보 확인 다음 순서로 제안합니다.' : '운영 건강도가 안정 기준인 80점보다 낮습니다.',
      impact: '미작성 현장과 감점 사유를 연결해 점검 순서를 정할 수 있습니다.',
      steps: ['기준일의 제출 대상과 미작성 현장을 확인합니다.', '실제 작업 여부와 휴무·취소 내역을 대조합니다.', '작업한 현장의 일보를 보완한 뒤 대시보드를 새로고침합니다.'],
      note: '현재 건강도는 마감 후 일보 제출률을 기준으로 평가합니다. 공수 증감과 지원 순증감은 감점하지 않습니다.',
      actionLabel: '기준일 일보 점검',
      route: `/reports/daily?tab=list-v2&date=${encodeURIComponent(coverage.date)}`,
      score: reportNeedsAttention ? 72 + (80 - healthScore) * 0.08 : healthScore < 60 ? 90 + (60 - healthScore) * 0.15 : 78 + (80 - healthScore) * 0.4,
      tone: healthScore < 60 ? 'red' : 'orange',
    }));
  }

  if (overdue + missingAssignee + missingDueDate + dueToday + dueSoon > 0) {
    const urgent = overdue + missingAssignee;
    suggestions.push(createSuggestion({
      id: 'task-sla-board',
      title: '업무 요청 기한·담당자 관리',
      category: 'automation',
      description: '지연된 업무부터 담당자와 기한을 정리하고, 마감 전 확인 흐름을 만드세요.',
      evidence: [
        { label: '지연 / 오늘 마감', value: `${overdue} / ${dueToday}건` },
        { label: '담당자 / 기한 없음', value: `${missingAssignee} / ${missingDueDate}건` },
      ],
      reason: `최근 조회한 업무 ${taskBoard.total}건 중 미완료 ${taskBoard.open}건을 분석했습니다. 3일 이내 마감은 ${dueSoon}건입니다.`,
      impact: '담당자 미지정과 기한 누락으로 업무가 방치되는 일을 줄입니다.',
      steps: ['지연 업무와 담당자 없는 업무부터 확인합니다.', '각 업무의 담당자와 처리 기한을 정합니다.', '오늘 마감과 3일 이내 마감 업무를 순서대로 확인합니다.'],
      note: '최근 조회된 업무 범위의 결과이며, 완료된 업무는 위험 건수에서 제외합니다.',
      actionLabel: '업무 요청 정리',
      route: '/todo',
      score: urgent > 0 ? 90 + Math.min(9, urgent * 2) : dueToday > 0 ? 80 + Math.min(8, dueToday) : 70 + Math.min(8, missingDueDate + dueSoon),
      tone: urgent > 0 ? 'red' : 'blue',
    }));
  }

  if (supportBalanceAbs >= 5) {
    suggestions.push(createSuggestion({
      id: 'support-balance-alert',
      title: '지원 공수 순증감 알림',
      category: 'automation',
      description: '지원받은 공수와 보낸 공수의 차이를 확인하고, 팀별 정산 점검 기준을 정하세요.',
      evidence: [
        { label: '지원 순증감', value: formatManDay(supportBalance) },
        { label: '받음 / 보냄', value: `${formatNumber(stats.support.inbound)} / ${formatNumber(stats.support.outbound)}공수` },
      ],
      reason: `이번 달 ${supportBalance > 0 ? '받은' : '보낸'} 지원 공수가 ${formatNumber(supportBalanceAbs)}공수 더 많습니다.`,
      impact: '지원 내역과 정산 대상의 차이를 일찍 확인할 수 있습니다.',
      steps: ['지원 현황에서 현장·팀별 유입과 유출을 비교합니다.', '지원 일보와 정산 대상이 일치하는지 확인합니다.', '팀별 지원 계획에 맞춰 점검할 순증감 기준을 정합니다.'],
      note: '순증감은 정산 오류를 뜻하지 않습니다. 계획된 지원인지 먼저 확인하세요.',
      actionLabel: '지원 공수 비교',
      route: '/support/status',
      score: 74 + Math.min(24, supportBalanceAbs),
      tone: supportBalance < 0 ? 'orange' : 'teal',
    }));
  }

  if (monthlyManDay > 0) {
    const recordedDays = new Set((stats.dailyTrend || [])
      .filter((point) => point.reportCount > 0 && (!coverage?.date || point.date.slice(0, 7) === coverage.date.slice(0, 7)))
      .map((point) => point.date)).size;
    const enoughHistory = recordedDays >= 7;
    const runRate = Math.max(0, finite(stats.operations.monthlyManDayRunRate));
    suggestions.push(createSuggestion({
      id: 'productivity-forecast',
      title: enoughHistory ? '월간 공수 추세 분석' : '월간 공수 분석 기반 만들기',
      category: 'insight',
      description: enoughHistory ? '누적 공수와 최근 투입 흐름을 비교해 월말 운영 계획을 점검하세요.' : '기록된 일자를 늘려 월말 투입량을 비교할 수 있는 분석 기반을 만드세요.',
      evidence: [
        { label: '이번 달 누적', value: `${formatNumber(monthlyManDay)}공수` },
        { label: '최근 조회 중 기록일', value: `${recordedDays}일` },
      ],
      reason: enoughHistory ? '이번 달 기록일이 최근 조회 범위에서 7일 이상 확보되어 추세 비교를 제안합니다.' : '최근 조회 범위의 이번 달 기록일이 7일 미만이어서 데이터 축적을 먼저 제안합니다.',
      impact: '현장별 투입 추세를 바탕으로 인력 배치와 월말 계획을 검토합니다.',
      steps: ['이번 달 일보의 미작성 일자와 공수 입력을 확인합니다.', '현장·팀별 일별 공수 흐름을 비교합니다.', '작업 일정과 휴무를 반영해 월말 투입 계획을 조정합니다.'],
      note: runRate > 0 && enoughHistory ? `현재 누적 속도의 단순 월말 환산은 ${formatNumber(runRate)}공수입니다. 휴무·일정 변동을 반영한 예측은 아닙니다.` : '공수는 투입량입니다. 생산성을 판단하려면 작업량과 공정 실적이 추가로 필요합니다.',
      actionLabel: '월간 공수 통계',
      route: '/reports/statistics',
      score: enoughHistory ? 78 + Math.min(8, recordedDays - 7) : 60 + recordedDays,
      tone: 'violet',
    }));
  }

  if (suggestions.length === 0 || (activeSites > 0 && coverageKnown && coverageRate >= 95)) {
    suggestions.push(createSuggestion({
      id: 'data-quality-audit',
      title: 'ERP 데이터 연결 점검',
      category: 'quality',
      description: '인력·팀·현장 간 연결과 중복 기록을 점검해 운영 데이터의 신뢰도를 높이세요.',
      evidence: [
        { label: '등록 현장', value: `${count(stats.sites.total)}개` },
        { label: '등록 인력', value: `${count(stats.workers.total)}명` },
      ],
      reason: !coverageKnown || !Number.isFinite(stats.operations.healthScore)
        ? '일부 운영 지표를 확인할 수 없어 원본 데이터의 연결 상태 점검을 제안합니다.'
        : suggestions.length === 0 ? '현재 조회된 지표에서 우선 대응 조건이 감지되지 않아 예방 점검을 제안합니다.' : '일보 작성률이 95% 이상이어서 데이터 연결 상태까지 점검하기 좋습니다.',
      impact: '연결 누락과 중복으로 집계 결과가 달라지는 문제를 예방합니다.',
      steps: ['데이터 연결 점검 화면에서 감사 결과를 조회합니다.', '연결되지 않은 인력·팀·현장을 원본과 대조합니다.', '중복 또는 연결 누락이 확인된 항목의 수정 범위를 검토합니다.'],
      note: '이 추천 자체가 데이터 오류를 의미하지는 않습니다. 실제 감사 결과를 확인하세요.',
      actionLabel: '데이터 연결 점검',
      route: '/admin/integrity',
      score: suggestions.length === 0 ? 72 : 58,
      tone: 'blue',
    }));
  }

  return suggestions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
};
