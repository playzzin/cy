
import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { ChartCard } from '../core/ChartCard';
import { TeamManpowerSummary } from '../../../services/manpowerAnalyticsService';
import { formatCurrencyShort, formatManDay } from '../../../utils/dashboard/formatters';
import { CHART_COLORS, CHART_DEFAULTS, getTeamColor } from '../../../utils/dashboard/chartConfig';

interface TeamPerformanceProps {
    data: TeamManpowerSummary[];
    loading?: boolean;
}

export const TeamPerformance: React.FC<TeamPerformanceProps> = ({ data, loading }) => {
    // 상위 5개 팀만 표시
    const chartData = data.slice(0, 5);

    return (
        <ChartCard
            title="팀별 성과 (Top 5)"
            subtitle="누적 공수 기준 상위 팀 현황"
            className="h-[400px]"
        >
            {loading ? (
                <div className="h-full w-full bg-slate-100 dark:bg-slate-700/30 animate-pulse rounded-lg" />
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={CHART_DEFAULTS.margin} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="teamName"
                            type="category"
                            width={100}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748B', fontSize: 13, fontWeight: 500 }}
                        />
                        <Tooltip
                            contentStyle={CHART_DEFAULTS.tooltipStyle}
                            cursor={{ fill: 'transparent' }}
                            formatter={(value: any, name: any) => [
                                name === 'totalManDay' ? formatManDay(value) : formatCurrencyShort(value),
                                name === 'totalManDay' ? '총 공수' : '총 노무비'
                            ]}
                        />
                        <Bar
                            dataKey="totalManDay"
                            name="totalManDay"
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                            animationDuration={CHART_DEFAULTS.animationDuration}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getTeamColor(entry.teamName)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};
