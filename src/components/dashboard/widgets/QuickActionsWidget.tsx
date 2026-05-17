import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCog } from '@fortawesome/free-solid-svg-icons';
import { DASHBOARD_MODES, DashboardModeConfig } from '../roleDashboardConfig';
import { QuickMenuSettingsModal } from '../QuickMenuSettingsModal';
import { useQuickMenuActionSettings } from '../useQuickMenuActions';

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
    gap: 12px;
    flex-wrap: wrap;
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

const SettingsButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 800;
    transition: all 0.2s ease;

    &:hover {
        border-color: #c7d2fe;
        background: #eef2ff;
        color: #4338ca;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
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

const EmptyState = styled.div`
    grid-column: 1 / -1;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    padding: 28px;
    text-align: center;
    color: #64748b;
    font-size: 0.9rem;
`;

interface QuickActionsWidgetProps {
    modeConfig?: DashboardModeConfig;
}

const actionThemeMap: Record<string, { color: string; bg: string }> = {
    brand: { color: '#3b82f6', bg: '#eff6ff' },
    blue: { color: '#2563eb', bg: '#eff6ff' },
    green: { color: '#16a34a', bg: '#f0fdf4' },
    slate: { color: '#475569', bg: '#f8fafc' },
    indigo: { color: '#4f46e5', bg: '#eef2ff' },
    emerald: { color: '#059669', bg: '#ecfdf5' },
    sky: { color: '#0284c7', bg: '#f0f9ff' },
    rose: { color: '#e11d48', bg: '#fff1f2' },
    purple: { color: '#9333ea', bg: '#faf5ff' },
    violet: { color: '#8b5cf6', bg: '#f5f3ff' },
    orange: { color: '#f97316', bg: '#fff7ed' },
    amber: { color: '#d97706', bg: '#fffbeb' },
    cyan: { color: '#06b6d4', bg: '#ecfeff' },
    teal: { color: '#0d9488', bg: '#f0fdfa' },
    gray: { color: '#4b5563', bg: '#f9fafb' },
};

export const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = ({ modeConfig = DASHBOARD_MODES[2] }) => {
    const navigate = useNavigate();
    const quickMenu = useQuickMenuActionSettings(modeConfig);
    const actions = quickMenu.actions;
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleActionClick = (path: string, openInNewTab?: boolean) => {
        if (openInNewTab) {
            window.open(path, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(path);
    };

    return (
        <WidgetContainer>
            <Header>
                <Title>
                    <FontAwesomeIcon icon={faBolt} />
                    {modeConfig.shortLabel} 빠른 실행
                </Title>
                <SettingsButton
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    disabled={quickMenu.loading}
                >
                    <FontAwesomeIcon icon={faCog} />
                    설정
                </SettingsButton>
            </Header>
            <Grid>
                {actions.length === 0 && (
                    <EmptyState>
                        등록된 빠른 실행 메뉴가 없습니다. 설정에서 메뉴를 선택하세요.
                    </EmptyState>
                )}
                {actions.map((action) => {
                    const theme = actionThemeMap[action.color] || actionThemeMap.slate;
                    return (
                        <ActionButton
                            key={action.key}
                            onClick={() => handleActionClick(action.path, action.openInNewTab)}
                            $color={theme.color}
                            $bg={theme.bg}
                        >
                            <IconWrapper
                                className="icon-wrapper"
                                $color={theme.color}
                                $bg={theme.bg}
                            >
                                <FontAwesomeIcon icon={action.icon} />
                            </IconWrapper>
                            <Label>{action.label}</Label>
                        </ActionButton>
                    );
                })}
            </Grid>
            <QuickMenuSettingsModal
                isOpen={isSettingsOpen}
                modeLabel={modeConfig.shortLabel}
                actions={quickMenu.availableActions}
                selectedKeys={quickMenu.selectedKeys}
                defaultSelectedKeys={quickMenu.defaultSelectedKeys}
                hasPersonalSelection={quickMenu.hasPersonalSelection}
                saving={quickMenu.saving}
                maxActions={quickMenu.maxActions}
                onClose={() => setIsSettingsOpen(false)}
                onSave={quickMenu.saveSelection}
                onReset={quickMenu.resetSelection}
            />
        </WidgetContainer>
    );
};
