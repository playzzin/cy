
import React, { forwardRef, useEffect, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { Company } from '../../services/companyService';
import { Worker } from '../../services/manpowerService';
import { storageService } from '../../services/storageService';
import { format } from 'date-fns';

interface EmploymentCertificateTemplateProps {
    company: Company | null;
    worker: Worker | null;
    purpose: string;
    issueDate: Date;
    position: string;
    duties: string;
    joinDate: Date | null;
    endDate: Date | null;
    isServing: boolean;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Import Fonts globally for the print window or component
const FontStyles = createGlobalStyle`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
`;

const PrintContainer = styled.div`
  width: ${A4_WIDTH_MM}mm;
  min-height: ${A4_HEIGHT_MM}mm;
  background: white;
  padding: 25mm 20mm;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: 'Noto Sans KR', sans-serif;
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  color: #1a1a1a;
  
  // Inner border effect
  &::before {
    content: '';
    position: absolute;
    top: 8mm;
    left: 8mm;
    right: 8mm;
    bottom: 8mm;
    border: 0.5px solid #eee;
    pointer-events: none;
  }

  @media print {
    margin: 0;
    box-shadow: none;
    border: none;
    padding: 20mm 15mm; // Slightly adjusted for actual print margin safety
    
    &::before {
        display: none; // Often distracts in actual print, or keep if desired. Let's keep distinct paper feel.
    }
  }
`;

const MainTitle = styled.h1`
  font-family: 'Noto Serif KR', serif;
  font-size: 3.5rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 1.5rem;
  margin-top: 1.5rem;
  margin-bottom: 3.5rem;
  color: #1a1a1a;
  text-decoration: underline;
  text-underline-offset: 15px;
  text-decoration-thickness: 1px;
`;

const SectionHeader = styled.h2`
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.8rem;
  margin-top: 2.5rem;
  display: flex;
  align-items: center;
  color: #222;

  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 18px;
    background: #000;
    margin-right: 10px;
  }
`;

const DocTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 5px;
  border-top: 2px solid #000;
  border-bottom: 1px solid #000;
`;

const Th = styled.th`
  background: #f8f8f8;
  border: 1px solid #ccc;
  padding: 10px;
  font-weight: 500;
  font-size: 0.95rem;
  width: 18%; // Fixed label width
  vertical-align: middle;
  text-align: center;
  color: #555;
`;

const Td = styled.td`
  border: 1px solid #ccc;
  padding: 10px 15px;
  font-size: 0.95rem;
  vertical-align: middle;
  color: #111;
  text-align: left;
`;

const ProofText = styled.div`
    margin-top: 4rem;
    text-align: center;
    
    p {
        font-size: 1.3rem;
        font-weight: 500;
        letter-spacing: 0.05rem;
        color: #1f2937; // gray-800
    }
`;

// New Footer area
const StampArea = styled.div`
    margin-top: auto;
    padding-top: 3rem;
    text-align: center;
    position: relative;
    padding-bottom: 2rem;
`;

const IssueDateText = styled.div`
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  gap: 10px;
`;

const OfficialSeal = styled.div`
  position: absolute;
  top: 50%;
  right: 15%; // Adjust based on layout
  transform: translateY(-50%);
  width: 80px;
  height: 80px;
  // border: 3px solid rgba(220, 38, 38, 0.8); // Removed border for image
  // border-radius: 4px; // Square-ish for Korean seals usually, or keep circle depending on 'seal' style. Example used square radius 4px.
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(220, 38, 38, 0.9);
  font-weight: 900;
  font-size: 1.1rem;
  line-height: 1.2;
  text-align: center;
  // background-color: rgba(255, 255, 255, 0.5); // Transparent white mix
  pointer-events: none;
  font-family: 'Noto Serif KR', serif;
    
    img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0.8; // Match the seal look
}

@media print {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
`;

const CompanyInfoGrid = styled.div`
  border-top: 1px solid #333;
  padding-top: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 40px; // Row gap 10, Col gap 40
  font-size: 0.9rem;
  color: #555;
  line-height: 1.6;
`;

const InfoItem = styled.div`
  display: flex;
`;

const InfoLabel = styled.span`
  font-weight: 700;
  color: #222;
  min-width: 80px;
  display: inline-block;
`;

const InfoValue = styled.span`
  color: #4b5563;
`;

const FooterContainer = styled.div`
  margin-top: auto;
  padding-top: 3rem;
`;

const DateText = styled.div`
  text-align: center;
  font-size: 1.2rem;
  font-weight: 500;
  letter-spacing: 0.3rem;
  margin-bottom: 3rem;
  font-family: 'Noto Serif KR', serif;
`;

const SignatureArea = styled.div`
  position: relative;
  text-align: center;
  margin-bottom: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const CompanyNameObj = styled.div`
  font-family: 'Noto Serif KR', serif;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.2rem;
  margin-bottom: 1rem;
  color: #1a1a1a;
`;

const CeoText = styled.div`
  font-size: 1.4rem;
  font-weight: 700;
  color: #374151; // gray-700
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Noto Serif KR', serif;
`;

const WarningText = styled.p`
  margin-top: 1.5rem;
  font-size: 0.7rem;
  color: #9ca3af;
  text-align: center;
`;

export const EmploymentCertificateTemplate = forwardRef<HTMLDivElement, EmploymentCertificateTemplateProps>(
    ({ company, worker, purpose, issueDate, position, duties, joinDate, endDate, isServing }, ref) => {
        const [sealUrl, setSealUrl] = useState<string | null>(null);

        useEffect(() => {
            const fetchSeal = async () => {
                if (!company?.name) {
                    setSealUrl(null);
                    return;
                }

                let filename = '';
                if (company.name.includes('청연')) {
                    filename = '청연도장.jpg';
                } else if (company.name.includes('다원')) {
                    filename = '다원도장.png';
                }

                if (filename) {
                    try {
                        const url = await storageService.getDownloadUrl(filename);
                        setSealUrl(url);
                    } catch (e) {
                        console.error("Seal image not found:", filename);
                        setSealUrl(null);
                    }
                } else {
                    setSealUrl(null);
                }
            };
            fetchSeal();
        }, [company?.name]);

        // Formatting helpers
        const formatDate = (date?: Date | string | null, formatStr: string = 'yyyy년 MM월 dd일') => {
            if (!date) return '';
            try {
                return format(new Date(date), formatStr);
            } catch {
                return '';
            }
        };

        const formattedIssueDate = formatDate(issueDate);
        const formattedJoinDate = formatDate(joinDate);
        const formattedEndDate = isServing ? '현재' : formatDate(endDate);
        const todayStr = formatDate(new Date());

        // Mask ID number partially (standard practice: 123456-1******)
        const maskIdNumber = (idNum?: string) => {
            if (!idNum) return '';
            if (idNum.length >= 8) {
                return idNum.substring(0, 8) + '******';
            }
            return idNum;
        };

        // Seal Text Logic
        const getSealText = (compName?: string) => {
            if (!compName) return '회사\n인';
            // Simple truncation or logic to fit 4 chars 2 lines if possible, or just plain text
            const simpleName = compName.replace('(주)', '').replace('주식회사', '').trim();
            if (simpleName.length <= 4) return simpleName + '\n인';
            return simpleName.substring(0, 2) + '\n' + simpleName.substring(2, 4) + '인';
        };

        return (
            <>
                <FontStyles />
                <PrintContainer ref={ref}>
                    <MainTitle>재직증명서</MainTitle>

                    {/* 1. 인적사항 */}
                    <div style={{ position: 'relative', zIndex: 10 }}>
                        <SectionHeader>인적사항</SectionHeader>
                        <DocTable>
                            <tbody>
                                <tr>
                                    <Th>성 명</Th>
                                    <Td>{worker?.name || ''}</Td>
                                    <Th>생년월일</Th>
                                    <Td>{worker?.idNumber ? worker.idNumber.substring(0, 6) : ''}</Td>
                                </tr>
                                <tr>
                                    <Th>주 소</Th>
                                    <Td colSpan={3}>{worker?.address || ''}</Td>
                                </tr>
                            </tbody>
                        </DocTable>
                    </div>

                    {/* 2. 재직사항 */}
                    <div style={{ position: 'relative', zIndex: 10 }}>
                        <SectionHeader>재직사항</SectionHeader>
                        <DocTable>
                            <tbody>
                                <tr>
                                    <Th>소 속</Th>
                                    <Td>{worker?.companyName || company?.name || ''}</Td>
                                    <Th>직 위</Th>
                                    <Td>{position}</Td>
                                </tr>
                                <tr>
                                    <Th>재직기간</Th>
                                    <Td colSpan={3}>
                                        {formattedJoinDate ? `${formattedJoinDate} ~${formattedEndDate} ${isServing ? `(${todayStr} 기준)` : ''} ` : ''}
                                    </Td>
                                </tr>
                                <tr>
                                    <Th>담당업무</Th>
                                    <Td colSpan={3}>{duties}</Td>
                                </tr>
                            </tbody>
                        </DocTable>
                    </div>

                    {/* 3. 용도 */}
                    <div style={{ position: 'relative', zIndex: 10 }}>
                        <SectionHeader>용 도</SectionHeader>
                        <DocTable>
                            <tbody>
                                <tr>
                                    <Th>발행용도</Th>
                                    <Td>{purpose}</Td>
                                </tr>
                            </tbody>
                        </DocTable>
                    </div>

                    <ProofText>
                        <p>상기인은 위와 같이 당사에 재직 중임을 증명합니다.</p>
                    </ProofText>

                    <FooterContainer>
                        <DateText>{formattedIssueDate}</DateText>

                        <SignatureArea>
                            <CompanyNameObj>{company?.name || '(주) 건설사 명칭'}</CompanyNameObj>
                            <CeoText>대표이사 {company?.ceoName || 'OOO'} (인)</CeoText>

                            <OfficialSeal>
                                {sealUrl ? (
                                    <img src={sealUrl} alt="직인" />
                                ) : (
                                    getSealText(company?.name).split('\n').map((line, i) => (
                                        <div key={i}>{line}</div>
                                    ))
                                )}
                            </OfficialSeal>
                        </SignatureArea>

                        <CompanyInfoGrid>
                            <InfoItem>
                                <InfoLabel>주 소</InfoLabel>
                                <InfoValue>{company?.address || '-'}</InfoValue>
                            </InfoItem>
                            <InfoItem>
                                <InfoLabel>사업자번호</InfoLabel>
                                <InfoValue>{company?.businessNumber || '-'}</InfoValue>
                            </InfoItem>

                            <InfoItem>
                                <InfoLabel>대표전화</InfoLabel>
                                <InfoValue>{company?.phone || '-'}</InfoValue>
                            </InfoItem>

                            <InfoItem>
                                <InfoLabel>이메일</InfoLabel>
                                <InfoValue>{company?.email || '-'}</InfoValue>
                            </InfoItem>
                        </CompanyInfoGrid>

                        <WarningText>※ 본 증명서는 발행일로부터 3개월간 유효합니다. 위조 및 변조 시 법적 처벌을 받을 수 있습니다.</WarningText>
                    </FooterContainer>
                </PrintContainer>
            </>
        );
    }
);

EmploymentCertificateTemplate.displayName = 'EmploymentCertificateTemplate';
