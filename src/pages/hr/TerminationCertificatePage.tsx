import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useReactToPrint } from 'react-to-print';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faPrint } from '@fortawesome/free-solid-svg-icons';
import 'react-datepicker/dist/react-datepicker.css';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { TerminationCertificateTemplate } from '../../components/hr';

const PageContainer = styled.div`
  display: flex;
  height: calc(100vh - 64px);
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 52%, #0f172a 100%);
  padding: 24px;
  gap: 24px;
  overflow: hidden;

  @media (max-width: 1024px) {
    height: auto;
    min-height: calc(100vh - 64px);
    flex-direction: column;
    padding: 16px;
  }
`;

const Sidebar = styled.div`
  width: 420px;
  flex: 0 0 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;

  @media (max-width: 1024px) {
    width: 100%;
    flex: 0 0 auto;
  }
`;

const PreviewArea = styled.div`
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #525659;
  border-radius: 16px;
  min-width: 0;
`;

const HeaderCard = styled.div`
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.2), rgba(147, 51, 234, 0.2));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(16px);
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #9333ea);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.25);
`;

const HeaderTitle = styled.h1`
  margin: 0;
  color: white;
  font-size: 20px;
  font-weight: 800;
`;

const HeaderSubtitle = styled.p`
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 13px;
`;

const SettingsCard = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  background: rgba(30, 41, 59, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(16px);
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #cbd5e1;
  font-size: 14px;
`;

const Input = styled.input`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 12px;
  font-size: 14px;
  background: rgba(51, 65, 85, 0.55);
  color: #ffffff;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder {
    color: #64748b;
  }

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    outline: none;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 12px;
  font-size: 14px;
  background: rgba(51, 65, 85, 0.55);
  color: #ffffff;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    outline: none;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  option {
    color: #0f172a;
    background: #ffffff;
  }
`;

const Button = styled.button`
  background-color: #3b82f6;
  color: white;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s, transform 0.2s;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.25);

  &:hover {
    background-color: #2563eb;
    transform: translateY(-1px);
  }

  &:disabled {
    background-color: #475569;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SectionHeader = styled.h2`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 2px 0;

  &::before {
    content: '';
    width: 6px;
    height: 24px;
    border-radius: 999px;
    background: #3b82f6;
    display: inline-block;
  }
`;

const WorkerList = styled.div`
  border: 1px solid rgba(71, 85, 105, 0.55);
  border-radius: 12px;
  max-height: 220px;
  overflow-y: auto;
  margin-top: 5px;
  background: rgba(15, 23, 42, 0.28);
`;

const WorkerItem = styled.div<{ $isActive: boolean }>`
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  background-color: ${(props) => (props.$isActive ? 'rgba(37, 99, 235, 0.25)' : 'transparent')};
  color: ${(props) => (props.$isActive ? '#ffffff' : '#cbd5e1')};

  &:hover {
    background-color: rgba(255, 255, 255, 0.06);
  }
`;

const HelperText = styled.p`
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
`;

const DateRangeRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  width: 100%;
`;

const DateField = styled.div`
  min-width: 0;

  .react-datepicker-wrapper,
  .react-datepicker__input-container {
    display: block;
    width: 100%;
  }
`;

const RangeDivider = styled.span`
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 600;
`;

const EmptyState = styled.div`
  padding: 12px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
`;

const SelectedWorkerNotice = styled.div`
  margin-top: 8px;
  font-size: 13px;
  padding: 10px 12px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.32);
  border-radius: 12px;
  color: #bbf7d0;
`;

const ClearSelectionButton = styled.button`
  float: right;
  background: none;
  border: none;
  color: #fca5a5;
  cursor: pointer;
`;

const fallbackPrintFromElement = (element: HTMLElement, title: string) => {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
  if (!popup) {
    window.alert('팝업이 차단되어 PDF 저장 창을 열 수 없습니다. 브라우저 팝업 차단을 해제해 주세요.');
    return;
  }

  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  popup.document.open();
  popup.document.write(`
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        ${styleNodes}
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();

  window.setTimeout(() => {
    popup.print();
  }, 250);
};

const sanitizeCertificateName = (name?: string | null) => String(name || '').replace(/\d+/g, '').trim();

const isTargetIssuerCompany = (company: Company): boolean => {
  const name = String(company.name || '');
  const isConstruction = company.type === '시공사';
  return isConstruction && (name.includes('다원') || name.includes('청연'));
};

const TerminationCertificatePage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [searchWorkerName, setSearchWorkerName] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const [issueDate, setIssueDate] = useState<Date>(new Date());
  const [serviceStartDate, setServiceStartDate] = useState<Date | null>(null);
  const [serviceEndDate, setServiceEndDate] = useState<Date | null>(new Date());
  const [serviceDescription, setServiceDescription] = useState('건설현장 시스템비계 및 해체');
  const [purpose, setPurpose] = useState('퇴직용');

  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [companiesData, workersData] = await Promise.all([
          companyService.getCompanies(),
          manpowerService.getWorkers()
        ]);
        const dawon = companiesData.find((c) => c.type === '시공사' && c.name.includes('다원'));
        const cheongyeon = companiesData.find((c) => c.type === '시공사' && c.name.includes('청연'));
        const issuerCompanies = [dawon, cheongyeon].filter((c): c is Company => Boolean(c?.id));
        const safeIssuerCompanies = issuerCompanies.length > 0 ? issuerCompanies : companiesData.filter(isTargetIssuerCompany);

        setCompanies(safeIssuerCompanies);
        setWorkers(workersData);

        const defaultCompany =
          safeIssuerCompanies.find((c) => c.name.includes('청연') || c.code === 'CY') || safeIssuerCompanies[0];
        if (defaultCompany?.id) {
          setSelectedCompanyId(defaultCompany.id);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `해촉증명서_${sanitizeCertificateName(selectedWorker?.name) || '미지정'}_${format(issueDate, 'yyyyMMdd')}`,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `,
    onPrintError: () => {
      if (componentRef.current) {
        const title = `해촉증명서_${sanitizeCertificateName(selectedWorker?.name) || '미지정'}_${format(issueDate, 'yyyyMMdd')}`;
        fallbackPrintFromElement(componentRef.current, title);
      }
    }
  });

  const handlePrintClick = async () => {
    if (!componentRef.current) return;

    try {
      await handlePrint();
    } catch {
      const title = `해촉증명서_${sanitizeCertificateName(selectedWorker?.name) || '미지정'}_${format(issueDate, 'yyyyMMdd')}`;
      fallbackPrintFromElement(componentRef.current, title);
    }
  };

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const companyName = String(worker.companyName || '');
      const teamName = String(worker.teamName || '');

      const isTargetWorker = companies.some((company) => {
        const cleanName = company.name.replace('(주)', '').trim();
        return (company.id && worker.companyId === company.id) ||
          (company.name && companyName.includes(cleanName)) ||
          (company.name && teamName.includes(cleanName));
      });

      if (!isTargetWorker) return false;
      if (searchWorkerName.trim() && !worker.name.includes(searchWorkerName.trim())) return false;
      return true;
    });
  }, [companies, searchWorkerName, workers]);

  const currentCompany = companies.find((company) => company.id === selectedCompanyId) || null;

  const resetWorkerSelection = () => {
    setSelectedWorker(null);
    setSearchWorkerName('');
    setServiceStartDate(null);
    setServiceEndDate(new Date());
  };

  return (
    <PageContainer>
      <Sidebar>
        <HeaderCard>
          <HeaderContent>
            <HeaderIcon>
              <FontAwesomeIcon icon={faFileAlt} />
            </HeaderIcon>
            <div>
              <HeaderTitle>해촉증명서</HeaderTitle>
              <HeaderSubtitle>Termination Certificate</HeaderSubtitle>
            </div>
          </HeaderContent>
        </HeaderCard>

        <SettingsCard>
          <SectionHeader>발급 설정</SectionHeader>

          <FormGroup>
            <Label>발급 회사</Label>
            <Select
              value={selectedCompanyId}
              onChange={(event) => {
                setSelectedCompanyId(event.target.value);
                resetWorkerSelection();
              }}
              disabled={loading}
            >
              <option value="">시공사를 선택하세요</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>대상 근로자 선택</Label>
            <div style={{ position: 'relative' }}>
              <Input
                type="text"
                placeholder="대상 근로자 이름 검색"
                value={searchWorkerName}
                onChange={(event) => setSearchWorkerName(event.target.value)}
              />
              {filteredWorkers.length > 0 ? (
                <WorkerList>
                  {filteredWorkers.map((worker) => (
                    <WorkerItem
                      key={worker.id}
                      $isActive={selectedWorker?.id === worker.id}
                      onClick={() => {
                        const createdAt = worker.createdAt?.toDate ? worker.createdAt.toDate() : (worker.createdAt as Date | undefined);
                        setSelectedWorker(worker);
                        setSearchWorkerName(worker.name);
                        setServiceStartDate(createdAt || new Date());
                        setServiceEndDate(new Date());
                      }}
                    >
                      {worker.name} ({worker.idNumber || '주민번호 미등록'})
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {worker.teamName || '소속팀 없음'}
                      </div>
                    </WorkerItem>
                  ))}
                </WorkerList>
              ) : (
                <EmptyState>대상 근로자가 없습니다.</EmptyState>
              )}
              {selectedWorker && (
                <SelectedWorkerNotice>
                  선택됨 <strong>{selectedWorker.name}</strong> ({selectedWorker.idNumber})
                  <ClearSelectionButton onClick={resetWorkerSelection}>
                    취소
                  </ClearSelectionButton>
                </SelectedWorkerNotice>
              )}
            </div>
          </FormGroup>

          <FormGroup>
            <Label>용역 기간</Label>
            <DateRangeRow>
              <DateField>
                <DatePicker
                  selected={serviceStartDate}
                  onChange={(date: Date | null) => setServiceStartDate(date)}
                  dateFormat="yyyy-MM-dd"
                  locale={ko}
                  customInput={<Input placeholder="시작일 선택" />}
                />
              </DateField>
              <RangeDivider>~</RangeDivider>
              <DateField>
                <DatePicker
                  selected={serviceEndDate}
                  onChange={(date: Date | null) => setServiceEndDate(date)}
                  dateFormat="yyyy-MM-dd"
                  locale={ko}
                  customInput={<Input placeholder="종료일 선택" />}
                />
              </DateField>
            </DateRangeRow>
          </FormGroup>

          <FormGroup>
            <Label>용역 내용</Label>
            <Input
              type="text"
              value={serviceDescription}
              onChange={(event) => setServiceDescription(event.target.value)}
              placeholder="예: 건설현장 시스템비계 및 해체"
            />
          </FormGroup>

          <FormGroup>
            <Label>용도</Label>
            <Input
              type="text"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="예: 퇴직용"
            />
          </FormGroup>

          <FormGroup>
            <Label>발급일자</Label>
            <DatePicker
              selected={issueDate}
              onChange={(date: Date | null) => setIssueDate(date || new Date())}
              dateFormat="yyyy-MM-dd"
              locale={ko}
              customInput={<Input />}
            />
          </FormGroup>

          <HelperText>
            재직증명서와 동일한 방식으로 미리보기, 인쇄, PDF 저장이 가능합니다.
          </HelperText>

          <Button onClick={handlePrintClick} disabled={!selectedWorker || !currentCompany}>
            <FontAwesomeIcon icon={faPrint} />
            해촉증명서 인쇄 / PDF 저장
          </Button>
        </SettingsCard>
      </Sidebar>

      <PreviewArea>
        <div style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)' }}>
          <TerminationCertificateTemplate
            ref={componentRef}
            company={currentCompany}
            worker={selectedWorker}
            issueDate={issueDate}
            serviceStartDate={serviceStartDate}
            serviceEndDate={serviceEndDate}
            serviceDescription={serviceDescription}
            purpose={purpose}
          />
        </div>
      </PreviewArea>
    </PageContainer>
  );
};

export default TerminationCertificatePage;
