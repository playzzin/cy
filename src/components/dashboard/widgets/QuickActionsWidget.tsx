import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCog } from '@fortawesome/free-solid-svg-icons';
import { DASHBOARD_MODES, DashboardModeConfig } from '../roleDashboardConfig';
import { QuickMenuSettingsModal } from '../QuickMenuSettingsModal';
import { useQuickMenuActionSettings } from '../useQuickMenuActions';
import { QuickActionTile } from './QuickActionTile';
import { useRouteAction } from '../../../hooks/useRouteAction';

const WidgetContainer = styled.div`
    background: #ffffff;
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.06);
    border: 1px solid #e2e8f0;
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
    grid-template-columns: repeat(auto-fit, minmax(188px, 1fr));
    gap: 12px;

    @media (max-width: 520px) {
        grid-template-columns: 1fr;
    }
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

export const QuickActionsWidget = React.memo<QuickActionsWidgetProps>(({ modeConfig = DASHBOARD_MODES[2] }) => {
    const runRouteAction = useRouteAction();
    const quickMenu = useQuickMenuActionSettings(modeConfig);
    const actions = quickMenu.actions;
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleActionClick = React.useCallback((path: string, openInNewTab?: boolean) => {
        runRouteAction(path, { openInNewTab });
    }, [runRouteAction]);

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
                {actions.map((action) => (
                    <QuickActionTile
                        key={action.key}
                        action={action}
                        onActivate={handleActionClick}
                    />
                ))}
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
});
