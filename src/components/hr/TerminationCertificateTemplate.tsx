import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { format } from 'date-fns';
import { Company } from '../../services/companyService';
import { Worker } from '../../services/manpowerService';
import { storageService } from '../../services/storageService';

interface TerminationCertificateTemplateProps {
  company: Company | null;
  worker: Worker | null;
  issueDate: Date;
  serviceStartDate: Date | null;
  serviceEndDate: Date | null;
  serviceDescription: string;
  purpose: string;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const FontStyles = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  @media print {
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
  }
`;

const PrintContainer = styled.div`
  width: ${A4_WIDTH_MM}mm;
  min-height: ${A4_HEIGHT_MM}mm;
  background: white;
  padding: 20mm 16mm;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: 'Noto Sans KR', sans-serif;
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  color: #1a1a1a;

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
    width: 190mm;
    min-height: 277mm;
    box-shadow: none;
    border: none;
    padding: 12mm 10mm;
    overflow: hidden;

    &::before {
      display: none;
    }
  }
`;

const MainTitle = styled.h1`
  font-family: 'Noto Serif KR', serif;
  font-size: 3rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 1rem;
  margin-top: 0.5rem;
  margin-bottom: 2.25rem;
  color: #1a1a1a;
  text-decoration: underline;
  text-underline-offset: 11px;
  text-decoration-thickness: 1px;

  @media print {
    font-size: 2.35rem;
    letter-spacing: 0.7rem;
    margin-top: 0;
    margin-bottom: 1.5rem;
    text-underline-offset: 8px;
  }
`;

const SectionHeader = styled.h2`
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.8rem;
  margin-top: 1.6rem;
  display: flex;
  align-items: center;
  color: #222;

  @media print {
    font-size: 1rem;
    margin-top: 1.1rem;
    margin-bottom: 0.5rem;
  }

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

  @media print {
    margin-bottom: 2px;
  }
`;

const Th = styled.th`
  background: #f8f8f8;
  border: 1px solid #ccc;
  padding: 10px;
  font-weight: 500;
  font-size: 0.95rem;
  width: 18%;
  vertical-align: middle;
  text-align: center;
  color: #555;

  @media print {
    padding: 7px 6px;
    font-size: 0.82rem;
  }
`;

const Td = styled.td`
  border: 1px solid #ccc;
  padding: 10px 15px;
  font-size: 0.95rem;
  vertical-align: middle;
  color: #111;
  text-align: left;

  @media print {
    padding: 7px 10px;
    font-size: 0.82rem;
  }
`;

const ProofText = styled.div`
  margin-top: 2.5rem;
  text-align: center;

  p {
    font-size: 1.15rem;
    font-weight: 500;
    letter-spacing: 0.05rem;
    color: #1f2937;
  }

  @media print {
    margin-top: 1.4rem;

    p {
      font-size: 1rem;
    }
  }
`;

const OfficialSeal = styled.div`
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(220, 38, 38, 0.9);
  font-weight: 900;
  font-size: 1.1rem;
  line-height: 1.2;
  text-align: center;
  pointer-events: none;
  font-family: 'Noto Serif KR', serif;
  margin-left: 12px;

  @media print {
    width: 64px;
    height: 64px;
    font-size: 0.95rem;
    margin-left: 10px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    opacity: 0.8;
  }

  @media print {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
`;

const CompanyInfoGrid = styled.div`
  border-top: 1px solid #333;
  padding-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 28px;
  font-size: 0.9rem;
  color: #555;
  line-height: 1.6;

  @media print {
    padding-top: 0.8rem;
    gap: 6px 18px;
    font-size: 0.78rem;
    line-height: 1.35;
  }
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
  padding-top: 1.8rem;

  @media print {
    padding-top: 1rem;
  }
`;

const DateText = styled.div`
  text-align: center;
  font-size: 1.2rem;
  font-weight: 500;
  letter-spacing: 0.3rem;
  margin-bottom: 1.8rem;
  font-family: 'Noto Serif KR', serif;

  @media print {
    font-size: 1rem;
    margin-bottom: 1.1rem;
    letter-spacing: 0.18rem;
  }
`;

const SignatureArea = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  @media print {
    margin-bottom: 1.2rem;
  }
`;

const CompanyNameObj = styled.div`
  font-family: 'Noto Serif KR', serif;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.2rem;
  margin-bottom: 1rem;
  color: #1a1a1a;

  @media print {
    font-size: 1.7rem;
    margin-bottom: 0.65rem;
  }
`;

const CeoText = styled.div`
  font-size: 1.4rem;
  font-weight: 700;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Noto Serif KR', serif;

  @media print {
    font-size: 1.08rem;
  }
`;

const WarningText = styled.p`
  margin-top: 1rem;
  font-size: 0.7rem;
  color: #9ca3af;
  text-align: center;

  @media print {
    margin-top: 0.7rem;
    font-size: 0.62rem;
  }
`;

const formatDate = (date?: Date | string | null, formatStr = 'yyyy년 MM월 dd일') => {
  if (!date) return '';
  try {
    return format(new Date(date), formatStr);
  } catch {
    return '';
  }
};

const getOfficialSealCandidates = (companyName?: string | null) => {
  const name = String(companyName || '');
  if (name.includes('청연')) return ['청연도장.jpg'];
  if (name.includes('다원')) return ['다원도장.png'];
  return [];
};

const getSealText = (companyName?: string | null) => {
  if (!companyName) return '회사\n인';
  const simpleName = String(companyName).replace(/\(주\)|주식회사/g, '').trim();
  if (simpleName.length <= 4) return `${simpleName}\n인`;
  return `${simpleName.substring(0, 2)}\n${simpleName.substring(2, 4)}인`;
};

const formatWorkerName = (worker?: Worker | null) => String(worker?.name || '').replace(/\d+/g, '').trim();

const getCompanyDisplayName = (company?: Company | null) => company?.name || '주식회사 청연이엔지';

export const TerminationCertificateTemplate = forwardRef<HTMLDivElement, TerminationCertificateTemplateProps>(
  ({ company, worker, issueDate, serviceStartDate, serviceEndDate, serviceDescription, purpose }, ref) => {
    const [sealUrl, setSealUrl] = useState<string | null>(null);

    useEffect(() => {
      const fetchSeal = async () => {
        const candidates = getOfficialSealCandidates(company?.name);
        if (candidates.length === 0) {
          setSealUrl(null);
          return;
        }

        for (const fileName of candidates) {
          try {
            const url = await storageService.getDownloadUrl(fileName);
            setSealUrl(url);
            return;
          } catch {
            continue;
          }
        }

        setSealUrl(null);
      };

      void fetchSeal();
    }, [company?.name]);

    const workerDisplayName = formatWorkerName(worker);
    const formattedIssueDate = formatDate(issueDate);
    const servicePeriod = useMemo(() => {
      const start = formatDate(serviceStartDate);
      const end = formatDate(serviceEndDate);
      if (start && end) return `${start} ~ ${end}`;
      if (start) return start;
      if (end) return end;
      return '';
    }, [serviceEndDate, serviceStartDate]);

    return (
      <>
        <FontStyles />
        <div ref={ref}>
          <PrintContainer>
            <MainTitle>해촉증명서</MainTitle>

            <div style={{ position: 'relative', zIndex: 10 }}>
              <SectionHeader>인적사항</SectionHeader>
              <DocTable>
                <tbody>
                  <tr>
                    <Th>성명</Th>
                    <Td>{workerDisplayName}</Td>
                    <Th>주민등록번호</Th>
                    <Td>{worker?.idNumber || ''}</Td>
                  </tr>
                  <tr>
                    <Th>주소</Th>
                    <Td colSpan={3}>{worker?.address || ''}</Td>
                  </tr>
                </tbody>
              </DocTable>
            </div>

            <div style={{ position: 'relative', zIndex: 10 }}>
              <SectionHeader>해촉사항</SectionHeader>
              <DocTable>
                <tbody>
                  <tr>
                    <Th>소 속</Th>
                    <Td>{company?.name || worker?.companyName || ''}</Td>
                    <Th>구 분</Th>
                    <Td>해촉</Td>
                  </tr>
                  <tr>
                    <Th>해촉기간</Th>
                    <Td colSpan={3}>{servicePeriod}</Td>
                  </tr>
                  <tr>
                    <Th>업무내용</Th>
                    <Td colSpan={3}>{serviceDescription}</Td>
                  </tr>
                </tbody>
              </DocTable>
            </div>

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
              <p>상기인은 위 기재 내용과 같이 당사와의 계약이 종료되었음을 증명합니다.</p>
            </ProofText>

            <FooterContainer>
              <DateText>{formattedIssueDate}</DateText>

              <SignatureArea>
                <CompanyNameObj>{getCompanyDisplayName(company)}</CompanyNameObj>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CeoText>대표이사 {company?.ceoName || 'OOO'} (인)</CeoText>
                  <OfficialSeal>
                    {sealUrl ? (
                      <img src={sealUrl} alt="직인" />
                    ) : (
                      getSealText(company?.name).split('\n').map((line, index) => (
                        <div key={index}>{line}</div>
                      ))
                    )}
                  </OfficialSeal>
                </div>
              </SignatureArea>

              <CompanyInfoGrid>
                <InfoItem>
                  <InfoLabel>주소</InfoLabel>
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

              <WarningText>본 증명서는 발행일로부터 3개월간 유효합니다. 위조 및 변조 시 법적 처벌을 받을 수 있습니다.</WarningText>
            </FooterContainer>
          </PrintContainer>
        </div>
      </>
    );
  }
);

TerminationCertificateTemplate.displayName = 'TerminationCertificateTemplate';
