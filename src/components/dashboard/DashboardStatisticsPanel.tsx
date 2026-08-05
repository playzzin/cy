import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarDays,
  faChartSimple,
  faClipboardCheck,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import {
  createDashboardStatistics,
  type DashboardStatisticItem,
  type DashboardStatisticTone,
} from '../../features/dashboard-statistics/dashboardStatistics';
import { useCountAnimation } from '../../hooks/useCountAnimation';

interface DashboardStatisticsPanelProps {
  stats: DashboardExecutiveStats;
}

const toneStyles: Record<DashboardStatisticTone, {
  icon: string;
  bar: string;
  value: string;
}> = {
  blue: {
    icon: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
    bar: 'bg-blue-600',
    value: 'text-blue-700 dark:text-blue-200',
  },
  teal: {
    icon: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200',
    bar: 'bg-teal-600',
    value: 'text-teal-700 dark:text-teal-200',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    bar: 'bg-amber-500',
    value: 'text-amber-700 dark:text-amber-200',
  },
  red: {
    icon: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200',
    bar: 'bg-red-600',
    value: 'text-red-700 dark:text-red-200',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
    bar: 'bg-slate-700 dark:bg-slate-300',
    value: 'text-slate-900 dark:text-white',
  },
};

const itemIcons: Record<string, IconDefinition> = {
  'month-progress': faCalendarDays,
  'monthly-run-rate': faChartSimple,
  'report-coverage': faClipboardCheck,
  'task-stability': faListCheck,
};

const formatAnimatedValue = (value: number, item: DashboardStatisticItem): string => (
  `${Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: item.precision,
    maximumFractionDigits: item.precision,
  })}${item.unit}`
);

const StatisticCard: React.FC<{ item: DashboardStatisticItem }> = ({ item }) => {
  const styles = toneStyles[item.tone];
  const shouldReduceMotion = typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const animatedValue = useCountAnimation(item.numericValue, shouldReduceMotion ? 1 : 720, item.precision);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 motion-safe:animate-fadeInUp">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">{item.label}</div>
          <div className={`mt-2 text-2xl font-black ${styles.value}`}>{formatAnimatedValue(animatedValue, item)}</div>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
          <FontAwesomeIcon icon={itemIcons[item.id]} />
        </span>
      </div>
      <p className="mt-2 min-h-[20px] text-xs font-bold text-slate-500 dark:text-slate-400">{item.detail}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${styles.bar}`}
          style={{
            width: `${item.progress}%`,
            transition: shouldReduceMotion ? undefined : 'width 550ms ease-out',
          }}
        />
      </div>
    </div>
  );
};

export const DashboardStatisticsPanel: React.FC<DashboardStatisticsPanelProps> = ({ stats }) => {
  const statistics = useMemo(() => createDashboardStatistics(stats), [stats]);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">Statistics</div>
          <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">운영 통계 요약</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statistics.map((item) => (
          <StatisticCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};
