
import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots, faLink, faExternalLinkAlt, faInfoCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { kakaoService } from '../../../services/newKakaoService';

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
            const result = await kakaoService.getManagementUrl(type);

            if (result.success && result.url) {
                // 팝업으로 열기
                window.open(result.url, '_blank', 'width=1000,height=800');
                Swal.fire({
                    icon: 'success',
                    title: '관리 페이지 열기',
                    text: '새 창에서 관리 페이지가 열렸습니다.'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: '오류',
                    text: result.message || '관리 페이지 URL을 가져올 수 없습니다.'
                });
            }
        } catch (error) {
            console.error(error);

            const message = error instanceof Error ? error.message : '오류가 발생했습니다.';
            Swal.fire({
                icon: 'error',
                title: '연결 실패',
                text: message,
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

            {/* 친구톡 발송 테스트 섹션 - 별도 Grid 아래 Full Width */}
            <Section style={{ marginBottom: '24px' }}>
                <SectionHeader>
                    <SectionTitle>
                        <FontAwesomeIcon icon={faCommentDots} />
                        친구톡 발송 테스트
                    </SectionTitle>
                </SectionHeader>
                <SectionBody>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ marginBottom: '16px', color: '#4b5563', fontSize: '14px' }}>
                                <strong>친구톡</strong>은 템플릿 등록 없이 자유로운 메시지를 보낼 수 있습니다.<br />
                                단, 수신자가 <strong>해당 채널을 친구 추가</strong>한 상태여야만 발송됩니다.<br />
                                아래 테스트를 통해 채널 연결 상태를 확인해보세요.
                            </p>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>수신번호</label>
                                <input
                                    type="text"
                                    placeholder="010-0000-0000"
                                    id="testPhone"
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>테스트 메시지</label>
                                <textarea
                                    id="testMessage"
                                    rows={3}
                                    placeholder="친구톡 테스트 메시지입니다."
                                    defaultValue="[테스트] 친구톡 발송 테스트입니다."
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                                />
                            </div>

                            <ActionButton
                                onClick={async () => {
                                    const phoneEl = document.getElementById('testPhone');
                                    const messageEl = document.getElementById('testMessage');
                                    const phone = phoneEl instanceof HTMLInputElement ? phoneEl.value : '';
                                    const msg = messageEl instanceof HTMLTextAreaElement ? messageEl.value : '';

                                    if (!phone) {
                                        Swal.fire('입력 오류', '수신번호를 입력해주세요.', 'warning');
                                        return;
                                    }

                                    setLoading(true);
                                    try {
                                        const result = await kakaoService.sendFriendTalk({ to: phone, content: msg });

                                        if (result.success) {
                                            Swal.fire('성공', '친구톡이 발송되었습니다.\n(카카오톡 확인 필요)', 'success');
                                        } else {
                                            Swal.fire('실패', result.message || '발송 실패', 'error');
                                        }
                                    } catch (err: unknown) {
                                        console.error(err);
                                        const msg = err instanceof Error ? err.message : '발송 중 오류 발생';
                                        Swal.fire('오류', msg, 'error');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                style={{ background: '#fee500', color: '#3c1e1e' }}
                            >
                                <FontAwesomeIcon icon={faCommentDots} />
                                친구톡 테스트 발송
                            </ActionButton>
                        </div>

                        <div style={{ width: '250px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                            <strong>💡 체크포인트</strong>
                            <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>채널이 바로빌에 <strong>정상 연결</strong>되어 있나요?</li>
                                <li><strong>비즈니스 채널</strong>로 전환되었나요?</li>
                                <li>수신자가 채널을 <strong>친구 추가</strong> 했나요?</li>
                                <li>잔액이 부족하지 않은가요?</li>
                            </ul>
                        </div>
                    </div>
                </SectionBody>
            </Section>

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
