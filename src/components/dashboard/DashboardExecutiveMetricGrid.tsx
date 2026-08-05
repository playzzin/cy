import React from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faClipboardList,
  faHardHat,
  faRightLeft,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';

const formatManDay = (value: number) =>
  Number(value || 0).toLocaleString('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const joinClassNames = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(' ');

interface OperationInsightCardProps {
  label: string;
  value: React.ReactNode;
  unit: string;
  description: string;
  valueClassName?: string;
}

const OperationInsightCard = React.memo<OperationInsightCardProps>(({
  label,
  value,
  unit,
  description,
  valueClassName = 'text-slate-900 dark:text-white',
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <div className="text-xs font-extrabold uppercase text-slate-400 dark:text-slate-500">{label}</div>
    <div className="mt-2 flex items-baseline gap-2">
      <span className={joinClassNames('text-2xl font-black', valueClassName)}>{value}</span>
      <span className="text-sm font-bold text-slate-400">{unit}</span>
    </div>
    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{description}</p>
  </div>
));

interface ExecutiveStatCardProps {
  icon: IconDefinition;
  iconClassName: string;
  iconBgClassName: string;
  badge: string;
  badgeClassName: string;
  title: string;
  value?: React.ReactNode;
  unit?: string;
  footerLabel?: string;
  footerValue?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}

const ExecutiveStatCard = React.memo<ExecutiveStatCardProps>(({
  icon,
  iconClassName,
  iconBgClassName,
  badge,
  badgeClassName,
  title,
  value,
  unit,
  footerLabel,
  footerValue,
  onClick,
  children,
}) => {
  const isInteractive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={joinClassNames(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-800 sm:p-6',
        isInteractive
          ? 'group cursor-pointer transition-all hover:border-orange-200 hover:shadow-md dark:hover:border-orange-500/50'
          : 'hover:shadow-md'
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={joinClassNames('rounded-lg p-3 transition-colors', iconBgClassName, isInteractive && 'group-hover:bg-orange-100')}>
          <FontAwesomeIcon icon={icon} className={joinClassNames('text-2xl', iconClassName)} />
        </div>
        <span className={joinClassNames('rounded-full px-2 py-1 text-xs font-medium transition-colors', badgeClassName, isInteractive && 'group-hover:bg-orange-100')}>
          {badge}
        </span>
      </div>
      <h3 className={joinClassNames(
        'mb-1 text-sm font-medium text-slate-500 transition-colors dark:text-slate-400',
        isInteractive && 'group-hover:text-orange-600'
      )}>
        {title}
      </h3>
      {children ?? (
        <>
          <div className="flex items-baseline gap-2">
            <span className={joinClassNames(
              'text-3xl font-bold text-slate-800 transition-colors dark:text-white',
              isInteractive && 'group-hover:text-orange-600'
            )}>
              {value}
            </span>
            {unit && <span className="text-sm text-slate-400">{unit}</span>}
          </div>
          <div className="mt-4 flex justify-between border-t border-slate-50 pt-4 text-sm dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">{footerLabel}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{footerValue}</span>
          </div>
        </>
      )}
    </div>
  );
});

interface DashboardExecutiveMetricGridProps {
  stats: DashboardExecutiveStats;
  onTodayManDayClick: () => void;
}

export const DashboardExecutiveMetricGrid = React.memo<DashboardExecutiveMetricGridProps>(({
  stats,
  onTodayManDayClick,
}) => (
  <>
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
      <OperationInsightCard
        label="일보 커버리지"
        value={stats.operations.reportCoverageRate}
        unit="%"
        description="활성 현장 대비 오늘 일보 등록률"
      />
      <OperationInsightCard
        label="평균 일보 공수"
        value={formatManDay(stats.operations.averageManDayPerReport)}
        unit="공"
        description="이번 달 일보 1건당 평균 공수"
      />
      <OperationInsightCard
        label="지원 순증감"
        value={`${stats.operations.supportBalance >= 0 ? '+' : ''}${formatManDay(stats.operations.supportBalance)}`}
        unit="공"
        description="지원온 공수에서 지원간 공수를 차감"
        valueClassName={stats.operations.supportBalance >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-orange-700 dark:text-orange-300'}
      />
    </div>

    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-6">
      <ExecutiveStatCard
        icon={faUsers}
        iconClassName="text-blue-600"
        iconBgClassName="bg-blue-50"
        badge="실시간"
        badgeClassName="bg-blue-50 text-blue-600"
        title="총 등록 작업자"
        value={stats.workers.total}
        unit="명"
        footerLabel="현재 재직"
        footerValue={`${stats.workers.active}명`}
      />
      <ExecutiveStatCard
        icon={faBuilding}
        iconClassName="text-green-600"
        iconBgClassName="bg-green-50"
        badge="진행중"
        badgeClassName="bg-green-50 text-green-600"
        title="관리 현장"
        value={stats.sites.total}
        unit="개소"
        footerLabel="활성 현장"
        footerValue={`${stats.sites.active}개소`}
      />
      <ExecutiveStatCard
        icon={faHardHat}
        iconClassName="text-purple-600"
        iconBgClassName="bg-purple-50"
        badge="Teams"
        badgeClassName="bg-purple-50 text-purple-600"
        title="운영 팀"
        value={stats.teams.total}
        unit="팀"
        footerLabel="시스템 등록"
        footerValue="완료"
      />
      <ExecutiveStatCard
        icon={faClipboardList}
        iconClassName="text-orange-600"
        iconBgClassName="bg-orange-50"
        badge="Today"
        badgeClassName="bg-orange-50 text-orange-600"
        title="오늘 총공수"
        value={formatManDay(stats.reports.todayManDay)}
        unit="공"
        footerLabel="이번 달 누적"
        footerValue={`${formatManDay(stats.reports.thisMonthManDay)}공`}
        onClick={onTodayManDayClick}
      />
      <ExecutiveStatCard
        icon={faRightLeft}
        iconClassName="text-teal-600"
        iconBgClassName="bg-teal-50"
        badge="이번 달"
        badgeClassName="bg-teal-50 text-teal-600"
        title="지원 현황"
      >
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">지원 공수</span>
            <span className="text-lg font-bold text-slate-800 dark:text-white">
              {(stats.support.inbound + stats.support.outbound).toFixed(1)}공
            </span>
          </div>
          <div className="my-1 h-px w-full bg-slate-100 dark:bg-slate-700" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">지원온거</span>
            <span className="font-bold text-teal-600">+{stats.support.inbound.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">지원간거</span>
            <span className="font-bold text-orange-600">-{stats.support.outbound.toFixed(1)}</span>
          </div>
        </div>
      </ExecutiveStatCard>
    </div>
  </>
));
