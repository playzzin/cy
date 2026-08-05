
import { useState, useEffect } from 'react';
import { manpowerAnalyticsService } from '../services/manpowerAnalyticsService';
import { DashboardData } from '../types/dashboard';
import {
    calculateTrendPercent,
    getPreviousDateRange,
    getTrendStatus,
    PREVIOUS_PERIOD_TREND_LABEL
} from '../utils/dashboardKpiTrend';

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
                const previousRange = getPreviousDateRange(startDate, endDate);
                const [stats, dailyTrend, teamPerformance, siteStatus, supportAnalysis, previousStats] = await Promise.all([
                    manpowerAnalyticsService.getManpowerStatistics(startDate, endDate),
                    manpowerAnalyticsService.getDailySummary(startDate, endDate),
                    manpowerAnalyticsService.getTeamManpower(startDate, endDate),
                    manpowerAnalyticsService.getSiteManpower(startDate, endDate),
                    manpowerAnalyticsService.getSupportAnalysis(startDate, endDate),
                    previousRange
                        ? manpowerAnalyticsService.getManpowerStatistics(previousRange.startDate, previousRange.endDate)
                        : Promise.resolve(null)
                ]);

                const totalManDayTrend = previousStats
                    ? calculateTrendPercent(stats.totalManDay, previousStats.totalManDay)
                    : 0;
                const totalAmountTrend = previousStats
                    ? calculateTrendPercent(stats.totalAmount, previousStats.totalAmount)
                    : 0;
                const workerCountTrend = previousStats
                    ? calculateTrendPercent(stats.totalWorkers, previousStats.totalWorkers)
                    : 0;

                // KPI 구성 (예시)
                const kpis = [
                    {
                        id: 'total-manday',
                        label: '총 공수',
                        value: stats.totalManDay,
                        unit: '공수',
                        trend: totalManDayTrend,
                        status: getTrendStatus(totalManDayTrend),
                        trendLabel: PREVIOUS_PERIOD_TREND_LABEL
                    },
                    {
                        id: 'total-amount',
                        label: '총 노무비',
                        value: stats.totalAmount,
                        unit: '원',
                        trend: totalAmountTrend,
                        status: getTrendStatus(totalAmountTrend),
                        trendLabel: PREVIOUS_PERIOD_TREND_LABEL
                    },
                    {
                        id: 'worker-count',
                        label: '출력 인원',
                        value: stats.totalWorkers,
                        unit: '명',
                        trend: workerCountTrend,
                        status: getTrendStatus(workerCountTrend),
                        trendLabel: PREVIOUS_PERIOD_TREND_LABEL
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
