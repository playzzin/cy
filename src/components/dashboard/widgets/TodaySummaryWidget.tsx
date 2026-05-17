import React, { useMemo } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHardHat, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { ManpowerStats, DailySummary } from '../../../services/manpowerAnalyticsService';
import { useCountAnimation } from '../../../hooks/useCountAnimation';

interface TodaySummaryWidgetProps {
    stats: Partial<ManpowerStats>;
    dailyTrend: DailySummary[];
}

const WidgetContainer = styled.div`
    background: #ffffff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
`;

const ContentWrapper = styled.div`
    position: relative;
    z-index: 2;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
`;

const Title = styled.h2`
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 10px;

    svg {
        color: #3b82f6;
    }
`;

const DateDisplay = styled.span`
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 500;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;

    @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
    }
`;

const StatCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const StatLabel = styled.span`
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 500;
`;

const StatValue = styled.div`
    font-size: 2rem;
    font-weight: 800;
    color: #0f172a;
    display: flex;
    align-items: baseline;
    gap: 4px;

    small {
        font-size: 1rem;
        font-weight: 600;
        color: #94a3b8;
    }
`;

const TrendBadge = styled.div<{ $isPositive: boolean; $isNeutral?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    font-weight: 600;
    color: ${props => props.$isNeutral ? '#64748b' : (props.$isPositive ? '#10b981' : '#ef4444')};
    background: ${props => props.$isNeutral ? '#f1f5f9' : (props.$isPositive ? '#ecfdf5' : '#fef2f2')};
    padding: 4px 8px;
    border-radius: 6px;
    width: fit-content;
`;

export const TodaySummaryWidget: React.FC<TodaySummaryWidgetProps> = ({ stats, dailyTrend }) => {
    // Current values
    const todayManDay = useCountAnimation(stats.totalManDay || 0, 1000, 1);
    const todayWorkerCount = useCountAnimation(stats.totalWorkers || 0);

    // Calculate trends (comparing to yesterday)
    const trends = useMemo(() => {
        if (!dailyTrend || dailyTrend.length < 2) return { manDay: 0, workerCount: 0 };

        // Ensure sorted by date
        const sorted = [...dailyTrend].sort((a, b) => a.date.localeCompare(b.date));
        const today = sorted[sorted.length - 1];
        const yesterday = sorted[sorted.length - 2];

        if (!today || !yesterday) return { manDay: 0, workerCount: 0 };

        const manDayDiff = today.totalManDay - yesterday.totalManDay;
        const workerDiff = today.workerCount - yesterday.workerCount;

        return {
            manDay: manDayDiff,
            workerCount: workerDiff
        };
    }, [dailyTrend]);

    const latestDay = dailyTrend.length > 0 ? dailyTrend[dailyTrend.length - 1] : null;

    return (
        <WidgetContainer>
            <ContentWrapper>
                <Header>
                    <Title>
                        <FontAwesomeIcon icon={faHardHat} />
                        오늘의 작업 현황
                    </Title>
                    <DateDisplay>
                        {new Date().toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                        })}
                    </DateDisplay>
                </Header>

                <StatsGrid>
                    {/* Total Man Day */}
                    <StatCard>
                        <StatLabel>총 공수</StatLabel>
                        <StatValue>
                            {todayManDay.toLocaleString('ko-KR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1
                            })}
                            <small>공수</small>
                        </StatValue>
                        <TrendBadge $isPositive={trends.manDay >= 0} $isNeutral={trends.manDay === 0}>
                            {trends.manDay !== 0 && (
                                <FontAwesomeIcon icon={trends.manDay > 0 ? faArrowUp : faArrowDown} />
                            )}
                            {Math.abs(trends.manDay).toFixed(1)} 전일대비
                        </TrendBadge>
                    </StatCard>

                    {/* Worker Count */}
                    <StatCard>
                        <StatLabel>출력 인원</StatLabel>
                        <StatValue>
                            {todayWorkerCount.toLocaleString()}
                            <small>명</small>
                        </StatValue>
                        <TrendBadge $isPositive={trends.workerCount >= 0} $isNeutral={trends.workerCount === 0}>
                            {trends.workerCount !== 0 && (
                                <FontAwesomeIcon icon={trends.workerCount > 0 ? faArrowUp : faArrowDown} />
                            )}
                            {Math.abs(trends.workerCount)} 전일대비
                        </TrendBadge>
                    </StatCard>

                    {/* Team Count */}
                    <StatCard>
                        <StatLabel>가동 팀</StatLabel>
                        <StatValue>
                            {latestDay?.teamCount || 0}
                            <small>팀</small>
                        </StatValue>
                        <div className="h-6"></div> {/* Spacer for alignment */}
                    </StatCard>

                    {/* Site Count */}
                    <StatCard>
                        <StatLabel>진행 현장</StatLabel>
                        <StatValue>
                            {latestDay?.siteCount || 0}
                            <small>개소</small>
                        </StatValue>
                        <div className="h-6"></div>
                    </StatCard>
                </StatsGrid>
            </ContentWrapper>
        </WidgetContainer>
    );
};
