import { getKoreanDateKey, getKoreanMinuteOfDay, toKoreanDateKey } from '../../utils/koreanBusinessDate';
import type { DailyReportTargetPlan, DailyReportTargetSource } from './dailyReportTargets';

// Korea business time; null disables deadline-based evaluation.
export const DASHBOARD_REPORT_DEADLINE_MINUTES: number | null = 18 * 60;
export type DailyReportCoverageStatus = 'collecting' | 'overdue' | 'complete' | 'no-work' | 'unknown' | 'unavailable' | 'monitoring';

export const dailyReportCoverageLabels: Record<DailyReportCoverageStatus, string> = {
  collecting: '집계 중', overdue: '마감 후 미작성', complete: '작성 완료', 'no-work': '작업 예정 없음',
  unknown: '제출 대상 확인 필요', unavailable: '일정 조회 실패', monitoring: '작성 현황',
};

export interface DailyReportCoverageSite {
  siteId: string;
  siteName: string;
  responsibleTeamName?: string;
  managerName?: string;
}

export interface DailyReportCoverageSummary {
  date: string;
  activeSiteCount: number;
  expectedSiteCount?: number;
  reportedSiteCount: number;
  missingSiteCount: number;
  coverageRate: number | null;
  missingSites: DailyReportCoverageSite[];
  source?: DailyReportTargetSource;
  status?: DailyReportCoverageStatus;
  deadlineLabel?: string | null;
  detail?: string;
  unmatchedSiteCount?: number;
}

const normalizeKey = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();
const asText = (value: unknown): string => String(value ?? '').trim();

export const isActiveReportSite = (site: Record<string, any>): boolean => {
  const status = normalizeKey(site.status);
  if (!status) return true;
  return ['active', '운영중', '진행중', '사용', 'open'].includes(status);
};

export const getExpectedReportSiteCount = (coverage: DailyReportCoverageSummary): number => coverage.expectedSiteCount ?? coverage.activeSiteCount;
export const isReportCoverageFinal = (coverage: DailyReportCoverageSummary): boolean => coverage.status
  ? coverage.status === 'overdue' || coverage.status === 'complete'
  : coverage.coverageRate !== null;
export const getReportCoverageLabel = (coverage: DailyReportCoverageSummary): string => coverage.status
  ? dailyReportCoverageLabels[coverage.status] : '일보 작성 현황';

export const buildDailyReportCoverage = ({
  sites, reports, date = new Date(), plan = { source: 'unknown', assignments: [] },
  now = new Date(), deadlineMinutes = DASHBOARD_REPORT_DEADLINE_MINUTES,
}: {
  sites: Array<Record<string, any>>;
  reports: Array<Record<string, any>>;
  date?: Date | string;
  plan?: DailyReportTargetPlan;
  now?: Date;
  deadlineMinutes?: number | null;
}): DailyReportCoverageSummary => {
  const dateKey = toKoreanDateKey(date);
  const activeSites = sites.filter(isActiveReportSite);
  const byId = new Map<string, Record<string, any>>();
  const byName = new Map<string, Array<Record<string, any>>>();
  sites.forEach((site) => {
    [site.id, site.legacyId].map(asText).filter(Boolean).forEach((id) => byId.set(id, site));
    const name = normalizeKey(site.name);
    if (name) byName.set(name, [...(byName.get(name) || []), site]);
  });
  const resolveSite = (row: Record<string, any>): Record<string, any> | undefined => {
    const id = asText(row.siteId);
    if (id && byId.has(id)) return byId.get(id);
    const matches = byName.get(normalizeKey(row.siteName)) || [];
    return matches.length === 1 ? matches[0] : undefined;
  };
  const siteKey = (site: Record<string, any>): string => asText(site.id || site.legacyId) || `name:${normalizeKey(site.name)}`;
  const targets = new Map<string, Record<string, any>>();
  const unmatched = new Set<string>();
  plan.assignments.forEach((row) => {
    const site = resolveSite(row);
    if (!site) {
      unmatched.add(asText(row.siteId) || normalizeKey(row.siteName) || 'unknown');
    } else if (isActiveReportSite(site)) {
      targets.set(siteKey(site), site);
    }
  });
  const reportedKeys = new Set<string>();
  reports.filter((report) => asText(report.date).slice(0, 10) === dateKey).forEach((report) => {
    const site = resolveSite(report);
    if (!site || !isActiveReportSite(site)) return;
    const key = siteKey(site);
    reportedKeys.add(key);
    // Actual work recorded outside the plan is also a submission target.
    targets.set(key, site);
  });
  const missingSites = [...targets.entries()]
    .filter(([key]) => !reportedKeys.has(key))
    .map(([key, site]) => ({
      siteId: asText(site.id || site.legacyId) || key,
      siteName: asText(site.name) || '현장명 확인 필요',
      responsibleTeamName: asText(site.responsibleTeamName),
      managerName: asText(site.siteManagerName || site.managerName),
    }));
  const expectedSiteCount = targets.size;
  const reportedSiteCount = expectedSiteCount - missingSites.length;
  const targetsKnown = ['confirmed', 'dispatch'].includes(plan.source) && unmatched.size === 0;
  const coverageRate = targetsKnown && expectedSiteCount > 0 ? Math.round(reportedSiteCount / expectedSiteCount * 100) : null;
  const deadlineLabel = deadlineMinutes === null ? null
    : `${String(Math.floor(deadlineMinutes / 60)).padStart(2, '0')}:${String(deadlineMinutes % 60).padStart(2, '0')}`;
  const currentDate = getKoreanDateKey(now);
  let status: DailyReportCoverageStatus;
  if (plan.source === 'unavailable') status = 'unavailable';
  else if (!targetsKnown) status = 'unknown';
  else if (expectedSiteCount === 0) status = 'no-work';
  else if (deadlineMinutes === null) status = 'monitoring';
  else if (dateKey > currentDate || (dateKey === currentDate && getKoreanMinuteOfDay(now) < deadlineMinutes)) status = 'collecting';
  else status = missingSites.length > 0 ? 'overdue' : 'complete';

  const detail = status === 'unavailable' ? '현장 일정을 불러오지 못해 제출 대상과 점수 평가를 보류했습니다.'
    : status === 'unknown' ? unmatched.size > 0
      ? `일정의 ${unmatched.size}개 현장을 등록 현장과 연결하지 못했습니다. 현장 일정을 확인해 주세요.`
      : plan.source === 'requests' ? '현장 요청만 등록되어 있습니다. 실제 배치 일정을 확인한 뒤 제출 대상을 확정합니다.'
        : '기준일에 저장된 작업 일정이 없습니다. 활성 현장 전체를 미작성으로 계산하지 않습니다.'
    : status === 'no-work' ? '등록된 일정에 일보를 제출할 작업 현장이 없습니다. 휴무·취소·빈 배치는 제외했습니다.'
    : status === 'monitoring' ? '마감 시간을 사용하지 않아 작성 현황만 표시합니다.'
    : status === 'collecting' ? `한국 시간 ${deadlineLabel} 마감 전입니다. 미작성 현장은 작성 대기로 표시합니다.`
    : status === 'overdue' ? `한국 시간 ${deadlineLabel} 마감 후 제출 대상 ${expectedSiteCount}개 중 ${missingSites.length}개 현장이 미작성입니다.`
    : `제출 대상 ${expectedSiteCount}개 현장의 일보가 모두 작성되었습니다.`;

  return { date: dateKey, activeSiteCount: activeSites.length, expectedSiteCount, reportedSiteCount,
    missingSiteCount: missingSites.length, coverageRate, missingSites, source: plan.source, status,
    deadlineLabel, detail, unmatchedSiteCount: unmatched.size };
};
