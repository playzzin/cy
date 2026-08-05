export type AiInsightSeverity = 'critical' | 'warning' | 'info';
export type AiInsightDirection = 'up' | 'down' | 'flat';
export type AiForecastConfidence = 'high' | 'medium' | 'low';

export interface AiInsightQuery {
  startDate: string;
  endDate: string;
  analysisType: string;
  siteName?: string;
  teamName?: string;
  workerTeamName?: string;
  workerName?: string;
  salaryModel?: string;
}

export interface AiSummaryInput {
  totalManDay: number;
  totalAmount: number;
  totalWorkers: number;
  totalReports: number;
  dateRange: string;
}

export interface AiTeamAggInput {
  teamName: string;
  totalManDay: number;
  totalAmount: number;
  workerCount: number;
  days: number;
  avgDailyManDay: number;
}

export interface AiSiteAggInput {
  siteName: string;
  totalManDay: number;
  totalAmount: number;
  workerCount: number;
  teamCount: number;
  days: number;
}

export interface AiWorkerAggInput {
  name: string;
  totalManDay: number;
  totalAmount: number;
  workDays: number;
  avgManDay: number;
  sites: string[];
  teams: string[];
  salaryModel: string;
}

export interface AiDailyAggInput {
  date: string;
  totalManDay: number;
  totalAmount: number;
  workerCount: number;
  teamCount: number;
  siteCount: number;
}

export interface AiComparisonInput {
  prevSummary: AiSummaryInput;
  prevTeamAgg: AiTeamAggInput[];
  prevSiteAgg: AiSiteAggInput[];
  prevWorkerAgg: AiWorkerAggInput[];
  prevPeriod: string;
}

export interface AiAdvancedInsightInput {
  query: AiInsightQuery;
  summary: AiSummaryInput;
  teamAgg: AiTeamAggInput[];
  siteAgg: AiSiteAggInput[];
  workerAgg: AiWorkerAggInput[];
  dailyAgg: AiDailyAggInput[];
  comparison?: AiComparisonInput;
  today?: Date | string;
}

export interface AiRiskSignal {
  id: string;
  severity: AiInsightSeverity;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  basis: string;
  followUpQuestion?: string;
}

export interface AiForecastInsight {
  periodLabel: string;
  elapsedDays: number;
  totalDays: number;
  observedManDay: number;
  projectedManDay: number;
  projectedAmount: number;
  currentDailyAverage: number;
  projectedDailyAverage: number;
  confidence: AiForecastConfidence;
  trendLabel: string;
  targetDate: string;
  basis: string;
}

export interface AiContributionItem {
  id: string;
  type: 'team' | 'site' | 'worker';
  label: string;
  current: number;
  previous?: number;
  diff: number;
  diffPercent?: number;
  share: number;
  direction: AiInsightDirection;
  description: string;
}

export interface AiRecommendation {
  id: string;
  priority: AiInsightSeverity;
  title: string;
  description: string;
  actionLabel: string;
  question: string;
}

export interface DailyReportAiInsights {
  riskSignals: AiRiskSignal[];
  forecast?: AiForecastInsight;
  contributions: AiContributionItem[];
  recommendations: AiRecommendation[];
  followUpQuestions: string[];
  narrativeHighlights: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const roundOne = (value: number): number => Math.round(Number(value || 0) * 10) / 10;
const roundMoney = (value: number): number => Math.round(Number(value || 0));

const formatNumber = (value: number, digits = 1): string => (
  Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
);

const formatMoney = (value: number): string => `${roundMoney(value).toLocaleString('ko-KR')}원`;

const parseDate = (value: Date | string | undefined): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const formatDate = (date: Date): string => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const endOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const daysInclusive = (start: Date, end: Date): number => (
  Math.max(1, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1)
);

const minDate = (a: Date, b: Date): Date => (a.getTime() <= b.getTime() ? a : b);

const median = (values: number[]): number => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const average = (values: number[]): number => (
  values.length > 0 ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0
);

const getTopShare = <T extends { totalManDay: number }>(rows: T[], totalManDay: number): number => {
  if (rows.length === 0 || totalManDay <= 0) return 0;
  return rows[0].totalManDay / totalManDay;
};

const getDirection = (diff: number): AiInsightDirection => {
  if (Math.abs(diff) < 0.05) return 'flat';
  return diff > 0 ? 'up' : 'down';
};

const createForecast = (input: AiAdvancedInsightInput): AiForecastInsight | undefined => {
  const start = parseDate(input.query.startDate);
  const end = parseDate(input.query.endDate);
  const today = parseDate(input.today) || parseDate(new Date());
  if (!start || !end || !today || input.summary.totalManDay <= 0) return undefined;

  const isMonthToDate = start.getDate() === 1
    && start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth()
    && start.getFullYear() === today.getFullYear()
    && start.getMonth() === today.getMonth()
    && end.getTime() <= today.getTime();
  const targetEnd = isMonthToDate ? endOfMonth(start) : end;
  const observedEnd = minDate(end, today);
  const elapsedDays = daysInclusive(start, observedEnd);
  const totalDays = daysInclusive(start, targetEnd);
  const activeDays = input.dailyAgg.filter((day) => day.totalManDay > 0).length;
  const currentDailyAverage = input.summary.totalManDay / elapsedDays;

  const sortedDaily = [...input.dailyAgg].sort((a, b) => a.date.localeCompare(b.date));
  const recentDailyAverage = average(sortedDaily.slice(-7).map((day) => day.totalManDay));
  const projectedDailyAverage = recentDailyAverage > 0
    ? (currentDailyAverage * 0.7) + (recentDailyAverage * 0.3)
    : currentDailyAverage;
  const projectedManDay = targetEnd.getTime() > observedEnd.getTime()
    ? roundOne(projectedDailyAverage * totalDays)
    : roundOne(input.summary.totalManDay);
  const amountPerManDay = input.summary.totalManDay > 0
    ? input.summary.totalAmount / input.summary.totalManDay
    : 0;
  const projectedAmount = roundMoney(projectedManDay * amountPerManDay);
  const confidence: AiForecastConfidence = activeDays >= 10 && elapsedDays >= 10
    ? 'high'
    : activeDays >= 5 && elapsedDays >= 5
      ? 'medium'
      : 'low';

  const recentDelta = recentDailyAverage - currentDailyAverage;
  const trendLabel = Math.abs(recentDelta) < Math.max(1, currentDailyAverage * 0.1)
    ? '보합'
    : recentDelta > 0 ? '최근 가속' : '최근 둔화';

  return {
    periodLabel: `${input.query.startDate} ~ ${formatDate(targetEnd)}`,
    elapsedDays,
    totalDays,
    observedManDay: roundOne(input.summary.totalManDay),
    projectedManDay,
    projectedAmount,
    currentDailyAverage: roundOne(currentDailyAverage),
    projectedDailyAverage: roundOne(projectedDailyAverage),
    confidence,
    trendLabel,
    targetDate: formatDate(targetEnd),
    basis: `${elapsedDays}일 경과, 보고 발생 ${activeDays}일 기준`,
  };
};

const createConcentrationRisk = (
  id: string,
  label: string,
  share: number,
  entityName: string,
  followUpQuestion: string
): AiRiskSignal | null => {
  if (share < 0.35) return null;
  const percent = share * 100;
  const severity: AiInsightSeverity = share >= 0.55 ? 'critical' : 'warning';
  return {
    id,
    severity,
    title: `${label} 공수 집중`,
    description: `${entityName}에 전체 공수의 ${formatNumber(percent)}%가 집중되어 있습니다.`,
    metricLabel: '집중도',
    metricValue: `${formatNumber(percent)}%`,
    basis: share >= 0.55 ? '55% 이상 단일 항목 집중' : '35% 이상 단일 항목 집중',
    followUpQuestion,
  };
};

const createDailyVolatilityRisk = (dailyAgg: AiDailyAggInput[]): AiRiskSignal | null => {
  const sorted = [...dailyAgg].filter((day) => day.totalManDay > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 4) return null;

  const latest = sorted[sorted.length - 1];
  const previous = sorted.slice(Math.max(0, sorted.length - 4), sorted.length - 1);
  const previousAverage = average(previous.map((day) => day.totalManDay));
  if (previousAverage <= 0) return null;

  const diff = latest.totalManDay - previousAverage;
  const ratio = latest.totalManDay / previousAverage;
  if (ratio < 1.4 && ratio > 0.6) return null;
  if (Math.abs(diff) < 5) return null;

  const isSpike = diff > 0;
  return {
    id: 'daily-volatility',
    severity: Math.abs(diff) >= previousAverage ? 'critical' : 'warning',
    title: isSpike ? '최근 일 공수 급증' : '최근 일 공수 급감',
    description: `${latest.date} 공수가 직전 평균 대비 ${formatNumber(Math.abs(diff))}공수 ${isSpike ? '증가' : '감소'}했습니다.`,
    metricLabel: isSpike ? '증가폭' : '감소폭',
    metricValue: `${isSpike ? '+' : '-'}${formatNumber(Math.abs(diff))}공수`,
    basis: `직전 ${previous.length}개 보고일 평균 ${formatNumber(previousAverage)}공수 대비`,
    followUpQuestion: `${latest.date} 공수 변동 원인을 현장별로 분석해줘`,
  };
};

const createCostOutlierRisk = (siteAgg: AiSiteAggInput[]): AiRiskSignal | null => {
  const rows = siteAgg
    .filter((site) => site.totalManDay >= 1 && site.totalAmount > 0)
    .map((site) => ({
      siteName: site.siteName,
      costPerManDay: site.totalAmount / site.totalManDay,
      totalManDay: site.totalManDay,
    }));
  if (rows.length < 3) return null;

  const baseline = median(rows.map((row) => row.costPerManDay));
  if (baseline <= 0) return null;
  const top = rows.sort((a, b) => b.costPerManDay - a.costPerManDay)[0];
  const diff = top.costPerManDay - baseline;
  if (top.costPerManDay < baseline * 1.25 || diff < 20000) return null;

  return {
    id: 'site-cost-outlier',
    severity: top.costPerManDay >= baseline * 1.5 ? 'critical' : 'warning',
    title: '현장 단위공수 비용 편차',
    description: `${top.siteName}의 공수당 비용이 현장 중앙값보다 ${formatMoney(diff)} 높습니다.`,
    metricLabel: '공수당 비용',
    metricValue: formatMoney(top.costPerManDay),
    basis: `현장 중앙값 ${formatMoney(baseline)} 대비`,
    followUpQuestion: `${top.siteName} 현장의 인건비 구성을 작업자별로 보여줘`,
  };
};

const createComparisonRisk = (input: AiAdvancedInsightInput): AiRiskSignal | null => {
  const previous = input.comparison?.prevSummary.totalManDay || 0;
  const current = input.summary.totalManDay;
  if (!input.comparison || previous <= 0 || current <= 0) return null;

  const diff = current - previous;
  const pct = diff / previous;
  if (Math.abs(pct) < 0.2 || Math.abs(diff) < 10) return null;

  const isUp = diff > 0;
  return {
    id: 'comparison-shift',
    severity: Math.abs(pct) >= 0.4 ? 'critical' : 'warning',
    title: isUp ? '전기간 대비 공수 증가' : '전기간 대비 공수 감소',
    description: `이전 기간 대비 총 공수가 ${formatNumber(Math.abs(diff))}공수 ${isUp ? '증가' : '감소'}했습니다.`,
    metricLabel: '증감률',
    metricValue: `${isUp ? '+' : '-'}${formatNumber(Math.abs(pct) * 100)}%`,
    basis: `${input.comparison.prevPeriod} 대비`,
    followUpQuestion: '공수 증감 원인을 팀별 기여도로 분석해줘',
  };
};

const createWorkerLoadRisk = (workerAgg: AiWorkerAggInput[]): AiRiskSignal | null => {
  if (workerAgg.length === 0) return null;
  const top = [...workerAgg].sort((a, b) => b.avgManDay - a.avgManDay)[0];
  if (top.avgManDay < 1.15 || top.workDays < 3) return null;

  return {
    id: 'worker-load',
    severity: top.avgManDay >= 1.3 ? 'critical' : 'info',
    title: '작업자 평균 공수 과다',
    description: `${top.name}의 근무일 평균 공수가 ${formatNumber(top.avgManDay)}공수입니다.`,
    metricLabel: '일평균',
    metricValue: `${formatNumber(top.avgManDay)}공수`,
    basis: `${top.workDays}일 근무 기준`,
    followUpQuestion: `${top.name} 작업자의 일자별 공수와 현장을 보여줘`,
  };
};

const buildRiskSignals = (input: AiAdvancedInsightInput): AiRiskSignal[] => {
  const signals: Array<AiRiskSignal | null> = [
    createComparisonRisk(input),
    createDailyVolatilityRisk(input.dailyAgg),
    createConcentrationRisk(
      'team-concentration',
      '팀',
      getTopShare(input.teamAgg, input.summary.totalManDay),
      input.teamAgg[0]?.teamName || '상위 팀',
      `${input.teamAgg[0]?.teamName || '상위 팀'} 공수 집중 원인을 현장별로 분석해줘`
    ),
    createConcentrationRisk(
      'site-concentration',
      '현장',
      getTopShare(input.siteAgg, input.summary.totalManDay),
      input.siteAgg[0]?.siteName || '상위 현장',
      `${input.siteAgg[0]?.siteName || '상위 현장'} 공수와 인건비 상세를 보여줘`
    ),
    createCostOutlierRisk(input.siteAgg),
    createWorkerLoadRisk(input.workerAgg),
  ];

  const severityOrder: Record<AiInsightSeverity, number> = { critical: 3, warning: 2, info: 1 };
  return signals
    .filter((signal): signal is AiRiskSignal => Boolean(signal))
    .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
    .slice(0, 5);
};

const createDiffContributions = <T extends { totalManDay: number }>(
  type: AiContributionItem['type'],
  currentRows: T[],
  previousRows: T[],
  getLabel: (row: T) => string
): AiContributionItem[] => {
  const previousMap = new Map(previousRows.map((row) => [getLabel(row), row.totalManDay]));
  const labels = new Set<string>([
    ...currentRows.map(getLabel),
    ...previousRows.map(getLabel),
  ]);
  const rows = Array.from(labels).map((label) => {
    const current = currentRows.find((row) => getLabel(row) === label)?.totalManDay || 0;
    const previous = previousMap.get(label) || 0;
    const diff = current - previous;
    return { label, current, previous, diff };
  }).filter((row) => Math.abs(row.diff) >= 0.05);

  const totalAbsDiff = rows.reduce((total, row) => total + Math.abs(row.diff), 0);
  return rows
    .map((row) => {
      const diffPercent = row.previous > 0 ? (row.diff / row.previous) * 100 : undefined;
      return {
        id: `${type}-${row.label}`,
        type,
        label: row.label,
        current: roundOne(row.current),
        previous: roundOne(row.previous),
        diff: roundOne(row.diff),
        diffPercent: typeof diffPercent === 'number' ? roundOne(diffPercent) : undefined,
        share: totalAbsDiff > 0 ? roundOne((Math.abs(row.diff) / totalAbsDiff) * 100) : 0,
        direction: getDirection(row.diff),
        description: `${row.label} ${row.diff >= 0 ? '증가' : '감소'} 기여`,
      };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 6);
};

const createCurrentShareContributions = (input: AiAdvancedInsightInput): AiContributionItem[] => {
  const total = input.summary.totalManDay;
  if (total <= 0) return [];

  const teamItems = input.teamAgg.slice(0, 3).map((team) => ({
    id: `team-share-${team.teamName}`,
    type: 'team' as const,
    label: team.teamName,
    current: roundOne(team.totalManDay),
    diff: roundOne(team.totalManDay),
    share: roundOne((team.totalManDay / total) * 100),
    direction: 'up' as const,
    description: `전체 공수의 ${formatNumber((team.totalManDay / total) * 100)}%`,
  }));
  const siteItems = input.siteAgg.slice(0, 3).map((site) => ({
    id: `site-share-${site.siteName}`,
    type: 'site' as const,
    label: site.siteName,
    current: roundOne(site.totalManDay),
    diff: roundOne(site.totalManDay),
    share: roundOne((site.totalManDay / total) * 100),
    direction: 'up' as const,
    description: `전체 공수의 ${formatNumber((site.totalManDay / total) * 100)}%`,
  }));

  return [...teamItems, ...siteItems]
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);
};

const buildContributions = (input: AiAdvancedInsightInput): AiContributionItem[] => {
  if (!input.comparison) return createCurrentShareContributions(input);

  const teamContributions = createDiffContributions(
    'team',
    input.teamAgg,
    input.comparison.prevTeamAgg,
    (row) => row.teamName
  );
  const siteContributions = createDiffContributions(
    'site',
    input.siteAgg,
    input.comparison.prevSiteAgg,
    (row) => row.siteName
  );

  return [...teamContributions, ...siteContributions]
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 6);
};

const buildRecommendations = (
  input: AiAdvancedInsightInput,
  riskSignals: AiRiskSignal[],
  forecast?: AiForecastInsight
): AiRecommendation[] => {
  const recommendations: AiRecommendation[] = [];
  const topRisk = riskSignals[0];
  if (topRisk?.followUpQuestion) {
    recommendations.push({
      id: 'follow-top-risk',
      priority: topRisk.severity,
      title: topRisk.title,
      description: topRisk.description,
      actionLabel: '원인 분석',
      question: topRisk.followUpQuestion,
    });
  }

  if (forecast && forecast.totalDays > forecast.elapsedDays) {
    recommendations.push({
      id: 'forecast-review',
      priority: forecast.confidence === 'low' ? 'info' : 'warning',
      title: '월말 예상치 확인',
      description: `${forecast.targetDate} 기준 예상 공수는 ${formatNumber(forecast.projectedManDay)}공수, 예상 인건비는 ${formatMoney(forecast.projectedAmount)}입니다.`,
      actionLabel: '예상 상세',
      question: '이번 달 월말 예상 공수와 인건비를 팀별로 설명해줘',
    });
  }

  if (!input.comparison) {
    recommendations.push({
      id: 'compare-last-period',
      priority: 'info',
      title: '전기간 비교 실행',
      description: '현재 집계만으로는 증감 원인이 제한적으로 보입니다. 지난달 또는 직전 기간과 비교하면 변동 원인을 더 명확히 볼 수 있습니다.',
      actionLabel: '비교 분석',
      question: '이번 달 vs 지난달 팀별 공수 비교',
    });
  }

  const topSite = input.siteAgg[0];
  if (topSite) {
    recommendations.push({
      id: 'top-site-detail',
      priority: 'info',
      title: '상위 현장 상세 확인',
      description: `${topSite.siteName} 현장이 ${formatNumber(topSite.totalManDay)}공수로 가장 큽니다.`,
      actionLabel: '현장 상세',
      question: `${topSite.siteName} 현장의 작업자별 공수와 인건비를 보여줘`,
    });
  }

  return recommendations.slice(0, 4);
};

const buildFollowUpQuestions = (
  input: AiAdvancedInsightInput,
  riskSignals: AiRiskSignal[],
  recommendations: AiRecommendation[]
): string[] => {
  const questions = new Set<string>();
  riskSignals.forEach((signal) => {
    if (signal.followUpQuestion) questions.add(signal.followUpQuestion);
  });
  recommendations.forEach((recommendation) => questions.add(recommendation.question));
  if (input.teamAgg[0]) questions.add(`${input.teamAgg[0].teamName} 공수 집중 원인을 현장별로 분석해줘`);
  if (input.siteAgg[0]) questions.add(`${input.siteAgg[0].siteName} 현장의 작업자별 공수를 보여줘`);
  questions.add('이번 달 월말 예상 공수와 인건비를 알려줘');
  return Array.from(questions).slice(0, 5);
};

const buildNarrativeHighlights = (
  input: AiAdvancedInsightInput,
  riskSignals: AiRiskSignal[],
  forecast?: AiForecastInsight
): string[] => {
  const highlights: string[] = [];
  if (riskSignals.length > 0) {
    highlights.push(`주의 신호 ${riskSignals.length}건이 감지되었습니다. 최우선 항목은 ${riskSignals[0].title}입니다.`);
  } else {
    highlights.push('현재 집계에서는 즉시 조치가 필요한 큰 이상징후가 감지되지 않았습니다.');
  }

  if (forecast) {
    highlights.push(`현재 추세 기준 월말 예상은 ${formatNumber(forecast.projectedManDay)}공수, ${formatMoney(forecast.projectedAmount)}입니다.`);
  }

  if (input.comparison) {
    const diff = input.summary.totalManDay - input.comparison.prevSummary.totalManDay;
    const direction = diff >= 0 ? '증가' : '감소';
    highlights.push(`비교 기간 대비 총 공수는 ${formatNumber(Math.abs(diff))}공수 ${direction}했습니다.`);
  } else if (input.teamAgg[0]) {
    const share = input.summary.totalManDay > 0 ? (input.teamAgg[0].totalManDay / input.summary.totalManDay) * 100 : 0;
    highlights.push(`${input.teamAgg[0].teamName}이 전체 공수의 ${formatNumber(share)}%를 차지합니다.`);
  }

  return highlights.slice(0, 3);
};

export const createDailyReportAiInsights = (
  input: AiAdvancedInsightInput
): DailyReportAiInsights => {
  const forecast = createForecast(input);
  const riskSignals = buildRiskSignals(input);
  const contributions = buildContributions(input);
  const recommendations = buildRecommendations(input, riskSignals, forecast);

  return {
    riskSignals,
    forecast,
    contributions,
    recommendations,
    followUpQuestions: buildFollowUpQuestions(input, riskSignals, recommendations),
    narrativeHighlights: buildNarrativeHighlights(input, riskSignals, forecast),
  };
};
