import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowTrendUp,
  faChartLine,
  faGaugeHigh,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';

interface DashboardOperationsPulsePanelProps {
  stats: DashboardExecutiveStats;
}

const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${Number(value || 0).toFixed(1)}%`;
const formatManDay = (value: number) => `${Number(value || 0).toLocaleString('ko-KR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})}공`;

const healthTone = {
  critical: {
    label: '위험',
    icon: faTriangleExclamation,
    bar: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900/60',
  },
  watch: {
    label: '주의',
    icon: faTriangleExclamation,
    bar: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60',
  },
  stable: {
    label: '안정',
    icon: faGaugeHigh,
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60',
  },
} as const;

export const DashboardOperationsPulsePanel: React.FC<DashboardOperationsPulsePanelProps> = ({ stats }) => {
  const tone = healthTone[stats.operations.healthLabel] || healthTone.critical;

  const rows = [
    {
      label: '일보 건수 전일 대비',
      value: formatPercent(stats.operations.reportCountTrendPercent),
      icon: faArrowTrendUp,
    },
    {
      label: '공수 전일 대비',
      value: formatPercent(stats.operations.manDayTrendPercent),
      icon: faChartLine,
    },
    {
      label: '월말 예상 공수',
      value: formatManDay(stats.operations.monthlyManDayRunRate),
      icon: faGaugeHigh,
    },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 motion-safe:animate-fadeInUp">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="border-b border-slate-100 p-5 dark:border-slate-700 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">Operations Pulse</div>
              <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">운영 건강도</h3>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${tone.badge}`}>
              <FontAwesomeIcon icon={tone.icon} />
              {tone.label}
            </span>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <span className="text-4xl font-black text-slate-950 dark:text-white">{stats.operations.healthScore}</span>
            <span className="pb-1 text-sm font-bold text-slate-400">/ 100</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone.bar}`}
              style={{ width: `${Math.max(0, Math.min(100, stats.operations.healthScore))}%` }}
            />
          </div>
          <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
            일보 커버리지, 당일 활동, 지원 공수 균형을 합산한 운영 신호입니다.
          </p>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-700 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {rows.map((row, index) => (
            <div
              key={row.label}
              className="p-5 motion-safe:animate-fadeInUp"
              style={{ animationDelay: `${0.05 * index}s` }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <FontAwesomeIcon icon={row.icon} />
              </div>
              <div className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400">{row.label}</div>
              <div className="mt-1 text-xl font-black text-slate-900 dark:text-white">{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
