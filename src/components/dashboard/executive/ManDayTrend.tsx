
import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChartCard } from '../core/ChartCard';
import { DailySummary } from '../../../services/manpowerAnalyticsService';
import { formatDateWithDay, formatManDay } from '../../../utils/dashboard/formatters';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../utils/dashboard/chartConfig';

interface ManDayTrendProps {
    data: DailySummary[];
    loading?: boolean;
}

export const ManDayTrend: React.FC<ManDayTrendProps> = ({ data, loading }) => {
    return (
        <ChartCard title="일별 공수 추이" subtitle="기간 내 일자별 전체 공수 변화" className="h-[400px]">
            {loading ? (
                <div className="h-full w-full bg-slate-100 dark:bg-slate-700/30 animate-pulse rounded-lg" />
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={CHART_DEFAULTS.margin}>
                        <defs>
                            <linearGradient id="colorManDay" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(date) => formatDateWithDay(date)}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={CHART_DEFAULTS.tooltipStyle}
                            itemStyle={{ color: '#1E293B', fontWeight: 600 }}
                            formatter={(value: any) => [formatManDay(value), '공수']}
                            labelFormatter={(label) => formatDateWithDay(label)}
                        />
                        <Area
                            type="monotone"
                            dataKey="totalManDay"
                            stroke={CHART_COLORS.primary}
                            fillOpacity={1}
                            fill="url(#colorManDay)"
                            strokeWidth={3}
                            animationDuration={CHART_DEFAULTS.animationDuration}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};
