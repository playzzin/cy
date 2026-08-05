import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faCircleCheck,
  faClipboardList,
  faGaugeHigh,
  faListCheck,
  faRightLeft,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import {
  createDashboardActionItems,
  type DashboardActionItem,
  type DashboardActionSeverity,
} from '../../features/dashboard-action-center/dashboardActionCenter';

interface DashboardActionCenterPanelProps {
  stats: DashboardExecutiveStats;
}

const severityStyles: Record<DashboardActionSeverity, {
  label: string;
  shell: string;
  icon: string;
  badge: string;
}> = {
  critical: {
    label: '긴급',
    shell: 'border-red-200 bg-red-50/60 dark:border-red-900/70 dark:bg-red-950/20',
    icon: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
    badge: 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900',
  },
  warning: {
    label: '주의',
    shell: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
    badge: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900',
  },
  info: {
    label: '확인',
    shell: 'border-blue-200 bg-blue-50/60 dark:border-blue-900/70 dark:bg-blue-950/20',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
    badge: 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900',
  },
  success: {
    label: '정상',
    shell: 'border-teal-200 bg-teal-50/60 dark:border-teal-900/70 dark:bg-teal-950/20',
    icon: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200',
    badge: 'bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900',
  },
};
const itemIcons: Record<string, IconDefinition> = {
  'daily-report-coverage': faClipboardList,
  'operations-health': faGaugeHigh,
  'task-sla': faListCheck,
  'support-balance': faRightLeft,
  'operations-clear': faCircleCheck,
};

const fallbackIcon = faTriangleExclamation;

const ActionCard: React.FC<{
  item: DashboardActionItem;
  onSelect: (route: string) => void;
}> = ({ item, onSelect }) => {
  const styles = severityStyles[item.severity];
  const icon = itemIcons[item.id] || fallbackIcon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.route)}
      className={`group flex h-full min-h-[156px] flex-col justify-between rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${styles.shell}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}>
            <FontAwesomeIcon icon={icon} />
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${styles.badge}`}>
            {styles.label}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h4 className="text-sm font-black text-slate-950 dark:text-white">{item.title}</h4>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {item.metricLabel} {item.metricValue}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
          {item.description}
        </p>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-slate-800 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
        {item.actionLabel}
        <FontAwesomeIcon icon={faArrowRight} className="text-xs transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
};

export const DashboardActionCenterPanel: React.FC<DashboardActionCenterPanelProps> = ({ stats }) => {
  const navigate = useNavigate();
  const actionItems = useMemo(() => createDashboardActionItems(stats), [stats]);
  const urgentCount = actionItems.filter((item) => item.severity === 'critical' || item.severity === 'warning').length;

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">
            <FontAwesomeIcon icon={faGaugeHigh} />
            Action Center
          </div>
          <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">오늘의 운영 액션</h3>
        </div>
        <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
          즉시 조치 {urgentCount}건 · 전체 {actionItems.length}건
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {actionItems.map((item) => (
          <ActionCard key={item.id} item={item} onSelect={navigate} />
        ))}
      </div>
    </section>
  );
};
