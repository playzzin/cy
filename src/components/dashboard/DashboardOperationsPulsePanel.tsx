import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowTrendUp,
  faChartLine,
  faGaugeHigh,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { dashboardHealthLabels, formatDashboardTrend } from '../../features/dashboard-operations/dashboardOperations';

interface DashboardOperationsPulsePanelProps {
  stats: DashboardExecutiveStats;
}

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
  neutral: {
    icon: faGaugeHigh,
    bar: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
  },
} as const;

export const DashboardOperationsPulsePanel: React.FC<DashboardOperationsPulsePanelProps> = ({ stats }) => {
  const { healthScore, healthLabel, healthReason, healthDeductions = [] } = stats.operations;
  const coverage = stats.dailyReportCoverage;
  const tone = healthLabel === 'critical' || healthLabel === 'watch' || healthLabel === 'stable'
    ? healthTone[healthLabel] : healthTone.neutral;
  const reportRoute = `/reports/daily?tab=list-v2&date=${encodeURIComponent(coverage.date)}`;
  const needsSchedule = coverage.status === 'unknown' || coverage.status === 'unavailable';

  const rows = [
    {
      label: '일보 건수 전일 대비',
      value: formatDashboardTrend(stats.operations.reportCountTrendPercent),
      icon: faArrowTrendUp,
    },
    {
      label: '공수 전일 대비',
      value: formatDashboardTrend(stats.operations.manDayTrendPercent),
      icon: faChartLine,
    },
    {
      label: '월말 예상 공수',
      value: formatManDay(stats.operations.monthlyManDayRunRate),
      icon: faGaugeHigh,
    },
  ];

  return (
    <section aria-label="운영 건강도" className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 motion-safe:animate-fadeInUp">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="border-b border-slate-100 p-5 dark:border-slate-700 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">Operations Pulse</div>
              <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">운영 건강도</h3>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${tone.badge}`}>
              <FontAwesomeIcon icon={tone.icon} />
              {dashboardHealthLabels[healthLabel]}
            </span>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <span className={`${healthScore === null ? 'text-2xl' : 'text-4xl'} font-black text-slate-950 dark:text-white`}>
              {healthScore === null ? '평가 보류' : healthScore}
            </span>
            {healthScore !== null && <span className="pb-1 text-sm font-bold text-slate-400">/ 100점</span>}
          </div>
          {healthScore !== null && <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone.bar}`}
              style={{ width: `${Math.max(0, Math.min(100, healthScore))}%` }}
            />
          </div>}
          <p className="mt-3 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">{healthReason}</p>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {coverage.date} 기준 · {coverage.deadlineLabel ? `한국 시간 ${coverage.deadlineLabel} 마감` : '마감 평가 없음'}
          </div>
          {healthDeductions.map((deduction) => (
            <Link key={deduction.label} to={deduction.route} className="mt-3 block rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-extrabold">{deduction.label} · −{deduction.points}점</span>
              <span className="mt-1 block">{deduction.detail} 일보 확인 →</span>
            </Link>
          ))}
          {healthScore === null && coverage.status !== 'no-work' && (
            <Link to={needsSchedule ? `/assignment/field-schedule?date=${encodeURIComponent(coverage.date)}` : reportRoute}
              className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-blue-50 px-3 text-sm font-extrabold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              {needsSchedule ? '제출 대상 일정 확인' : '기준일 일보 확인'} →
            </Link>
          )}
          <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
            현재 점수는 마감 후 제출 대상 현장의 일보 작성률 기준입니다. 공수 증감과 지원 공수 차이는 감점하지 않습니다.
          </p>
        </div>

        <div>
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
        <p className="px-5 pb-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
          전일 대비는 양일에 일보가 있을 때 계산합니다. 전일 공수가 0이면 공수 증감률은 표시하지 않습니다.
          마감 전 증감률은 잠정 수치이며, 월말 예상 공수는 월 누적 공수를 경과 일수로 단순 환산한 값입니다.
        </p>
        </div>
      </div>
    </section>
  );
};
