import React, { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { DashboardExecutiveStats } from '../../services/dashboardExecutiveService';
import { useSiteMode } from '../../contexts/SiteModeContext';
import { createDashboardChartInsights } from '../../features/dashboard-charts/dashboardChartInsights';

interface DashboardOperationsChartProps {
    stats: DashboardExecutiveStats;
}

const formatNumber = (value: number): string => (
    Number(value || 0).toLocaleString('ko-KR', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
        maximumFractionDigits: 1,
    })
);

const formatDateLabel = (date: string): string => date ? date.slice(5).replace('-', '/') : '-';

export const DashboardOperationsChart: React.FC<DashboardOperationsChartProps> = ({ stats }) => {
    const { isDarkMode } = useSiteMode();
    const [dayRange, setDayRange] = useState<7 | 14>(7);
    const chartData = useMemo(() => ([
        {
            label: '일보 커버리지',
            value: stats.operations.reportCoverageRate,
            unit: '%',
            fill: '#2563eb',
        },
        {
            label: '평균 공수',
            value: stats.operations.averageManDayPerReport,
            unit: '공',
            fill: '#0f766e',
        },
        {
            label: '지원 순증감',
            value: stats.operations.supportBalance,
            unit: '공',
            fill: stats.operations.supportBalance >= 0 ? '#0d9488' : '#ea580c',
        },
    ]), [stats.operations]);
    const trendPoints = useMemo(() => stats.dailyTrend.slice(-dayRange), [dayRange, stats.dailyTrend]);
    const chartInsights = useMemo(() => createDashboardChartInsights(trendPoints), [trendPoints]);
    const trendData = useMemo(() => trendPoints.map((point) => ({
        date: point.date.slice(5),
        manDay: point.manDay,
        reportCount: point.reportCount,
    })), [trendPoints]);
    const gridStroke = isDarkMode ? '#334155' : '#e2e8f0';
    const axisText = isDarkMode ? '#cbd5e1' : '#64748b';
    const mutedText = isDarkMode ? '#94a3b8' : '#94a3b8';

    return (
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 motion-safe:animate-fadeInUp">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">운영 지표 차트</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">핵심 운영 지표와 최근 {dayRange}일 공수 흐름</p>
                </div>
                <div className="inline-flex w-fit overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                    {[7, 14].map((range) => (
                        <button
                            key={range}
                            type="button"
                            onClick={() => setDayRange(range as 7 | 14)}
                            className={`min-h-8 rounded-md px-3 text-xs font-black transition ${
                                dayRange === range
                                    ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-200'
                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                            }`}
                        >
                            {range}일
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="border-b border-slate-100 pb-3 dark:border-slate-700 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
                    <div className="text-xs font-extrabold text-slate-400 dark:text-slate-500">누적 공수</div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{formatNumber(chartInsights.totalManDay)}공</div>
                </div>
                <div className="border-b border-slate-100 pb-3 dark:border-slate-700 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
                    <div className="text-xs font-extrabold text-slate-400 dark:text-slate-500">일평균 공수</div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{formatNumber(chartInsights.averageDailyManDay)}공</div>
                </div>
                <div className="border-b border-slate-100 pb-3 dark:border-slate-700 sm:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
                    <div className="text-xs font-extrabold text-slate-400 dark:text-slate-500">피크일</div>
                    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                        {formatDateLabel(chartInsights.peakManDayDate)} · {formatNumber(chartInsights.peakManDay)}공
                    </div>
                </div>
                <div>
                    <div className="text-xs font-extrabold text-slate-400 dark:text-slate-500">추세</div>
                    <div className={`mt-1 text-lg font-black ${
                        chartInsights.direction === 'up'
                            ? 'text-teal-700 dark:text-teal-300'
                            : chartInsights.direction === 'down'
                                ? 'text-orange-700 dark:text-orange-300'
                                : 'text-slate-900 dark:text-white'
                    }`}>
                        {chartInsights.directionLabel} · 일보 {chartInsights.totalReports}건
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="h-64 w-full sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 4 }}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: axisText, fontSize: 12, fontWeight: 700 }}
                                interval={0}
                                minTickGap={2}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: mutedText, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={48}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                                formatter={(value, _name, item) => {
                                    const unit = String(item.payload?.unit || '');
                                    return [`${formatNumber(Number(value))}${unit}`, item.payload?.label || '지표'];
                                }}
                                contentStyle={{
                                    background: isDarkMode ? '#0f172a' : '#ffffff',
                                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                                    border: `1px solid ${gridStroke}`,
                                    borderRadius: 10,
                                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                                    fontWeight: 700,
                                }}
                            />
                            <ReferenceLine y={0} stroke={isDarkMode ? '#64748b' : '#cbd5e1'} />
                            <Bar
                                dataKey="value"
                                radius={[8, 8, 0, 0]}
                                barSize={36}
                                isAnimationActive
                                animationBegin={120}
                                animationDuration={720}
                            >
                                {chartData.map((entry) => (
                                    <Cell key={entry.label} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="h-64 w-full sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: axisText, fontSize: 12, fontWeight: 700 }}
                                interval={dayRange === 14 ? 1 : 0}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                yAxisId="manDay"
                                tick={{ fill: mutedText, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={44}
                            />
                            <YAxis
                                yAxisId="reports"
                                orientation="right"
                                tick={{ fill: mutedText, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={34}
                            />
                            <Tooltip
                                cursor={{ stroke: isDarkMode ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }}
                                formatter={(value, name) => {
                                    if (name === 'manDay') return [`${formatNumber(Number(value))}공`, '공수'];
                                    return [`${Number(value).toLocaleString('ko-KR')}건`, '일보'];
                                }}
                                contentStyle={{
                                    background: isDarkMode ? '#0f172a' : '#ffffff',
                                    color: isDarkMode ? '#f8fafc' : '#0f172a',
                                    border: `1px solid ${gridStroke}`,
                                    borderRadius: 10,
                                    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                                    fontWeight: 700,
                                }}
                            />
                            <ReferenceLine
                                yAxisId="manDay"
                                y={chartInsights.averageDailyManDay}
                                stroke={isDarkMode ? '#64748b' : '#94a3b8'}
                                strokeDasharray="5 5"
                            />
                            <Bar
                                yAxisId="manDay"
                                dataKey="manDay"
                                fill="#2563eb"
                                radius={[6, 6, 0, 0]}
                                barSize={dayRange === 14 ? 18 : 24}
                                animationDuration={650}
                            />
                            <Line
                                yAxisId="reports"
                                type="monotone"
                                dataKey="reportCount"
                                stroke="#f97316"
                                strokeWidth={3}
                                dot={{ r: 3, strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                                animationDuration={720}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
};
