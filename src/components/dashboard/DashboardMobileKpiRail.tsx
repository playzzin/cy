import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardCheck,
  faGaugeHigh,
  faHardHat,
  faRightLeft,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';

interface DashboardMobileKpiRailProps {
  stats: DashboardExecutiveStats;
}

const formatManDay = (value: number): string => (
  Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
);

const RailItem: React.FC<{
  label: string;
  value: string;
  icon: IconDefinition;
  tone: string;
}> = ({ label, value, icon, tone }) => (
  <div className="min-w-[138px] rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-center gap-2">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <FontAwesomeIcon icon={icon} className="text-xs" />
      </span>
      <span className="truncate text-xs font-extrabold text-slate-400 dark:text-slate-500">{label}</span>
    </div>
    <div className="mt-2 truncate text-lg font-black text-slate-900 dark:text-white">{value}</div>
  </div>
);

export const DashboardMobileKpiRail: React.FC<DashboardMobileKpiRailProps> = ({ stats }) => {
  const supportPrefix = stats.operations.supportBalance > 0 ? '+' : '';

  return (
    <section className="mb-5 -mx-4 overflow-x-auto px-4 pb-1 md:hidden" aria-label="모바일 핵심 지표">
      <div className="flex min-w-max gap-2">
        <RailItem
          label="일보 커버리지"
          value={`${stats.operations.reportCoverageRate}%`}
          icon={faClipboardCheck}
          tone="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
        />
        <RailItem
          label="운영 건강도"
          value={`${stats.operations.healthScore}/100`}
          icon={faGaugeHigh}
          tone="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200"
        />
        <RailItem
          label="오늘 공수"
          value={`${formatManDay(stats.reports.todayManDay)}공`}
          icon={faHardHat}
          tone="bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200"
        />
        <RailItem
          label="지원 순증감"
          value={`${supportPrefix}${formatManDay(stats.operations.supportBalance)}공`}
          icon={faRightLeft}
          tone="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>
    </section>
  );
};
