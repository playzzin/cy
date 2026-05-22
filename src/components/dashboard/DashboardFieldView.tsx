import React, { useMemo } from 'react';
import styled from 'styled-components';
import { useDashboardData } from '../../hooks/useDashboardData';
import { MyTeamStatusWidget } from './widgets/MyTeamStatusWidget';
import { WeeklyTrendWidget } from './widgets/WeeklyTrendWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { format, subDays } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { DASHBOARD_MODES, DashboardModeConfig } from './roleDashboardConfig';

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 40px;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 24px;

    @media (max-width: 1024px) {
        display: flex;
        flex-direction: column;
    }
`;

const Col = styled.div<{ $span: number }>`
    grid-column: span ${props => props.$span};
`;

interface DashboardFieldViewProps {
    modeConfig?: DashboardModeConfig;
}

export const DashboardFieldView: React.FC<DashboardFieldViewProps> = ({ modeConfig = DASHBOARD_MODES[2] }) => {
    // Determine date range for data fetching
    // We want data for at least the last 7 days for the trend, and today for the summary.
    // Fetching from start of month to end of month usually covers "Today", unless it's the 1st of month.
    // To be safe for "Last 7 days" trend even at start of month, let's fetch last 30 days or start of prev month.
    // However, useDashboardData might be designed for "This Month" view.
    // Let's use [Today - 30 days, Today] to ensure we have trend data and today's data.

    const dateRange = useMemo(() => {
        const today = new Date();
        const start = subDays(today, 30);
        return {
            start: format(start, 'yyyy-MM-dd'),
            end: format(today, 'yyyy-MM-dd')
        };
    }, []);

    const { data: dashboardData, loading: dashboardLoading } = useDashboardData(dateRange.start, dateRange.end);

    if (dashboardLoading) {
        return (
            <div className="flex justify-center items-center h-96">
                <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500" />
            </div>
        );
    }

    return (
        <Container>
            {/* Analytics & Team Status */}
            {modeConfig.id !== 'worker' && (
                <Grid>
                    <Col $span={6}>
                        <MyTeamStatusWidget
                            teamPerformance={dashboardData?.teamPerformance || []}
                            dailyTrend={dashboardData?.dailyTrend || []}
                        />
                    </Col>
                    <Col $span={6}>
                        <WeeklyTrendWidget
                            dailyTrend={dashboardData?.dailyTrend || []}
                        />
                    </Col>
                </Grid>
            )}

            {/* Quick Actions */}
            <Grid>
                <Col $span={12}>
                    <QuickActionsWidget modeConfig={modeConfig} />
                </Col>
            </Grid>
        </Container>
    );
};
