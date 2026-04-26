import React, { useEffect, useState, useMemo } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../../contexts/AuthContext';
import { manpowerService } from '../../../services/manpowerService';
import { TeamManpowerSummary, DailySummary } from '../../../services/manpowerAnalyticsService';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faChartLine, faHardHat } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface MyTeamStatusWidgetProps {
    teamPerformance: TeamManpowerSummary[];
    dailyTrend: DailySummary[];
}

const WidgetContainer = styled.div`
    background: #ffffff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    height: 100%;
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(0, 0, 0, 0.05);

    transition: transform 0.2s ease, box-shadow 0.2s ease;
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    }
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
`;

const Title = styled.h3`
    font-size: 1.1rem;
    font-weight: 700;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 10px;

    svg {
        color: #3b82f6;
    }
`;

const Content = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const StatsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
`;

const StatItem = styled.div`
    background: #f8fafc;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
`;

const StatLabel = styled.span`
    font-size: 0.85rem;
    color: #64748b;
    margin-bottom: 6px;
`;

const StatValue = styled.span`
    font-size: 1.25rem;
    font-weight: 700;
    color: #0f172a;

    small {
        font-size: 0.85rem;
        font-weight: 500;
        color: #94a3b8;
        margin-left: 2px;
    }
`;

const ChartContainer = styled.div`
    flex: 1;
    min-height: 200px;
    margin-top: 8px;
`;

const NoTeamState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #94a3b8;
    gap: 12px;

    svg {
        font-size: 2rem;
        margin-bottom: 8px;
    }
`;

export const MyTeamStatusWidget: React.FC<MyTeamStatusWidgetProps> = ({
    teamPerformance,
    dailyTrend
}) => {
    const { currentUser } = useAuth();
    const [myTeamId, setMyTeamId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMyTeam = async () => {
            if (!currentUser?.uid) return;
            try {
                const worker = await manpowerService.getWorkerByUid(currentUser.uid);
                if (worker?.teamId) {
                    setMyTeamId(worker.teamId);
                }
            } catch (error) {
                console.error("Failed to fetch my team info", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMyTeam();
    }, [currentUser]);

    const myTeamData = useMemo(() => {
        if (!myTeamId) return null;
        return teamPerformance.find(t => t.teamId === myTeamId);
    }, [teamPerformance, myTeamId]);

    const chartData = useMemo(() => {
        if (!myTeamId) return [];
        return dailyTrend.map(day => {
            const teamDay = day.teams.find(t => t.teamId === myTeamId);
            return {
                date: day.date,
                manDay: teamDay?.manDay || 0,
                amount: teamDay?.amount || 0,
                displayDate: format(new Date(day.date), 'M/d', { locale: ko })
            };
        });
    }, [dailyTrend, myTeamId]);

    if (loading) {
        return (
            <WidgetContainer>
                <Header><Title>우리 팀 현황</Title></Header>
                <Content>
                    <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>
                        정보를 불러오는 중...
                    </div>
                </Content>
            </WidgetContainer>
        );
    }

    if (!myTeamData) {
        return (
            <WidgetContainer>
                <Header>
                    <Title>
                        <FontAwesomeIcon icon={faUsers} />
                        우리 팀 현황
                    </Title>
                </Header>
                <Content>
                    <NoTeamState>
                        <FontAwesomeIcon icon={faUsers} />
                        <div>소속된 팀 정보를 찾을 수 없습니다.</div>
                    </NoTeamState>
                </Content>
            </WidgetContainer>
        );
    }

    return (
        <WidgetContainer>
            <Header>
                <Title>
                    <FontAwesomeIcon icon={faUsers} />
                    {myTeamData.teamName} 현황
                </Title>
            </Header>

            <Content>
                <StatsGrid>
                    <StatItem>
                        <StatLabel>총 공수</StatLabel>
                        <StatValue>
                            {myTeamData.totalManDay.toLocaleString()}
                            <small>공수</small>
                        </StatValue>
                    </StatItem>
                    <StatItem>
                        <StatLabel>평균 출력</StatLabel>
                        <StatValue>
                            {myTeamData.avgDailyManDay.toFixed(1)}
                            <small>공수/일</small>
                        </StatValue>
                    </StatItem>
                    <StatItem>
                        <StatLabel>총 인원</StatLabel>
                        <StatValue>
                            {myTeamData.workerCount.toLocaleString()}
                            <small>명</small>
                        </StatValue>
                    </StatItem>
                </StatsGrid>

                <ChartContainer>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorManDay" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="displayDate"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '8px',
                                    border: 'none',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="manDay"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorManDay)"
                                name="공수"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </Content>
        </WidgetContainer>
    );
};
