
import { useState, useEffect } from 'react';
import { manpowerAnalyticsService } from '../services/manpowerAnalyticsService';
import { DashboardData } from '../types/dashboard';

export const useDashboardData = (startDate: string, endDate: string) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // 병렬로 데이터 조회
                const [stats, dailyTrend, teamPerformance, siteStatus, supportAnalysis] = await Promise.all([
                    manpowerAnalyticsService.getManpowerStatistics(startDate, endDate),
                    manpowerAnalyticsService.getDailySummary(startDate, endDate),
                    manpowerAnalyticsService.getTeamManpower(startDate, endDate),
                    manpowerAnalyticsService.getSiteManpower(startDate, endDate),
                    manpowerAnalyticsService.getSupportAnalysis(startDate, endDate)
                ]);

                // KPI 구성 (예시)
                const kpis = [
                    {
                        id: 'total-manday',
                        label: '총 공수',
                        value: stats.totalManDay,
                        unit: '공수',
                        trend: 0, // TODO: 이전 기간 데이터 비교 로직 추가 필요
                        status: 'neutral' as const
                    },
                    {
                        id: 'total-amount',
                        label: '총 노무비',
                        value: stats.totalAmount,
                        unit: '원',
                        trend: 0,
                        status: 'neutral' as const
                    },
                    {
                        id: 'worker-count',
                        label: '출력 인원',
                        value: stats.totalWorkers,
                        unit: '명',
                        trend: 0,
                        status: 'neutral' as const
                    }
                ];

                setData({
                    period: { start: startDate, end: endDate },
                    stats,
                    dailyTrend,
                    teamPerformance,
                    siteStatus,
                    supportAnalysis,
                    kpis
                });

            } catch (err: any) {
                console.error('Failed to fetch dashboard data:', err);
                setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        if (startDate && endDate) {
            fetchData();
        }

    }, [startDate, endDate]);

    return { data, loading, error };
};
