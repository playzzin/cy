import React, { useMemo } from 'react';
import { AnalyticsResult } from '../../../services/geminiAnalyticsService';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface AiResultChartsProps {
    result: AnalyticsResult | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const AiResultCharts: React.FC<AiResultChartsProps> = ({ result }) => {
    const analysisType = result?.query?.analysisType;

    // 1. 일별 추이 (Line Chart)
    const dailyChart = useMemo(() => {
        if (!result || !result.success) return null;
        if (analysisType !== 'daily_summary' && analysisType !== 'comparison') return null;
        if (!result.dailyAgg || result.dailyAgg.length === 0) return null;

        const data = result.dailyAgg.map(day => ({
            date: day.date.substring(5), // MD only
            totalManDay: day.totalManDay,
            totalCost: day.totalAmount / 10000, // 만원 단위
        }));

        return (
            <div className="h-64 w-full bg-slate-900/30 rounded-lg p-4 mb-4 border border-slate-700/30">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">일별 공수 추이</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorManDay" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                            itemStyle={{ color: '#e2e8f0' }}
                            formatter={(val: unknown) => [typeof val === 'number' ? val.toFixed(1) : String(val ?? ''), '공수']}
                        />
                        <Area type="monotone" dataKey="totalManDay" stroke="#3b82f6" fillOpacity={1} fill="url(#colorManDay)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }, [result, analysisType]);

    // 2. 팀별/현장별 비교 (Bar Chart)
    const categoryChart = useMemo(() => {
        if (!result || !result.success) return null;
        // team_summary, site_summary, general 모두 팀 차트 우선
        if (['team_summary', 'site_summary', 'general'].includes(analysisType as string) || !analysisType) {
            let data: any[] = [];
            let key = '';
            let label = '';

            if (result.teamAgg && result.teamAgg.length > 0) {
                // 상위 10개만
                data = result.teamAgg.slice(0, 10).map(t => ({
                    name: t.teamName,
                    value: t.totalManDay
                }));
                key = 'team';
                label = '팀별 공수 Top 10';
            } else if (result.siteAgg && result.siteAgg.length > 0) {
                data = result.siteAgg.slice(0, 10).map(s => ({
                    name: s.siteName,
                    value: s.totalManDay
                }));
                key = 'site';
                label = '현장별 공수 Top 10';
            }

            if (data.length === 0) return null;

            return (
                <div className="h-64 w-full bg-slate-900/30 rounded-lg p-4 mb-4 border border-slate-700/30">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">{label}</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                            <Tooltip
                                cursor={{ fill: '#334155', opacity: 0.2 }}
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }
        return null;
    }, [result, analysisType]);

    // 3. 임금 모델 비율 (Pie Chart) -- salary_model or general
    const pieChart = useMemo(() => {
        if (!result || !result.success) return null;
        if (!result.salaryModelAgg || result.salaryModelAgg.length === 0) return null;

        const data = result.salaryModelAgg.map(m => ({
            name: m.salaryModel,
            value: m.totalManDay
        }));

        return (
            <div className="h-64 w-full bg-slate-900/30 rounded-lg p-4 mb-4 border border-slate-700/30">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">고용 형태 비율</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                            itemStyle={{ color: '#e2e8f0' }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }, [result]);

    if (!result || !result.success) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyChart}
            {categoryChart}
            {pieChart}
        </div>
    );
};
