import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task, STATUS_CONFIG } from '../../types/task';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { useDashboardExecutiveStats } from '../../hooks/useDashboardExecutiveStats';
import { DashboardActionCenterPanel } from './DashboardActionCenterPanel';
import { DashboardDailyReportCoveragePanel } from './DashboardDailyReportCoveragePanel';
import { DashboardNextFeaturePanel } from './DashboardNextFeaturePanel';
import { DashboardExecutiveMetricGrid } from './DashboardExecutiveMetricGrid';
import { DashboardMobileKpiRail } from './DashboardMobileKpiRail';
import { DashboardOperationsPulsePanel } from './DashboardOperationsPulsePanel';
import { DashboardStatisticsPanel } from './DashboardStatisticsPanel';
import { DashboardModeConfig } from './roleDashboardConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight, faSpinner,
    faListCheck, faRotateRight
} from '@fortawesome/free-solid-svg-icons';

interface DashboardExecutiveViewProps {
    modeConfig?: DashboardModeConfig;
}

const DashboardOperationsChart = lazy(() =>
    import('./DashboardOperationsChart').then((module) => ({
        default: module.DashboardOperationsChart,
    }))
);

export const DashboardExecutiveView: React.FC<DashboardExecutiveViewProps> = () => {
    const {
        loading,
        refreshing,
        lastUpdatedAt,
        stats,
        refresh,
    } = useDashboardExecutiveStats();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-brand-600 mb-4" />
                    <p className="text-slate-500 font-medium">시스템 데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardExecutiveViewContent
            stats={stats}
            refreshing={refreshing}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={refresh}
        />
    );
};

// Internal component to handle the displaying using the fetched stats
const DashboardExecutiveViewContent = React.memo<{
    stats: DashboardExecutiveStats;
    refreshing: boolean;
    lastUpdatedAt: Date | null;
    onRefresh: () => void;
}>(({ stats, refreshing, lastUpdatedAt, onRefresh }) => {
    const navigate = useNavigate();
    const handleTodayManDayClick = React.useCallback(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        navigate(`/reports/daily?tab=list-v2&date=${todayStr}`);
    }, [navigate]);
    const handleTodoClick = React.useCallback(() => {
        navigate('/todo');
    }, [navigate]);
    const handleManualClick = React.useCallback(() => {
        navigate('/manual');
    }, [navigate]);

    return (
        <div>
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">운영 대시보드</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {lastUpdatedAt
                            ? `마지막 업데이트 ${lastUpdatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                            : '최신 운영 데이터를 준비 중입니다.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                >
                    <FontAwesomeIcon icon={faRotateRight} spin={refreshing} />
                    {refreshing ? '갱신 중' : '새로고침'}
                </button>
            </div>

            <DashboardOperationsPulsePanel stats={stats} />

            <DashboardMobileKpiRail stats={stats} />

            <DashboardActionCenterPanel stats={stats} />

            <DashboardStatisticsPanel stats={stats} />

            <DashboardExecutiveMetricGrid
                stats={stats}
                onTodayManDayClick={handleTodayManDayClick}
            />

            <Suspense
                fallback={
                    <div className="mb-8 h-64 rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        차트 준비 중...
                    </div>
                }
            >
                <DashboardOperationsChart stats={stats} />
            </Suspense>

            <DashboardDailyReportCoveragePanel coverage={stats.dailyReportCoverage} />

            <DashboardNextFeaturePanel stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Recent Tasks (Work Requests) */}
                    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center dark:border-slate-700">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">최근 업무 요청</h2>
                            <button
                                onClick={handleTodoClick}
                                className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                            >
                                전체보기 <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {stats.recentTasks.length > 0 ? (
                                stats.recentTasks.map((task: Task) => {
                                    const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG['요청'];
                                    const taskKey = task.id || `${task.title}:${task.assignee}:${task.dueDate}`;

                                    return (
                                        <div
                                            key={taskKey}
                                            onClick={handleTodoClick}
                                            className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer dark:hover:bg-slate-700/60"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                                    <FontAwesomeIcon icon={faListCheck} />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-800 line-clamp-1 dark:text-slate-100">{task.title}</h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{task.assignee} • {task.dueDate}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`inline-block px-2 py-1 ${statusInfo.color.split(' ').filter(c => !c.startsWith('border-')).join(' ')} text-[10px] rounded-md font-bold`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    등록된 업무 요청이 없습니다.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* System Status */}
                    <div className="bg-slate-800 rounded-xl p-6 text-white shadow-lg">
                        <h3 className="font-bold text-lg mb-4">시스템 상태</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 text-sm">서버 연결</span>
                                <span className="flex items-center gap-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    정상
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 text-sm">데이터베이스</span>
                                <span className="flex items-center gap-2 text-xs font-medium bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                    연결됨
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 text-sm">마지막 백업</span>
                                <span className="text-xs text-slate-400">오늘 03:00 AM</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-slate-700">
                            <button
                                onClick={handleManualClick}
                                className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                            >
                                사용자 매뉴얼 확인
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
});
