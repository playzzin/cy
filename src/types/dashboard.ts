import {
    ManpowerStats,
    DailySummary,
    TeamManpowerSummary,
    SiteManpowerSummary,
    SupportAnalysis
} from '../services/manpowerAnalyticsService';

export interface DashboardKPI {
    id: string;
    label: string;
    value: number;
    unit: string;
    trend: number;
    status: 'up' | 'down' | 'neutral';
    trendLabel?: string;
}

/** KPIItem: DashboardKPI alias (backward compat) */
export type KPIItem = DashboardKPI;

/** DashboardPeriod: 대시보드 조회 기간 */
export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom' | 'all';

export interface DashboardData {
    period: { start: string; end: string };
    stats: ManpowerStats;
    dailyTrend: DailySummary[];
    teamPerformance: TeamManpowerSummary[];
    siteStatus: SiteManpowerSummary[];
    supportAnalysis: SupportAnalysis;
    kpis: DashboardKPI[];
}
