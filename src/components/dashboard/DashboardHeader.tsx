import React from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { DashboardModeConfig } from './roleDashboardConfig';
import type { PositionItem } from '../../types/menu';
import { resolveIcon } from '../../constants/iconMap';
import { matchesMenuPosition } from '../../utils/menuPosition';

const DASHBOARD_LOGO_VIDEO_URL = 'https://firebasestorage.googleapis.com/v0/b/cyee-9c1e4.firebasestorage.app/o/logo_cy.mp4?alt=media&token=9ec66009-cecb-4c02-9b72-5d0f95e410af';
const DASHBOARD_LOGO_POSTER_URL = '/icons/icon-192.png?v=20260524';

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
    padding: clamp(22px, 3vw, 32px) clamp(16px, 3vw, 40px) 88px;
    position: relative;

    @media (max-width: 768px) {
        padding: 20px 16px 72px;
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
    gap: 16px;
    min-width: 0;
`;

const BrandLogo = styled.div`
    width: 88px;
    height: 88px;
    flex: 0 0 88px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 18px;
    background: #0f172a;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);

    video,
    img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
`;

const TextSection = styled.div`
    min-width: 0;
`;
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
    color: #cbd5e1;
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

export const DashboardHeader = React.memo<DashboardHeaderProps>(({
    user,
    modeConfig,
    positions,
    currentPosition,
    onPositionChange
}) => {
    const [logoVideoFailed, setLogoVideoFailed] = React.useState(false);
    const currentPositionName = positions.find((position) => position.id === currentPosition)?.name;
    const showPositionSwitcher = matchesMenuPosition(currentPosition, currentPositionName, 'dev');

    return (
        <HeaderContainer $gradient={modeConfig.gradient}>
            <ContentHelper>
                <LogoSection>
                    <BrandLogo role="img" aria-label="청연ENG ERP 로고">
                        {logoVideoFailed ? (
                            <img src={DASHBOARD_LOGO_POSTER_URL} alt="" />
                        ) : (
                            <video
                                src={DASHBOARD_LOGO_VIDEO_URL}
                                poster={DASHBOARD_LOGO_POSTER_URL}
                                autoPlay
                                loop
                                muted
                                playsInline
                                preload="metadata"
                                aria-hidden="true"
                                onError={() => setLogoVideoFailed(true)}
                            />
                        )}
                    </BrandLogo>
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

                    {showPositionSwitcher && (
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
                    )}
                </InfoSection>
            </ContentHelper>
        </HeaderContainer>
    );
});
