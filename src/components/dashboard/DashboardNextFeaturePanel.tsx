import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faChevronDown, faLightbulb, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import {
  createDashboardFeatureSuggestions,
  dashboardSuggestionCategoryLabels,
  type DashboardFeatureSuggestion,
  type DashboardSuggestionTone,
} from '../../features/dashboard-intelligence/dashboardSuggestions';

interface DashboardNextFeaturePanelProps {
  stats: DashboardExecutiveStats;
  dataAvailable?: boolean;
  refreshing?: boolean;
}

const toneClassMap: Record<DashboardSuggestionTone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/60',
  orange: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900/60',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900/60',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/60',
  red: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/60',
};

const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900';

const SuggestionCard: React.FC<{ suggestion: DashboardFeatureSuggestion; rank: number }> = ({ suggestion, rank }) => {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const titleId = useId();
  return (
    <article aria-labelledby={titleId} className={`flex min-w-0 flex-col rounded-xl border bg-white p-5 dark:bg-slate-900/50 ${rank === 1 ? 'border-blue-200 shadow-sm dark:border-blue-800' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-extrabold ${rank === 1 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
          {String(rank).padStart(2, '0')} · {rank === 1 ? '우선 추천' : dashboardSuggestionCategoryLabels[suggestion.category]}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${toneClassMap[suggestion.tone]}`}>
          우선도 {suggestion.priorityLabel}
        </span>
      </div>
      <h4 id={titleId} className="mt-4 text-base font-black leading-6 text-slate-900 dark:text-white">{suggestion.title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{suggestion.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
        {suggestion.evidence.map((metric) => (
          <div key={metric.label} className="min-w-0">
            <dt className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{metric.label}</dt>
            <dd className="mt-1 break-words text-base font-extrabold tabular-nums text-slate-900 dark:text-white">{metric.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        <FontAwesomeIcon icon={faWandMagicSparkles} className="mt-1.5 shrink-0 text-xs text-blue-500" />
        <p><span className="font-bold text-slate-700 dark:text-slate-200">기대 효과</span><br />{suggestion.impact}</p>
      </div>
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          <button type="button" aria-expanded={expanded} aria-controls={detailId} aria-label={`${suggestion.title} 추천 근거 및 실행 단계`} onClick={() => setExpanded((value) => !value)} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-xs font-bold text-slate-600 hover:text-blue-700 dark:text-slate-300 ${focusClass}`}>
            {expanded ? '상세 접기' : '근거 · 실행 단계'}
            <FontAwesomeIcon icon={faChevronDown} className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">추천 점수 <strong className="tabular-nums text-slate-700 dark:text-slate-200">{suggestion.score}</strong>/100</span>
        </div>
        <div id={detailId} hidden={!expanded} className="pb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p className="font-bold text-slate-800 dark:text-slate-100">추천 근거</p>
          <p className="mt-1 break-words">{suggestion.reason}</p>
          <p className="mt-3 font-bold text-slate-800 dark:text-slate-100">이렇게 시작하세요</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">{suggestion.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 dark:bg-slate-800">{suggestion.note}</p>
        </div>
        <Link to={suggestion.route} className={`group flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-extrabold transition ${focusClass} ${rank === 1 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
          {suggestion.actionLabel}
          <FontAwesomeIcon icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </article>
  );
};

export const DashboardNextFeaturePanel: React.FC<DashboardNextFeaturePanelProps> = ({ stats, dataAvailable = true, refreshing = false }) => {
  const [showAll, setShowAll] = useState(false);
  const headingId = useId();
  const listId = useId();
  const suggestions = useMemo(() => dataAvailable ? createDashboardFeatureSuggestions(stats) : [], [stats, dataAvailable]);
  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, 3);

  return (
    <section aria-labelledby={headingId} aria-busy={refreshing} className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><FontAwesomeIcon icon={faLightbulb} /></span>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Next Feature Radar</div>
            <h3 id={headingId} className="mt-1 text-base font-black text-slate-900 dark:text-white">다음 기능 자동 제안</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">운영 데이터에서 찾은 개선 기회, 효과가 큰 것부터 시작하세요.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
          <span role="status" className="rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{refreshing ? '데이터 갱신 중' : dataAvailable ? `추천 ${suggestions.length}건` : '데이터 확인 필요'}</span>
          {dataAvailable && stats.dailyReportCoverage?.date && <span className="text-slate-500 dark:text-slate-400">{stats.dailyReportCoverage.date} 기준</span>}
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="p-4 sm:p-5">
          <div id={listId} className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSuggestions.map((suggestion, index) => <SuggestionCard key={suggestion.id} suggestion={suggestion} rank={index + 1} />)}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">운영 지표의 조건과 영향 범위로 정렬합니다. 추천 점수는 우선순위 참고용이며, 버튼을 누르면 관련 업무 화면으로 이동합니다.</p>
            {suggestions.length > 3 && <button type="button" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((value) => !value)} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 ${focusClass}`}>
              {showAll ? '상위 3개만 보기' : `나머지 ${suggestions.length - 3}개 제안 보기`}
              <FontAwesomeIcon icon={faChevronDown} className={showAll ? 'rotate-180' : ''} />
            </button>}
          </div>
        </div>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{dataAvailable ? '추천을 위한 운영 데이터가 아직 없습니다.' : '운영 데이터를 불러오지 못해 추천을 보류했습니다.'}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{dataAvailable ? '현장과 일보가 등록되면 작성 현황과 공수 흐름에 맞춰 개선 기능을 제안합니다.' : '대시보드 상단의 새로고침으로 다시 불러와 주세요.'}</p>
        </div>
      )}
    </section>
  );
};
