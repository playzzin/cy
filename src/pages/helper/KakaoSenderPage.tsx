import React, { useState } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { AlimTalkSchema, FriendTalkSchema, kakaoService, AlimTalkRequest, FriendTalkRequest } from '../../services/newKakaoService';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faMobileAlt, faHistory, faCheckCircle, faExclamationCircle, faCommentDots } from '@fortawesome/free-solid-svg-icons';
// import { faKakao } from '@fortawesome/free-brands-svg-icons'; // Removed invalid import
import { z } from 'zod';

const zodResolver = (schema: z.ZodTypeAny) => async (values: any) => {
  const parsed = schema.safeParse(values);
  if (parsed.success) {
    return { values: parsed.data, errors: {} };
  }
  const errors: any = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path?.[0];
    if (key == null) continue;
    errors[String(key)] = { type: issue.code, message: issue.message };
  }
  return { values: {}, errors };
};

// --- Styled Components (Premium Design) ---

const Container = styled.div`
  display: flex;
  gap: 40px;
  padding: 40px;
  background: #f8f9fa;
  min-height: 100vh;
  justify-content: center;
  align-items: flex-start;
`;

const FormSection = styled.div`
  flex: 1;
  max-width: 600px;
  background: white;
  padding: 30px;
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05);
`;

const PreviewSection = styled.div`
  width: 320px;
  position: sticky;
  top: 40px;
`;

const Header = styled.div`
  margin-bottom: 30px;
  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    
    svg {
      color: #FEE500;
      background: #3c1e1e;
      border-radius: 6px;
      padding: 4px;
    }
  }
  p {
    color: #666;
    font-size: 14px;
  }
`;

const Tabs = styled.div`
  display: flex;
  background: #f1f3f5;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 30px;
`;

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 12px;
  border: none;
  background: ${props => props.active ? 'white' : 'transparent'};
  color: ${props => props.active ? '#1a1a1a' : '#868e96'};
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: ${props => props.active ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'};
  transition: all 0.2s;

  &:hover {
    color: #1a1a1a;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  
  label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #343a40;
    margin-bottom: 8px;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #FEE500;
    box-shadow: 0 0 0 3px rgba(254, 229, 0, 0.2);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 15px;
  min-height: 120px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #FEE500;
    box-shadow: 0 0 0 3px rgba(254, 229, 0, 0.2);
  }
`;

const SendButton = styled.button`
  width: 100%;
  padding: 16px;
  background: #FEE500;
  color: #191919;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;

  &:hover {
    background: #fdd835;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(254, 229, 0, 0.3);
  }

  &:disabled {
    background: #e9ecef;
    color: #adb5bd;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const MobileMock = styled.div`
  background: white;
  border-radius: 30px;
  padding: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
  border: 8px solid #333;
  width: 100%;
  height: 600px;
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 150px;
    height: 25px;
    background: #333;
    border-bottom-left-radius: 15px;
    border-bottom-right-radius: 15px;
    z-index: 10;
  }
`;

const Screen = styled.div`
  background: #bacee0; // Typical Kakao BG color
  height: 100%;
  border-radius: 20px;
  overflow-y: auto;
  padding: 20px 10px;
  padding-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const BubbleRaw = styled.div`
  background: white;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  white-space: pre-wrap;
  position: relative;
  max-width: 90%;
  align-self: flex-start;
  
  &::before {
    content: '';
    position: absolute;
    top: 10px;
    left: -6px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid white;
  }
`;

const SenderName = styled.div`
  font-size: 12px;
  color: #555;
  margin-bottom: 4px;
`;

// --- Demo Templates ---
const DEMO_TEMPLATES = [
  { code: 'TAX_INVOICE', name: '세금계산서 발행 알림', content: '[청연건설] 세금계산서가 발행되었습니다.\n\n승인번호: #{invoiceNum}\n발행일자: #{date}\n\n확인 부탁드립니다.' },
  { code: 'PAYMENT_REQ', name: '입금 요청', content: '[청연건설] 대금 입금을 요청드립니다.\n\n금액: #{amount}원\n입금기한: #{dueDate}\n계좌: 우리은행 1002-XXX-XXXX' }
];

const KakaoSenderPage = () => {
  const [tab, setTab] = useState<'ALIM' | 'FRIEND'>('ALIM');
  const [previewContent, setPreviewContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Forms
  const alimForm = useForm<AlimTalkRequest>({ resolver: zodResolver(AlimTalkSchema), defaultValues: { to: '', templateCode: '', content: '' } });
  const friendForm = useForm<FriendTalkRequest>({ resolver: zodResolver(FriendTalkSchema), defaultValues: { to: '', content: '' } });

  // Handlers
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const template = DEMO_TEMPLATES.find(t => t.code === code);
    if (template) {
      alimForm.setValue('templateCode', code);
      alimForm.setValue('content', template.content);
      setPreviewContent(template.content);
    }
  };

  const onSubmitAlim = async (data: AlimTalkRequest) => {
    setLoading(true);
    const res = await kakaoService.sendAlimTalk(data);
    setLoading(false);

    if (res.success) {
      Swal.fire('발송 성공', '알림톡이 성공적으로 발송되었습니다.', 'success');
    } else {
      Swal.fire('발송 실패', res.message, 'error');
    }
  };

  const onSubmitFriend = async (data: FriendTalkRequest) => {
    setLoading(true);
    const res = await kakaoService.sendFriendTalk(data);
    setLoading(false);

    if (res.success) {
      Swal.fire('발송 성공', '친구톡이 성공적으로 발송되었습니다.', 'success');
    } else {
      Swal.fire('발송 실패', res.message, 'error');
    }
  };

  return (
    <Container>
      {/* --- Form Section --- */}
      <FormSection>
        <Header>
          <h1><FontAwesomeIcon icon={faCommentDots} /> 카카오톡 발송 테스트</h1>
          <p>바로빌 연동 실시간 알림톡/친구톡 발송 시스템</p>
        </Header>

        <Tabs>
          <Tab active={tab === 'ALIM'} onClick={() => setTab('ALIM')}>알림톡 (템플릿)</Tab>
          <Tab active={tab === 'FRIEND'} onClick={() => setTab('FRIEND')}>친구톡 (자유메시지)</Tab>
        </Tabs>

        {tab === 'ALIM' ? (
          <form onSubmit={alimForm.handleSubmit(onSubmitAlim)}>
            <FormGroup>
              <label>수신번호</label>
              <Input {...alimForm.register('to')} placeholder="010-1234-5678" />
              {alimForm.formState.errors.to && <p style={{ color: 'red', fontSize: 12 }}>{alimForm.formState.errors.to.message}</p>}
            </FormGroup>

            <FormGroup>
              <label>템플릿 선택</label>
              <select
                onChange={handleTemplateChange}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', borderColor: '#dee2e6' }}
              >
                <option value="">템플릿을 선택하세요</option>
                {DEMO_TEMPLATES.map(t => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup>
              <label>메시지 내용</label>
              <TextArea
                {...alimForm.register('content')}
                onChange={(e) => {
                  alimForm.register('content').onChange(e);
                  setPreviewContent(e.target.value);
                }}
              />
              {alimForm.formState.errors.content && <p style={{ color: 'red', fontSize: 12 }}>{alimForm.formState.errors.content.message}</p>}
            </FormGroup>

            <SendButton type="submit" disabled={loading}>
              <FontAwesomeIcon icon={faPaperPlane} />
              {loading ? '발송 중...' : '알림톡 발송하기'}
            </SendButton>
          </form>
        ) : (
          <form onSubmit={friendForm.handleSubmit(onSubmitFriend)}>
            <FormGroup>
              <label>수신번호</label>
              <Input {...friendForm.register('to')} placeholder="010-1234-5678" />
            </FormGroup>

            <FormGroup>
              <label>메시지 내용 (친구톡)</label>
              <TextArea
                {...friendForm.register('content')}
                placeholder="자유롭게 메시지를 입력하세요. (광고성 내용 포함시 필수 표기 준수)"
                onChange={(e) => {
                  friendForm.register('content').onChange(e);
                  setPreviewContent(e.target.value);
                }}
              />
            </FormGroup>

            <SendButton type="submit" disabled={loading}>
              <FontAwesomeIcon icon={faPaperPlane} />
              {loading ? '발송 중...' : '친구톡 발송하기'}
            </SendButton>
          </form>
        )}
      </FormSection>

      {/* --- Preview Section --- */}
      <PreviewSection>
        <MobileMock>
          <Screen>
            <div style={{ textAlign: 'center', fontSize: 10, color: '#666', marginBottom: 10 }}>오늘</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 35, height: 35, background: '#fee500', borderRadius: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={faCommentDots} color="#3c1e1e" />
              </div>
              <div style={{ flex: 1 }}>
                <SenderName>청연건설 알림톡</SenderName>
                <BubbleRaw>
                  {previewContent || (
                    <span style={{ color: '#adb5bd' }}>
                      {tab === 'ALIM' ? '템플릿을 선택하거나 내용을 입력하세요.' : '친구톡 내용을 입력하세요.'}
                    </span>
                  )}
                </BubbleRaw>
              </div>
            </div>
          </Screen>
        </MobileMock>
      </PreviewSection>
    </Container>
  );
};

export default KakaoSenderPage;
