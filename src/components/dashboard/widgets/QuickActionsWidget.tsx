import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPen,
    faClipboardList,
    faUsers,
    faHardHat,
    faBuilding,
    faFileInvoiceDollar,
    faHandHoldingDollar,
    faRightLeft,
    faBolt
} from '@fortawesome/free-solid-svg-icons';

const WidgetContainer = styled.div`
    background: #ffffff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
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
        color: #f59e0b;
    }
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;

    @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
    }
`;

const ActionButton = styled.button<{ $color: string; $bg: string }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 100px;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        border-color: ${props => props.$color};
        background: ${props => props.$bg};

        .icon-wrapper {
            background: ${props => props.$color};
            color: white;
        }

        h4 {
            color: ${props => props.$color};
        }
    }
`;

const IconWrapper = styled.div<{ $color: string; $bg: string }>`
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: ${props => props.$bg};
    color: ${props => props.$color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    margin-bottom: 8px;
    transition: all 0.2s ease;
`;

const Label = styled.h4`
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    margin: 0;
    transition: color 0.2s ease;
`;

export const QuickActionsWidget: React.FC = () => {
    const navigate = useNavigate();

    const actions = [
        {
            label: '일보 작성',
            icon: faPen,
            path: '/reports/daily?tab=input',
            color: '#3b82f6', // blue-500
            bg: '#eff6ff'     // blue-50
        },
        {
            label: '오늘 현황',
            icon: faClipboardList,
            path: '/reports/daily?tab=list-v2',
            color: '#f97316', // orange-500
            bg: '#fff7ed'     // orange-50
        },
        {
            label: '작업자 관리',
            icon: faUsers,
            path: '/database/manpower-db',
            color: '#06b6d4', // cyan-500
            bg: '#ecfeff'     // cyan-50
        },
        {
            label: '팀 관리',
            icon: faHardHat,
            path: '/database/team-db',
            color: '#8b5cf6', // violet-500
            bg: '#f5f3ff'     // violet-50
        },
        {
            label: '현장 현황',
            icon: faBuilding,
            path: '/dashboard/site-status',
            color: '#10b981', // emerald-500
            bg: '#ecfdf5'     // emerald-50
        },
        {
            label: '급여 조회',
            icon: faFileInvoiceDollar,
            path: '/payroll/wage-payment',
            color: '#14b8a6', // teal-500
            bg: '#f0fdfa'     // teal-50
        },
        {
            label: '가불 신청',
            icon: faHandHoldingDollar,
            path: '/payroll/advance-payment',
            color: '#eab308', // yellow-500
            bg: '#fefce8'     // yellow-50
        },
        {
            label: '지원 관리',
            icon: faRightLeft,
            path: '/payroll/support-claim',
            color: '#ec4899', // pink-500
            bg: '#fdf2f8'     // pink-50
        }
    ];

    return (
        <WidgetContainer>
            <Header>
                <Title>
                    <FontAwesomeIcon icon={faBolt} />
                    빠른 실행
                </Title>
            </Header>
            <Grid>
                {actions.map((action, index) => (
                    <ActionButton
                        key={index}
                        onClick={() => navigate(action.path)}
                        $color={action.color}
                        $bg={action.bg}
                    >
                        <IconWrapper
                            className="icon-wrapper"
                            $color={action.color}
                            $bg={action.bg}
                        >
                            <FontAwesomeIcon icon={action.icon} />
                        </IconWrapper>
                        <Label>{action.label}</Label>
                    </ActionButton>
                ))}
            </Grid>
        </WidgetContainer>
    );
};
