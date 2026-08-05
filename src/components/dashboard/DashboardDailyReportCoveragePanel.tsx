import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faClipboardCheck, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import type { DailyReportCoverageSummary } from '../../features/daily-report-coverage/dailyReportCoverage';

interface DashboardDailyReportCoveragePanelProps {
  coverage: DailyReportCoverageSummary;
}

export const DashboardDailyReportCoveragePanel: React.FC<DashboardDailyReportCoveragePanelProps> = ({ coverage }) => {
  const navigate = useNavigate();
  const topMissingSites = coverage.missingSites.slice(0, 5);

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-blue-600 dark:text-blue-300">
            <FontAwesomeIcon icon={faClipboardCheck} />
            Daily Report Coverage
          </div>
          <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">일보 누락 자동 추적</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            {coverage.date}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${coverage.coverageRate >= 90 ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200' : 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200'}`}>
            커버리지 {coverage.coverageRate}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-y border-slate-100 dark:border-slate-700">
        <div className="px-5 py-4">
          <div className="text-xs font-bold text-slate-400">활성 현장</div>
          <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{coverage.activeSiteCount}</div>
        </div>
        <div className="border-x border-slate-100 px-5 py-4 dark:border-slate-700">
          <div className="text-xs font-bold text-slate-400">작성 완료</div>
          <div className="mt-1 text-2xl font-black text-teal-700 dark:text-teal-300">{coverage.reportedSiteCount}</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs font-bold text-slate-400">누락</div>
          <div className="mt-1 text-2xl font-black text-orange-700 dark:text-orange-300">{coverage.missingSiteCount}</div>
        </div>
      </div>

      {topMissingSites.length === 0 ? (
        <div className="px-5 py-5 text-sm font-bold text-slate-500 dark:text-slate-400">
          오늘 기준 누락된 활성 현장이 없습니다.
        </div>
      ) : (
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

      {coverage.missingSiteCount > 0 && (
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
