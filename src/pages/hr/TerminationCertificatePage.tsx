import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useReactToPrint } from 'react-to-print';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint } from '@fortawesome/free-solid-svg-icons';
import 'react-datepicker/dist/react-datepicker.css';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { TerminationCertificateTemplate } from '../../components/hr';

const PageContainer = styled.div`
  display: flex;
  height: calc(100vh - 64px);
  background-color: #f7f9fc;
`;

const Sidebar = styled.div`
  width: 400px;
  background: white;
  border-right: 1px solid #e2e8f0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
`;

const PreviewArea = styled.div`
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #525659;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;

  &:focus {
    color: #212121;
    border-color: #3b82f6;
    outline: none;
  }
`;

const Select = styled.select`
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  color: #1e293b;

  &:focus {
    border-color: #3b82f6;
    outline: none;
  }
`;

const Button = styled.button`
  background-color: #3b82f6;
  color: white;
  padding: 12px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: #2563eb;
  }

  &:disabled {
    background-color: #94a3b8;
    cursor: not-allowed;
  }
`;

const SectionHeader = styled.h2`
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
`;

const WorkerList = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  max-height: 220px;
  overflow-y: auto;
  margin-top: 5px;
  background: white;
`;

const WorkerItem = styled.div<{ $isActive: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  background-color: ${(props) => (props.$isActive ? '#eff6ff' : 'transparent')};
  color: ${(props) => (props.$isActive ? '#1d4ed8' : '#1e293b')};

  &:hover {
    background-color: #f1f5f9;
  }
`;

const HelperText = styled.p`
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
`;

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
    `
  });

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
        <div>
          <SectionHeader>해촉증명서 발급 설정</SectionHeader>
        </div>

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
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {worker.teamName || '소속팀 없음'}
                    </div>
                  </WorkerItem>
                ))}
              </WorkerList>
            ) : (
              <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                대상 근로자가 없습니다.
              </div>
            )}
            {selectedWorker && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '13px',
                  padding: '8px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '4px',
                  color: '#166534'
                }}
              >
                선택됨 <strong>{selectedWorker.name}</strong> ({selectedWorker.idNumber})
                <button
                  style={{ float: 'right', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  onClick={resetWorkerSelection}
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </FormGroup>

        <FormGroup>
          <Label>용역 기간</Label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <DatePicker
                selected={serviceStartDate}
                onChange={(date: Date | null) => setServiceStartDate(date)}
                dateFormat="yyyy-MM-dd"
                locale={ko}
                customInput={<Input placeholder="시작일 선택" />}
              />
            </div>
            <span>~</span>
            <div style={{ flex: 1 }}>
              <DatePicker
                selected={serviceEndDate}
                onChange={(date: Date | null) => setServiceEndDate(date)}
                dateFormat="yyyy-MM-dd"
                locale={ko}
                customInput={<Input placeholder="종료일 선택" />}
              />
            </div>
          </div>
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

        <div style={{ flex: 1 }} />

        <Button onClick={() => handlePrint()} disabled={!selectedWorker || !currentCompany}>
          <FontAwesomeIcon icon={faPrint} />
          해촉증명서 인쇄 / PDF 저장
        </Button>
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
