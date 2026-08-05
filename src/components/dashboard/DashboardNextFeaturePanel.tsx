import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faLightbulb } from '@fortawesome/free-solid-svg-icons';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import {
  createDashboardFeatureSuggestions,
  type DashboardFeatureSuggestion,
  type DashboardSuggestionTone,
} from '../../features/dashboard-intelligence/dashboardSuggestions';

interface DashboardNextFeaturePanelProps {
  stats: DashboardExecutiveStats;
}

const toneClassMap: Record<DashboardSuggestionTone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/60',
  orange: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:ring-orange-900/60',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-900/60',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/60',
  red: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/60',
};

const SuggestionRow: React.FC<{
  suggestion: DashboardFeatureSuggestion;
  onSelect: (route: string) => void;
}> = ({ suggestion, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(suggestion.route)}
    className="group grid w-full grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/80 sm:grid-cols-[1fr_auto]"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold ring-1 ${toneClassMap[suggestion.tone]}`}>
          {suggestion.priorityLabel}
        </span>
        <h4 className="text-sm font-black text-slate-900 dark:text-white">{suggestion.title}</h4>
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
        {suggestion.description}
      </p>
    </div>
    <span className="inline-flex items-center gap-2 self-center text-sm font-extrabold text-blue-700 transition group-hover:text-blue-800 dark:text-blue-300 dark:group-hover:text-blue-200">
      {suggestion.actionLabel}
      <FontAwesomeIcon icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-0.5" />
    </span>
  </button>
);

export const DashboardNextFeaturePanel: React.FC<DashboardNextFeaturePanelProps> = ({ stats }) => {
  const navigate = useNavigate();
  const suggestions = useMemo(() => createDashboardFeatureSuggestions(stats), [stats]);

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">
            <FontAwesomeIcon icon={faLightbulb} />
            Next Feature Radar
          </div>
          <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">다음 기능 자동 제안</h3>
        </div>
        <p className="max-w-xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          운영 데이터 변화에 따라 우선 개발할 기능을 자동으로 정렬합니다.
        </p>
      </div>

      <div>
        {suggestions.map((suggestion) => (
          <SuggestionRow key={suggestion.id} suggestion={suggestion} onSelect={navigate} />
        ))}
      </div>
    </section>
  );
};
