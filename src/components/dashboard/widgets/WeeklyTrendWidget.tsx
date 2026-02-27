import React, { useMemo } from 'react';
import styled from 'styled-components';
import { DailySummary } from '../../../services/manpowerAnalyticsService';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';

interface WeeklyTrendWidgetProps {
    dailyTrend: DailySummary[];
}

const WidgetContainer = styled.div`
    background: #ffffff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    height: 100%;
    display: flex;
    flex-direction: column;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
`;

const Title = styled.h3`
    font-size: 1.1rem;
    font-weight: 700;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 10px;

    svg {
        color: #10b981;
    }
`;

const ChartContainer = styled.div`
    flex: 1;
    min-height: 250px;
`;

export const WeeklyTrendWidget: React.FC<WeeklyTrendWidgetProps> = ({ dailyTrend }) => {
    // Process data to get the last 7 days
    const chartData = useMemo(() => {
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(today, 6 - i);
            return format(d, 'yyyy-MM-dd');
        });

        return last7Days.map(dateStr => {
            const dayData = dailyTrend.find(d => d.date === dateStr);
            return {
                date: dateStr,
                displayDate: format(parseISO(dateStr), 'M/d', { locale: ko }),
                manDay: dayData?.totalManDay || 0,
                workerCount: dayData?.workerCount || 0
            };
        });
    }, [dailyTrend]);

    return (
        <WidgetContainer>
            <Header>
                <Title>
                    <FontAwesomeIcon icon={faChartLine} />
                    주간 작업 현황
                </Title>
            </Header>
            <ChartContainer>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid stroke="#f1f5f9" vertical={false} />
                        <XAxis
                            dataKey="displayDate"
                            scale="point"
                            padding={{ left: 10, right: 10 }}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis
                            yAxisId="left"
                            orientation="left"
                            stroke="#3b82f6"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: '공수', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#f97316"
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: '인원', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar
                            yAxisId="left"
                            dataKey="manDay"
                            name="총 공수"
                            barSize={20}
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="workerCount"
                            name="출력 인원"
                            stroke="#f97316"
                            strokeWidth={3}
                            dot={{ fill: '#ffffff', stroke: '#f97316', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartContainer>
        </WidgetContainer>
    );
};
