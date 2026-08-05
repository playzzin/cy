import React from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { DashboardModeConfig } from './roleDashboardConfig';
import { useRouteAction } from '../../hooks/useRouteAction';

interface RoleFocusPanelProps {
    modeConfig: DashboardModeConfig;
}

const Panel = styled.section<{ $gradient: string }>`
    background: ${(props) => props.$gradient};
    border-radius: 16px;
    color: #ffffff;
    padding: clamp(18px, 2vw, 28px);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
    overflow: hidden;
`;

const TopRow = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;

    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

const ModeBadge = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 0.82rem;
    font-weight: 700;
    white-space: nowrap;
`;

const Title = styled.h2`
    font-size: clamp(1.35rem, 2vw, 2rem);
    line-height: 1.25;
    font-weight: 800;
    margin: 14px 0 8px;
    letter-spacing: 0;
`;

const Description = styled.p`
    color: rgba(255, 255, 255, 0.78);
    font-size: 0.95rem;
    line-height: 1.6;
    max-width: 720px;
    margin: 0;
`;

const ActionRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    min-width: 240px;

    @media (max-width: 768px) {
        justify-content: flex-start;
        min-width: 0;
        width: 100%;
        overflow-x: auto;
        padding-bottom: 2px;
    }
`;

const ActionButton = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    color: #0f172a;
    font-size: 0.86rem;
    font-weight: 800;
    min-height: 42px;
    padding: 10px 14px;
    transition: transform 0.18s ease, background 0.18s ease;

    &:hover {
        transform: translateY(-1px);
        background: #ffffff;
    }
`;

const FocusGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 22px;

    @media (max-width: 900px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 560px) {
        grid-template-columns: 1fr;
    }
`;

const FocusCard = styled.div`
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    padding: 16px;
    min-height: 118px;
`;

const FocusLabel = styled.div`
    color: rgba(255, 255, 255, 0.68);
    font-size: 0.78rem;
    font-weight: 800;
`;

const FocusValue = styled.div`
    font-size: 1.1rem;
    font-weight: 850;
    margin-top: 8px;
`;

const FocusDescription = styled.p`
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.82rem;
    line-height: 1.45;
    margin: 8px 0 0;
`;

export const RoleFocusPanel = React.memo<RoleFocusPanelProps>(({ modeConfig }) => {
    const runRouteAction = useRouteAction();
    const primaryActions = React.useMemo(() => modeConfig.quickActions.slice(0, 2), [modeConfig.quickActions]);

    return (
        <Panel $gradient={modeConfig.gradient}>
            <TopRow>
                <div>
                    <ModeBadge>
                        <FontAwesomeIcon icon={modeConfig.icon} />
                        {modeConfig.label} · {modeConfig.roleGroup}
                    </ModeBadge>
                    <Title>{modeConfig.heroTitle}</Title>
                    <Description>{modeConfig.heroDescription}</Description>
                </div>

                <ActionRow>
                    {primaryActions.map((action) => (
                        <ActionButton
                            key={action.path}
                            type="button"
                            onClick={() => runRouteAction(action.path)}
                        >
                            <FontAwesomeIcon icon={action.icon} />
                            {action.label}
                            <FontAwesomeIcon icon={faArrowRight} />
                        </ActionButton>
                    ))}
                </ActionRow>
            </TopRow>

            <FocusGrid>
                {modeConfig.focusItems.map((item) => (
                    <FocusCard key={item.label}>
                        <FocusLabel>{item.label}</FocusLabel>
                        <FocusValue>{item.value}</FocusValue>
                        <FocusDescription>{item.description}</FocusDescription>
                    </FocusCard>
                ))}
            </FocusGrid>
        </Panel>
    );
});
