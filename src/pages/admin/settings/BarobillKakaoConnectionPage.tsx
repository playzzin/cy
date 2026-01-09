
import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faLink, faExternalLinkAlt, faInfoCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase';
import Swal from 'sweetalert2';

const Card = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
`;

const CardHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CardBody = styled.div`
  padding: 20px;
`;

const CardFooter = styled.div`
  padding: 16px 20px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  
  background: ${props =>
        props.variant === 'primary' ? '#3b82f6' :
            props.variant === 'danger' ? '#ef4444' :
                '#e5e7eb'};
  
  color: ${props =>
        props.variant === 'primary' || props.variant === 'danger' ? 'white' :
            '#374151'};

  &:hover {
    filter: brightness(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;


const Container = styled.div`
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
`;

const Header = styled.div`
    margin-bottom: 24px;
`;

const Title = styled.h1`
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 8px;
`;

const Subtitle = styled.p`
    color: #6b7280;
    font-size: 14px;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
`;

const Section = styled.div`
    background: white;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
`;

const SectionHeader = styled.div`
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const SectionTitle = styled.h3`
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const SectionBody = styled.div`
    padding: 24px;
`;

const InfoBox = styled.div`
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    display: flex;
    gap: 12px;
    align-items: flex-start;

    svg {
        color: #2563eb;
        margin-top: 3px;
    }

    div {
        color: #1e40af;
        font-size: 14px;
        line-height: 1.5;
    }
`;

const WarningBox = styled(InfoBox)`
    background: #fffbeb;
    border-color: #fcd34d;
    
    svg {
        color: #d97706;
    }

    div {
        color: #92400e;
    }
`;

const ActionButton = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    background-color: #fee500;
    color: #3e2723;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;

    &:hover {
        background-color: #fdd835;
        transform: translateY(-1px);
    }
    
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }
`;

const ManualLink = styled.a`
    display: block;
    margin-top: 16px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    text-decoration: underline;
    cursor: pointer;

    &:hover {
        color: #374151;
    }
`;

const BarobillKakaoConnectionPage = () => {
    const [loading, setLoading] = useState(false);

    const handleOpenManagement = async (type: 'CHANNEL' | 'TEMPLATE') => {
        setLoading(true);
        try {
            const getKakaoManagementUrl = httpsCallable(functions, 'getKakaoManagementUrl');
            const result: any = await getKakaoManagementUrl({ type });

            if (result.data.success && result.data.url) {
                // 팝업으로 열기
                const width = 1000;
                const height = 800;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;

                window.open(
                    result.data.url,
                    'BarobillKakaoManagement',
                    `width=${width},height=${height},top=${top},left=${left}`
                );
            } else {
                throw new Error(result.data.error || 'URL을 가져오지 못했습니다.');
            }
        } catch (error: any) {
            console.error('Failed to get management URL:', error);

            // 에러 처리 (특히 바로빌 -10001 에러 등)
            let errorMessage = error.message;
            if (errorMessage.includes('Barobill Error Code')) {
                errorMessage = '바로빌 서비스 설정이 필요하거나 권한이 없습니다. 바로빌 사이트에서 직접 확인해주세요.';
            }

            Swal.fire({
                icon: 'error',
                title: '연결 실패',
                text: errorMessage,
                confirmButtonText: '확인'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <Header>
                <Title>카카오톡 연동 설정 (바로빌)</Title>
                <Subtitle>바로빌 서비스를 통해 카카오톡 채널과 알림톡 템플릿을 관리합니다.</Subtitle>
            </Header>

            <InfoBox>
                <FontAwesomeIcon icon={faInfoCircle} />
                <div>
                    <strong>바로빌 카카오톡 서비스</strong><br />
                    이 페이지에서 카카오톡 채널(플러스친구)을 연결하고, 알림톡 템플릿을 등록/관리할 수 있습니다.<br />
                    모든 설정은 바로빌 팝업 페이지에서 이루어지며, 설정 완료 후 승인된 템플릿 ID를 개발팀에게 전달해야 합니다.
                </div>
            </InfoBox>

            <Grid>
                {/* 채널 관리 섹션 */}
                <Section>
                    <SectionHeader>
                        <SectionTitle>
                            <FontAwesomeIcon icon={faCommentDots} />
                            카카오톡 채널 연결
                        </SectionTitle>
                    </SectionHeader>
                    <SectionBody>
                        <p style={{ marginBottom: '20px', color: '#4b5563', fontSize: '14px' }}>
                            보유하신 카카오톡 채널(플러스친구)을 바로빌 서비스에 연결합니다.<br />
                            채널이 연결되어야 알림톡 및 친구톡 발송이 가능합니다.
                        </p>
                        <ActionButton
                            onClick={() => handleOpenManagement('CHANNEL')}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faLink} />
                            채널 연결 관리하기
                        </ActionButton>
                    </SectionBody>
                </Section>

                {/* 템플릿 관리 섹션 */}
                <Section>
                    <SectionHeader>
                        <SectionTitle>
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                            알림톡 템플릿 관리
                        </SectionTitle>
                    </SectionHeader>
                    <SectionBody>
                        <p style={{ marginBottom: '20px', color: '#4b5563', fontSize: '14px' }}>
                            세금계산서 발행, 입금 요청 등 상황별 알림톡 템플릿을 등록하고 검수받습니다.<br />
                            검수가 완료된 템플릿만 발송 가능합니다.
                        </p>
                        <ActionButton
                            onClick={() => handleOpenManagement('TEMPLATE')}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                            템플릿 관리하기
                        </ActionButton>
                    </SectionBody>
                </Section>
            </Grid>

            <WarningBox>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <div>
                    <strong>연결에 실패하시나요?</strong><br />
                    "서비스 권한 없음(-10001)" 등의 에러가 발생하면, API를 통한 자동 접속이 제한된 상태일 수 있습니다.<br />
                    이 경우 아래 바로빌 사이트에 직접 접속하여 설정해주시기 바랍니다.
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                        <a href="http://test.barobill.co.kr" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 'bold' }}>바로빌 테스트 사이트</a>
                        <a href="https://www.barobill.co.kr" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', fontWeight: 'bold' }}>바로빌 운영 사이트</a>
                    </div>
                </div>
            </WarningBox>
        </Container>
    );
};

export default BarobillKakaoConnectionPage;
