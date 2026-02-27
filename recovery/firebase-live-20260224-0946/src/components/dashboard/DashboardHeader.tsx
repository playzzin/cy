import React from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons';

interface DashboardHeaderProps {
    user: any;
    logoUrl: string;
    logoIsVideo: boolean;
    viewMode: 'executive' | 'field';
    onToggleView: () => void;
}

const HeaderContainer = styled.div`
    background: linear-gradient(to right, #0f172a, #1e293b);
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
`;

const LogoSection = styled.div`
    display: flex;
    align-items: center;
    gap: 24px;
`;

const LogoWrapper = styled.div`
    width: 128px;
    height: 128px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
`;

const Video = styled.video`
    width: 100%;
    height: 100%;
    object-fit: cover;
`;

const Image = styled.img`
    width: 100%;
    height: 100%;
    object-fit: contain;
`;

const Placeholder = styled.div`
    width: 100%;
    height: 100%;
    background-color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    
    span {
        color: white;
        font-weight: 700;
        font-size: 1.875rem;
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
`;

const DateText = styled.p`
    font-size: 1.125rem;
    font-weight: 500;
`;

const WelcomeText = styled.p`
    color: #94a3b8;
    font-size: 0.875rem;
`;

const ToggleButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 9999px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;

    &:hover {
        background: rgba(255, 255, 255, 0.2);
    }
`;

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    user,
    logoUrl,
    logoIsVideo,
    viewMode,
    onToggleView
}) => {
    return (
        <HeaderContainer>
            <ContentHelper>
                <LogoSection>
                    <LogoWrapper>
                        {logoUrl ? (
                            logoIsVideo ? (
                                <Video autoPlay loop muted playsInline>
                                    <source src={logoUrl} type="video/mp4" />
                                </Video>
                            ) : (
                                <Image src={logoUrl} alt="Company Logo" />
                            )
                        ) : (
                            <Placeholder>
                                <span>청연</span>
                            </Placeholder>
                        )}
                    </LogoWrapper>
                    <TextSection>
                        <Title>청연ENG ERP</Title>
                        <Subtitle>Smart Construction Management System</Subtitle>
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

                    <ToggleButton onClick={onToggleView}>
                        <FontAwesomeIcon icon={faExchangeAlt} />
                        {viewMode === 'executive' ? '현장 소장 모드로 전환' : '관리자 모드로 전환'}
                    </ToggleButton>
                </InfoSection>
            </ContentHelper>
        </HeaderContainer>
    );
};
