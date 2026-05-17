import React from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AppInstallButton } from './AppInstallButton';
import { DashboardModeConfig } from './roleDashboardConfig';
import type { PositionItem } from '../../types/menu';
import { resolveIcon } from '../../constants/iconMap';

interface DashboardHeaderProps {
    user: any;
    modeConfig: DashboardModeConfig;
    positions: PositionItem[];
    currentPosition: string;
    onPositionChange: (positionId: string) => void;
}

const HeaderContainer = styled.div<{ $gradient: string }>`
    background: ${(props) => props.$gradient};
    color: white;
    padding: 32px 32px 96px 32px; /* Extra padding bottom for overlap */
    position: relative;
`;

const ContentHelper = styled.div`
    max-width: 80rem; /* max-w-7xl */
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;

    @media (max-width: 768px) {
        flex-direction: column;
    }
`;

const LogoSection = styled.div`
    display: flex;
    align-items: center;

    @media (max-width: 768px) {
        align-items: flex-start;
    }
`;

const TextSection = styled.div``;
const Title = styled.h1`
    font-size: 1.875rem;
    font-weight: 700;
    margin-bottom: 8px;
`;
const Subtitle = styled.p`
    color: #cbd5e1;
`;

const InfoSection = styled.div`
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 16px;

    @media (max-width: 768px) {
        width: 100%;
        text-align: left;
        align-items: flex-start;
    }
`;

const DateText = styled.p`
    font-size: 1.125rem;
    font-weight: 500;
`;

const WelcomeText = styled.p`
    color: #94a3b8;
    font-size: 0.875rem;
`;

const ModeSwitcher = styled.div`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
`;

const ModeButton = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
    padding: 7px 11px;
    background: ${(props) => (props.$active ? 'rgba(255, 255, 255, 0.95)' : 'transparent')};
    border: 0;
    border-radius: 999px;
    color: ${(props) => (props.$active ? '#0f172a' : 'rgba(255, 255, 255, 0.8)')};
    font-size: 0.8rem;
    font-weight: 800;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover {
        background: ${(props) => (props.$active ? '#ffffff' : 'rgba(255, 255, 255, 0.16)')};
        color: ${(props) => (props.$active ? '#0f172a' : '#ffffff')};
    }
`;

const ActionGroup = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;

    @media (max-width: 768px) {
        justify-content: flex-start;
    }
`;

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user,
    modeConfig,
    positions,
    currentPosition,
    onPositionChange
}) => {
    return (
        <HeaderContainer $gradient={modeConfig.gradient}>
            <ContentHelper>
                <LogoSection>
                    <TextSection>
                        <Title>청연ENG ERP</Title>
                        <Subtitle>{modeConfig.label} · {modeConfig.roleGroup}</Subtitle>
                    </TextSection>
                </LogoSection>

                <InfoSection>
                    <div>
                        <DateText>
                            {new Date().toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'long'
                            })}
                        </DateText>
                        <WelcomeText>
                            환영합니다, {user?.name || '관리자'}님 ({user?.role || '최고관리자'})
                        </WelcomeText>
                    </div>

                    <ActionGroup>
                        <AppInstallButton />
                        <ModeSwitcher aria-label="대시보드 직책 모드">
                            {positions.length > 0 ? (
                                positions.map((position) => (
                                    <ModeButton
                                        key={position.id}
                                        type="button"
                                        $active={currentPosition === position.id}
                                        onClick={() => onPositionChange(position.id)}
                                    >
                                        <FontAwesomeIcon icon={resolveIcon(position.icon, modeConfig.icon)} />
                                        {position.name}
                                    </ModeButton>
                                ))
                            ) : (
                                <ModeButton type="button" $active>
                                    <FontAwesomeIcon icon={modeConfig.icon} />
                                    {modeConfig.shortLabel}
                                </ModeButton>
                            )}
                        </ModeSwitcher>
                    </ActionGroup>
                </InfoSection>
            </ContentHelper>
        </HeaderContainer>
    );
};
