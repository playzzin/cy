
import React from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { ChartCard } from '../core/ChartCard';
import { SiteManpowerSummary } from '../../../services/manpowerAnalyticsService';
import { formatManDay } from '../../../utils/dashboard/formatters';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../utils/dashboard/chartConfig';

interface SiteStatusProps {
    data: SiteManpowerSummary[];
    loading?: boolean;
}

const COLORS = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.accent,
    CHART_COLORS.info,
    CHART_COLORS.danger,
    CHART_COLORS.dark
];

export const SiteStatus: React.FC<SiteStatusProps> = ({ data, loading }) => {
    // 상위 5개 + 기타
    const topSites = data.slice(0, 5);
    const otherManDay = data.slice(5).reduce((sum, item) => sum + item.totalManDay, 0);

    const chartData = [
        ...topSites,
        ...(otherManDay > 0 ? [{ siteName: '기타', totalManDay: otherManDay }] : [])
    ];

    return (
        <ChartCard
            title="현장별 비중"
            subtitle="전체 공수 대비 현장별 투입 비율"
            className="h-[400px]"
        >
            {loading ? (
                <div className="h-full w-full bg-slate-100 dark:bg-slate-700/30 animate-pulse rounded-lg" />
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData as any}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="totalManDay"
                            nameKey="siteName"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                ...CHART_DEFAULTS.tooltipStyle,
                                borderRadius: '12px'
                            }}
                            formatter={(value: any) => formatManDay(value)}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value: any) => <span className="text-sm text-slate-600 dark:text-slate-300 ml-1">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
};


