/**
 * 카카오톡 알림톡 테스트 페이지
 * 
 * SOLAPI를 통한 알림톡 발송 테스트
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Swal from 'sweetalert2';

const Container = styled.div`
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
`;

const Header = styled.div`
    margin-bottom: 32px;
`;

const Title = styled.h1`
    font-size: 28px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
    font-size: 14px;
    color: #666;
    margin: 0;
`;

const Section = styled.div`
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const SectionTitle = styled.h2`
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 16px 0;
`;

const FormRow = styled.div`
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 16px;
    align-items: center;
    margin-bottom: 16px;
`;

const Label = styled.label`
    font-size: 14px;
    font-weight: 500;
    color: #333;
`;

const Input = styled.input`
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    
    &:focus {
        outline: none;
        border-color: #4CAF50;
    }
`;

const Select = styled.select`
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    
    &:focus {
        outline: none;
        border-color: #4CAF50;
    }
`;

const Button = styled.button`
    padding: 12px 24px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
        background: #45a049;
    }
    
    &:disabled {
        background: #ccc;
        cursor: not-allowed;
    }
`;

const TemplatePreview = styled.div`
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 16px;
    margin-top: 16px;
    white-space: pre-wrap;
    font-family: monospace;
    font-size: 13px;
    line-height: 1.6;
`;

const InfoBox = styled.div`
    background: #e3f2fd;
    border-left: 4px solid #2196F3;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #1565C0;
`;

const WarningBox = styled.div`
    background: #fff3e0;
    border-left: 4px solid #FF9800;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #E65100;
`;

interface TemplateInfo {
    id: string;
    name: string;
    variables: string[];
    preview: string;
}

const TEMPLATES: Record<string, TemplateInfo> = {
    TAX_INVOICE_ISSUED: {
        id: 'TAX_INVOICE_ISSUED',
        name: '세금계산서 발행 알림',
        variables: ['companyName', 'invoiceDate', 'totalAmount', 'invoiceNum'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설에서 세금계산서가 발행되었습니다.

■ 발행일: #{invoiceDate}
■ 합계금액: #{totalAmount}원
■ 세금계산서번호: #{invoiceNum}

홈택스에서 확인 부탁드립니다.
문의: 02-XXX-XXXX`
    },
    PAYMENT_REQUEST: {
        id: 'PAYMENT_REQUEST',
        name: '입금 요청 알림',
        variables: ['companyName', 'balance', 'dueDate'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설입니다.
아래와 같이 미수금 입금을 요청드립니다.

■ 미수금액: #{balance}원
■ 입금요청일: #{dueDate}

입금 확인 후 연락 부탁드립니다.
문의: 02-XXX-XXXX`
    },
    PAYMENT_RECEIVED: {
        id: 'PAYMENT_RECEIVED',
        name: '입금 확인 알림',
        variables: ['companyName', 'paymentDate', 'paymentAmount', 'remainingBalance'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설입니다.
입금이 확인되었습니다. 감사합니다.

■ 입금일: #{paymentDate}
■ 입금금액: #{paymentAmount}원
■ 잔여잔액: #{remainingBalance}원

감사합니다.
문의: 02-XXX-XXXX`
    },
    MONTHLY_STATEMENT: {
        id: 'MONTHLY_STATEMENT',
        name: '월간 거래명세서',
        variables: ['companyName', 'yearMonth', 'totalSales', 'totalPayments', 'balance'],
        preview: `안녕하세요, #{companyName} 담당자님.

청연건설 #{yearMonth} 거래명세서입니다.

■ 매출합계: #{totalSales}원
■ 입금합계: #{totalPayments}원
■ 잔액: #{balance}원

자세한 내용은 첨부파일을 확인해주세요.
문의: 02-XXX-XXXX`
    }
};

export const KakaoTestPage: React.FC = () => {
    const [phone, setPhone] = useState('010-1234-5678');
    const [templateId, setTemplateId] = useState<string>('PAYMENT_REQUEST');
    const [variables, setVariables] = useState<Record<string, string>>({
        companyName: 'ABC건설',
        balance: '1,000,000',
        dueDate: '2024-01-15'
    });
    const [loading, setLoading] = useState(false);

    const currentTemplate = TEMPLATES[templateId];

    const handleTemplateChange = (newTemplateId: string) => {
        setTemplateId(newTemplateId);
        const template = TEMPLATES[newTemplateId];

        // 템플릿별 기본값 설정
        const defaultValues: Record<string, Record<string, string>> = {
            TAX_INVOICE_ISSUED: {
                companyName: 'ABC건설',
                invoiceDate: '2024-01-15',
                totalAmount: '11,000,000',
                invoiceNum: 'TX-2024-0001'
            },
            PAYMENT_REQUEST: {
                companyName: 'ABC건설',
                balance: '1,000,000',
                dueDate: '2024-01-15'
            },
            PAYMENT_RECEIVED: {
                companyName: 'ABC건설',
                paymentDate: '2024-01-14',
                paymentAmount: '500,000',
                remainingBalance: '500,000'
            },
            MONTHLY_STATEMENT: {
                companyName: 'ABC건설',
                yearMonth: '2024년 1월',
                totalSales: '10,000,000',
                totalPayments: '8,000,000',
                balance: '2,000,000'
            }
        };

        setVariables(defaultValues[newTemplateId] || {});
    };

    const handleVariableChange = (key: string, value: string) => {
        setVariables(prev => ({ ...prev, [key]: value }));
    };

    const renderPreview = () => {
        let preview = currentTemplate.preview;
        Object.entries(variables).forEach(([key, value]) => {
            preview = preview.replace(new RegExp(`#{${key}}`, 'g'), value);
        });
        return preview;
    };

    const handleSend = async () => {
        // 유효성 검사
        if (!phone) {
            Swal.fire('오류', '전화번호를 입력하세요', 'error');
            return;
        }

        const missingVars = currentTemplate.variables.filter(v => !variables[v]);
        if (missingVars.length > 0) {
            Swal.fire('오류', `다음 변수를 입력하세요: ${missingVars.join(', ')}`, 'error');
            return;
        }

        setLoading(true);

        try {
            const functions = getFunctions();
            const sendKakao = httpsCallable(functions, 'sendKakaoAlimtalk');

            const result = await sendKakao({
                to: phone,
                templateId: templateId,
                variables: variables
            });

            const data = result.data as any;

            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: '발송 성공!',
                    text: `메시지 ID: ${data.messageId}`,
                    confirmButtonColor: '#4CAF50'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: '발송 실패',
                    text: data.error || '알 수 없는 오류',
                    confirmButtonColor: '#f44336'
                });
            }
        } catch (error) {
            console.error('Kakao send error:', error);
            Swal.fire({
                icon: 'error',
                title: '오류 발생',
                text: error instanceof Error ? error.message : '네트워크 오류',
                confirmButtonColor: '#f44336'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <Header>
                <Title>📱 카카오톡 알림톡 테스트</Title>
                <Subtitle>SOLAPI를 통한 알림톡 발송 기능을 테스트합니다</Subtitle>
            </Header>

            <InfoBox>
                ⚠️ 실제 발송 전에 솔라피 가입 및 API 키 설정, 템플릿 등록이 필요합니다.
            </InfoBox>

            <WarningBox>
                💡 테스트 발송 시 실제 요금이 부과될 수 있습니다 (건당 6~8원)
            </WarningBox>

            <Section>
                <SectionTitle>1. 수신자 정보</SectionTitle>
                <FormRow>
                    <Label>전화번호</Label>
                    <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="010-1234-5678"
                    />
                </FormRow>
            </Section>

            <Section>
                <SectionTitle>2. 템플릿 선택</SectionTitle>
                <FormRow>
                    <Label>알림톡 템플릿</Label>
                    <Select
                        value={templateId}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                    >
                        {Object.values(TEMPLATES).map(template => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </Select>
                </FormRow>
            </Section>

            <Section>
                <SectionTitle>3. 템플릿 변수</SectionTitle>
                {currentTemplate.variables.map(varName => (
                    <FormRow key={varName}>
                        <Label>{varName}</Label>
                        <Input
                            type="text"
                            value={variables[varName] || ''}
                            onChange={(e) => handleVariableChange(varName, e.target.value)}
                            placeholder={`${varName} 입력`}
                        />
                    </FormRow>
                ))}
            </Section>

            <Section>
                <SectionTitle>4. 미리보기</SectionTitle>
                <TemplatePreview>{renderPreview()}</TemplatePreview>
            </Section>

            <Section>
                <Button onClick={handleSend} disabled={loading}>
                    {loading ? '발송 중...' : '📤 알림톡 발송'}
                </Button>
            </Section>
        </Container>
    );
};
