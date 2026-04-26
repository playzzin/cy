import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { DailyReport } from '../../../services/dailyReportService';

interface RecentReportsWidgetProps {
    reports: DailyReport[];
}

const WidgetContainer = styled.div`
    background: #ffffff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
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
        color: #8b5cf6;
    }
`;

const ViewAllButton = styled.button`
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
        color: #3b82f6;
    }
`;

const ReportList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const ReportItem = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
    cursor: pointer;

    &:hover {
        background: #ffffff;
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        transform: translateY(-1px);
    }
`;

const ReportInfo = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
`;

const DateBox = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    width: 50px;
    height: 50px;
    
    span.day {
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
    }
    
    span.month {
        font-size: 0.7rem;
        color: #64748b;
        text-transform: uppercase;
    }
`;

const ReportDetails = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const MainText = styled.div`
    font-weight: 600;
    color: #1e293b;
    font-size: 1rem;
`;

const SubText = styled.div`
    font-size: 0.85rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const Badge = styled.span<{ $color: string; $bg: string }>`
    background-color: ${props => props.$bg};
    color: ${props => props.$color};
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
`;

const ManDayBadge = styled.div`
    background: #ecfdf5;
    color: #059669;
    padding: 6px 12px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 0.9rem;
    border: 1px solid #d1fae5;
`;

export const RecentReportsWidget: React.FC<RecentReportsWidgetProps> = ({ reports }) => {
    const navigate = useNavigate();

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: date.toLocaleString('en-US', { month: 'short' })
        };
    };

    if (!reports || reports.length === 0) {
        return (
            <WidgetContainer>
                <Header>
                    <Title><FontAwesomeIcon icon={faFileLines} />최근 일보</Title>
                </Header>
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    등록된 일보가 없습니다.
                </div>
            </WidgetContainer>
        );
    }

    return (
        <WidgetContainer>
            <Header>
                <Title>
                    <FontAwesomeIcon icon={faFileLines} />
                    최근 일보 활동
                </Title>
                <ViewAllButton onClick={() => navigate('/reports/daily?tab=list-v2')}>
                    전체보기 <FontAwesomeIcon icon={faArrowRight} />
                </ViewAllButton>
            </Header>
            <ReportList>
                {reports.slice(0, 5).map((report: any, index: number) => { // Using any for now as DailyReport type might need update or verification
                    const { day, month } = formatDate(report.date);
                    return (
                        <ReportItem key={index} onClick={() => navigate(`/reports/daily/edit/${report.id}`)}>
                            <ReportInfo>
                                <DateBox>
                                    <span className="day">{day}</span>
                                    <span className="month">{month}</span>
                                </DateBox>
                                <ReportDetails>
                                    <MainText>{report.siteName}</MainText>
                                    <SubText>
                                        <Badge $bg="#f1f5f9" $color="#475569">{report.teamName}</Badge>
                                        <span>•</span>
                                        <span>작업자 {report.workers?.length || 0}명</span>
                                    </SubText>
                                </ReportDetails>
                            </ReportInfo>
                            <ManDayBadge>
                                {report.totalManDay} 공수
                            </ManDayBadge>
                        </ReportItem>
                    );
                })}
            </ReportList>
        </WidgetContainer>
    );
};
