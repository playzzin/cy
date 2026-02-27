
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
import { motion } from 'framer-motion';

export const DashboardExecutiveView: React.FC = () => {
    const { period, dateRange, handlePeriodChange } = usePeriodSelector();
    const { data, loading, error } = useDashboardData(dateRange.start, dateRange.end);

    const containerVariants: any = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants: any = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: 'spring',
                stiffness: 100
            }
        }
    };

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
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
            >
                {/* KPI Row */}
                <motion.div variants={itemVariants}>
                    <KPISummary
                        items={data?.kpis || []}
                        loading={loading}
                    />
                </motion.div>

                {/* Main Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <motion.div variants={itemVariants} className="lg:col-span-2">
                        <ManDayTrend
                            data={data?.dailyTrend || []}
                            loading={loading}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <SiteStatus
                            data={data?.siteStatus || []}
                            loading={loading}
                        />
                    </motion.div>
                </div>

                {/* Secondary Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <motion.div variants={itemVariants}>
                        <TeamPerformance
                            data={data?.teamPerformance || []}
                            loading={loading}
                        />
                    </motion.div>
                    {/* Placeholder for SupportFlow or other charts */}
                    <motion.div variants={itemVariants} className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 text-sm h-[400px]">
                        추가 위젯 (재무/지원현황) 준비 중
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};
