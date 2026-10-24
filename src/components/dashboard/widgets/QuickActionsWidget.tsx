import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faCog } from '@fortawesome/free-solid-svg-icons';
import { DASHBOARD_MODES, DashboardModeConfig } from '../roleDashboardConfig';
import { QuickMenuSettingsModal } from '../QuickMenuSettingsModal';
import { useQuickMenuActionSettings } from '../useQuickMenuActions';
import { QuickActionTile } from './QuickActionTile';
import { useRouteAction } from '../../../hooks/useRouteAction';

const WidgetContainer = styled.section<{ $accent: string; $softBg: string }>`
    --quick-action-accent: ${(props) => props.$accent};
    --quick-action-soft-bg: ${(props) => props.$softBg};
    background: #ffffff;
    border-radius: 18px;
    padding: clamp(16px, 2vw, 24px);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07);
    border: 1px solid #e2e8f0;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
    gap: 12px;
    flex-wrap: wrap;
`;

const HeadingGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
`;

const HeadingIcon = styled.span`
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 12px;
    background: var(--quick-action-soft-bg);
    color: var(--quick-action-accent);
`;

const Title = styled.h2`
    margin: 0;
    font-size: clamp(1rem, 1.6vw, 1.1rem);
    font-weight: 700;
    color: #0f172a;
    line-height: 1.4;
`;

const Subtitle = styled.p`
    margin: 3px 0 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #64748b;
`;

const SettingsButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    flex-shrink: 0;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 800;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;

    &:hover {
        border-color: var(--quick-action-accent);
        background: var(--quick-action-soft-bg);
        color: var(--quick-action-accent);
    }

    &:focus-visible {
        outline: 2px solid var(--quick-action-accent);
        outline-offset: 3px;
    }

    &:disabled {
        cursor: not-allowed;
        opacity: 0.55;
    }
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: 12px;

    @media (max-width: 520px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
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
        <WidgetContainer
            aria-label={`${modeConfig.shortLabel} 빠른 실행`}
            $accent={modeConfig.accent}
            $softBg={modeConfig.softBg}
        >
            <Header>
                <HeadingGroup>
                    <HeadingIcon aria-hidden="true">
                        <FontAwesomeIcon icon={faBolt} />
                    </HeadingIcon>
                    <div>
                        <Title>{modeConfig.shortLabel} 빠른 실행</Title>
                        <Subtitle>자주 쓰는 업무를 한곳에서</Subtitle>
                    </div>
                </HeadingGroup>
                <SettingsButton
                    type="button"
                    aria-label="빠른 실행 메뉴 설정"
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
