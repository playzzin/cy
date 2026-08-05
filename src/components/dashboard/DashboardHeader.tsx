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
    padding: clamp(22px, 3vw, 32px) clamp(16px, 3vw, 40px) 96px; /* Extra padding bottom for overlap */
    position: relative;

    @media (max-width: 768px) {
        padding: 20px 16px 76px;
    }
`;

const ContentHelper = styled.div`
    width: 100%;
    max-width: none;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;

    @media (max-width: 768px) {
        flex-direction: column;
        gap: 18px;
    }
`;

const LogoSection = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;

    @media (max-width: 768px) {
        align-items: flex-start;
    }
`;

const BrandLogo = styled.img`
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 10px;
    object-fit: contain;
    background: rgba(255, 255, 255, 0.95);
    padding: 5px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
`;

const TextSection = styled.div``;
const Title = styled.h1`
    font-size: clamp(1.35rem, 2.4vw, 1.875rem);
    font-weight: 700;
    margin: 0 0 5px;
`;
const Subtitle = styled.p`
    color: #cbd5e1;
    font-size: 0.9rem;
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

    @media (max-width: 768px) {
        font-size: 0.92rem;
    }
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
    max-width: 100%;
    padding: 4px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;

    @media (max-width: 768px) {
        width: 100%;
        flex-wrap: nowrap;
        justify-content: flex-start;
        overflow-x: auto;
        border-radius: 14px;
        padding: 5px;
        -webkit-overflow-scrolling: touch;
    }
`;

const ModeButton = styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 38px;
    padding: 8px 12px;
    background: ${(props) => (props.$active ? 'rgba(255, 255, 255, 0.95)' : 'transparent')};
    border: 0;
    border-radius: 999px;
    color: ${(props) => (props.$active ? '#0f172a' : 'rgba(255, 255, 255, 0.8)')};
    font-size: 0.8rem;
    font-weight: 800;
    white-space: nowrap;
    transition: all 0.2s;

    @media (max-width: 768px) {
        flex: 0 0 auto;
        min-height: 42px;
        padding: 9px 13px;
    }

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
        width: 100%;
    }
`;

export const DashboardHeader = React.memo<DashboardHeaderProps>(({
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
                    <BrandLogo src="/icons/icon-192.png?v=20260524" alt="청연ENG ERP 로고" />
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
});
