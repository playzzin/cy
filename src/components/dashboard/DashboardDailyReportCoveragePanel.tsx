import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faClipboardCheck, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { getExpectedReportSiteCount, getReportCoverageLabel, isReportCoverageFinal, type DailyReportCoverageSummary } from '../../features/daily-report-coverage/dailyReportCoverage';

interface DashboardDailyReportCoveragePanelProps {
  coverage: DailyReportCoverageSummary;
}

export const DashboardDailyReportCoveragePanel: React.FC<DashboardDailyReportCoveragePanelProps> = ({ coverage }) => {
  const navigate = useNavigate();
  const known = coverage.coverageRate !== null || coverage.status === 'no-work';
  const isFinal = isReportCoverageFinal(coverage);
  const topMissingSites = known ? coverage.missingSites.slice(0, 5) : [];

  return (
    <section aria-label="일보 제출 현황" className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-600 dark:text-blue-300">
            <FontAwesomeIcon icon={faClipboardCheck} />
            Daily Report Coverage
          </div>
          <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">일보 제출 현황</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            {coverage.date} · 한국 시간{coverage.deadlineLabel ? ` ${coverage.deadlineLabel} 마감` : ''}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${!isFinal ? 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300' : (coverage.coverageRate ?? 0) >= 90 ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200' : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200'}`}>
            {getReportCoverageLabel(coverage)}{coverage.coverageRate !== null ? ` · ${coverage.coverageRate}%` : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-y border-slate-100 dark:border-slate-700">
        <div className="px-5 py-4">
          <div className="text-xs font-bold text-slate-400">제출 대상</div>
          <div className={`mt-1 ${known ? 'text-2xl' : 'text-sm'} font-black text-slate-900 dark:text-white`}>{known ? getExpectedReportSiteCount(coverage) : '확인 필요'}</div>
        </div>
        <div className="border-x border-slate-100 px-5 py-4 dark:border-slate-700">
          <div className="text-xs font-bold text-slate-400">작성 완료</div>
          <div className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-300">{coverage.reportedSiteCount}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-bold text-slate-400">{isFinal ? '마감 후 미작성' : '작성 대기'}</div>
          <div className={`mt-1 text-2xl font-black ${isFinal && coverage.missingSiteCount > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-300'}`}>{known ? coverage.missingSiteCount : '—'}</div>
        </div>
      </div>

      <p className="px-5 py-4 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
        {coverage.detail || '기준일의 작업 일정과 작성된 일보를 기준으로 집계합니다.'}
      </p>
      {topMissingSites.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {topMissingSites.map((site) => (
            <button
              key={site.siteId}
              type="button"
              onClick={() => navigate(`/reports/daily?tab=list-v2&date=${coverage.date}&siteId=${encodeURIComponent(site.siteId)}`)}
              className="group flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-900 dark:text-white">{site.siteName}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  {site.responsibleTeamName || '담당팀 미지정'} · {site.managerName || '관리자 미지정'}
                </div>
              </div>
              <FontAwesomeIcon icon={faArrowRight} className="text-xs text-slate-400 transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      )}

      {!known && (
        <div className="px-5 pb-4">
          <button type="button" onClick={() => navigate(`/assignment/field-schedule?date=${encodeURIComponent(coverage.date)}`)}
            className="min-h-10 rounded-lg bg-blue-50 px-4 text-sm font-extrabold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
            제출 대상 일정 확인 →
          </button>
        </div>
      )}
      {isFinal && coverage.missingSiteCount > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={() => navigate('/messages/compose')}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-extrabold text-white transition hover:bg-blue-700"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            누락 알림 초안 작성
          </button>
        </div>
      )}
    </section>
  );
};
