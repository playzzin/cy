
import React from 'react';
import { usePeriodSelector } from '../../../hooks/usePeriodSelector';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { PeriodSelector } from '../core/PeriodSelector';
import { KPISummary } from './KPISummary';
import { ManDayTrend } from './ManDayTrend';
import { TeamPerformance } from './TeamPerformance';
import { SiteStatus } from './SiteStatus';
import { formatDate } from '../../../utils/dashboard/formatters';
import { Download } from 'lucide-react';

export const DashboardExecutiveView: React.FC = () => {
    const { period, dateRange, handlePeriodChange } = usePeriodSelector();
    const { data, loading, error } = useDashboardData(dateRange.start, dateRange.end);

    if (error) {
        return (
            <div className="flex items-center justify-center h-full p-10 text-rose-500">
                <p>데이터 로드 실패: {error}</p>
            </div>
        );
    }

    return (
        <div className="p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        경영진 대시보드
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {formatDate(dateRange.start)} ~ {formatDate(dateRange.end)} 통합 현황
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <PeriodSelector period={period} onChange={handlePeriodChange} />
                    <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-6 motion-safe:animate-fadeInUp">
                {/* KPI Row */}
                <div>
                    <KPISummary
                        items={data?.kpis || []}
                        loading={loading}
                    />
                </div>

                {/* Main Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <ManDayTrend
                            data={data?.dailyTrend || []}
                            loading={loading}
                        />
                    </div>
                    <div>
                        <SiteStatus
                            data={data?.siteStatus || []}
                            loading={loading}
                        />
                    </div>
                </div>

                {/* Secondary Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <TeamPerformance
                            data={data?.teamPerformance || []}
                            loading={loading}
                        />
                    </div>
                    {/* Placeholder for SupportFlow or other charts */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 text-sm h-[400px]">
                        추가 위젯 (재무/지원현황) 준비 중
                    </div>
                </div>
            </div>
        </div>
    );
};
