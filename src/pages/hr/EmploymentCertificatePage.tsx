
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useReactToPrint } from 'react-to-print';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { EmploymentCertificateTemplate } from '../../components/hr/EmploymentCertificateTemplate';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faPrint } from '@fortawesome/free-solid-svg-icons';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const PageContainer = styled.div`
  display: flex;
  height: calc(100vh - 64px); // Adjust based on header height
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
  background-color: #525659; // Darker background to make paper pop
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

// Simple Workers Search List
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
  background-color: ${props => props.$isActive ? 'rgba(37, 99, 235, 0.25)' : 'transparent'};
  color: ${props => props.$isActive ? '#ffffff' : '#cbd5e1'};
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.06);
  }
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

const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: #cbd5e1;
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

const EmploymentCertificatePage: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [searchWorkerName, setSearchWorkerName] = useState('');
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

    // Certificate Data
    const [purpose, setPurpose] = useState('금융기관 제출용');
    const [issueDate, setIssueDate] = useState<Date>(new Date());
    const [position, setPosition] = useState('');
    const [duties, setDuties] = useState('');
    const [joinDate, setJoinDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [isServing, setIsServing] = useState(true);

    const componentRef = useRef<HTMLDivElement>(null);

    const sanitizeCertificateName = (name?: string | null) => String(name || '').replace(/\d+/g, '').trim();

    const isTargetIssuerCompany = (company: Company): boolean => {
        const name = String(company.name || '');
        const isConstruction = company.type === '시공사';
        return isConstruction && (name.includes('다원') || name.includes('청연'));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [companiesData, workersData] = await Promise.all([
                    companyService.getCompanies(),
                    manpowerService.getWorkers()
                ]);
                const dawon = companiesData.find(c => c.type === '시공사' && c.name.includes('다원'));
                const cheongyeon = companiesData.find(c => c.type === '시공사' && c.name.includes('청연'));
                const issuerCompanies = [dawon, cheongyeon].filter((c): c is Company => Boolean(c?.id));
                const safeIssuerCompanies = issuerCompanies.length > 0
                    ? issuerCompanies
                    : companiesData.filter(isTargetIssuerCompany);
                setCompanies(safeIssuerCompanies);
                setWorkers(workersData);

                // Auto-select 'Cheongyeon' if available
                const defaultCompany = safeIssuerCompanies.find(c => c.name.includes('청연') || c.code === 'CY')
                    || safeIssuerCompanies[0];
                if (defaultCompany && defaultCompany.id) {
                    setSelectedCompanyId(defaultCompany.id);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

        const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `재직증명서_${sanitizeCertificateName(selectedWorker?.name) || '미지정'}_${format(issueDate, 'yyyyMMdd')}`,
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
                                const title = `재직증명서_${sanitizeCertificateName(selectedWorker?.name) || '미지정'}_${format(issueDate, 'yyyyMMdd')}`;
                                fallbackPrintFromElement(componentRef.current, title);
                        }
                }
    });

        const handlePrintClick = async () => {
                if (!componentRef.current) return;

                try {
                        await handlePrint();
                } catch {
                        const title = `재직증명서_${sanitizeCertificateName(selectedWorker?.name) || '미지정'}_${format(issueDate, 'yyyyMMdd')}`;
                        fallbackPrintFromElement(componentRef.current, title);
                }
        };

    // 대상 근로자는 시공사(다원, 청연 등) 소속인 경우 모두 노출
    const filteredWorkers = workers.filter(w => {
        const companyName = String(w.companyName || '');
        const teamName = String(w.teamName || '');
        
        // 발급 대상 회사(companies 리스트) 중 하나에 속하는지 확인
        const isTargetWorker = companies.some(c => {
            const cleanName = c.name.replace('(주)', '').trim();
            return (c.id && w.companyId === c.id) || 
                   (c.name && companyName.includes(cleanName)) ||
                   (c.name && teamName.includes(cleanName));
        });

        if (!isTargetWorker) return false;
        if (searchWorkerName.trim() && !w.name.includes(searchWorkerName)) return false;
        return true;
    });

    const currentCompany = companies.find(c => c.id === selectedCompanyId) || null;

    return (
        <PageContainer>
            <Sidebar>
                <HeaderCard>
                    <HeaderContent>
                        <HeaderIcon>
                            <FontAwesomeIcon icon={faFileAlt} />
                        </HeaderIcon>
                        <div>
                            <HeaderTitle>재직증명서</HeaderTitle>
                            <HeaderSubtitle>Employment Certificate</HeaderSubtitle>
                        </div>
                    </HeaderContent>
                </HeaderCard>

                <SettingsCard>
                    <SectionHeader>발급 설정</SectionHeader>

                    <FormGroup>
                        <Label>발급 회사 (시공사)</Label>
                        <Select
                            value={selectedCompanyId}
                            disabled={loading}
                            onChange={(e) => {
                                setSelectedCompanyId(e.target.value);
                                setSelectedWorker(null);
                                setSearchWorkerName('');
                                setPosition('');
                                setDuties('');
                                setJoinDate(null);
                                setEndDate(null);
                                setIsServing(true);
                            }}
                        >
                            <option value="">시공사를 선택하세요</option>
                            {companies.map(company => (
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
                                placeholder="대상 근로자 이름 검색 (선택사항)"
                                value={searchWorkerName}
                                onChange={(e) => setSearchWorkerName(e.target.value)}
                            />
                            {filteredWorkers.length > 0 && (
                                <WorkerList>
                                    {filteredWorkers.map(worker => (
                                        <WorkerItem
                                            key={worker.id}
                                            $isActive={selectedWorker?.id === worker.id}
                                            onClick={() => {
                                                setSelectedWorker(worker);
                                                setSearchWorkerName(worker.name);
                                                // Auto-fill position and duties (Requested: Position empty, Duties: '현장직')
                                                setPosition('');
                                                setDuties('현장직');

                                                // Auto-fill dates
                                                const createdAt = worker.createdAt?.toDate ? worker.createdAt.toDate() : (worker.createdAt as any);
                                                setJoinDate(createdAt || new Date());
                                                setIsServing(true);
                                                setEndDate(null);
                                            }}
                                        >
                                            {worker.name} ({worker.idNumber || '주민번호 미등록'})
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                {worker.teamName || '소속 팀 없음'}
                                            </div>
                                        </WorkerItem>
                                    ))}
                                </WorkerList>
                            )}
                            {filteredWorkers.length === 0 && (
                                <EmptyState>대상 근로자가 없습니다.</EmptyState>
                            )}
                            {selectedWorker && (
                                <SelectedWorkerNotice>
                                    선택됨: <strong>{selectedWorker.name}</strong> ({selectedWorker.idNumber})
                                    <ClearSelectionButton
                                        onClick={() => {
                                            setSelectedWorker(null);
                                            setSearchWorkerName('');
                                            setPosition('');
                                            setDuties('');
                                            setJoinDate(null);
                                            setEndDate(null);
                                            setIsServing(true);
                                        }}
                                    >
                                        취소
                                    </ClearSelectionButton>
                                </SelectedWorkerNotice>
                            )}
                        </div>
                    </FormGroup>

                    <FormGroup>
                        <Label>직위 (Rank)</Label>
                        <Input
                            type="text"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            placeholder="예: 일용근로자, 팀장, 기공"
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>담당업무 (Duties)</Label>
                        <Input
                            type="text"
                            value={duties}
                            onChange={(e) => setDuties(e.target.value)}
                            placeholder="예: 건설 관련 업무, 조적 시공"
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>재직 기간 (입사일 ~ 종료일)</Label>
                        <DateRangeRow>
                            <DateField>
                                <DatePicker
                                    selected={joinDate}
                                    onChange={(date: Date | null) => setJoinDate(date)}
                                    dateFormat="yyyy-MM-dd"
                                    locale={ko}
                                    customInput={<Input placeholder="입사일 선택" />}
                                />
                            </DateField>
                            <RangeDivider>~</RangeDivider>
                            <DateField>
                                <DatePicker
                                    selected={isServing ? null : endDate}
                                    onChange={(date: Date | null) => {
                                        setEndDate(date);
                                        if (date) setIsServing(false);
                                    }}
                                    dateFormat="yyyy-MM-dd"
                                    locale={ko}
                                    customInput={<Input placeholder={isServing ? "현재 재직중" : "퇴사일 선택"} disabled={isServing} />}
                                    disabled={isServing}
                                />
                            </DateField>
                        </DateRangeRow>
                        <CheckboxRow>
                            <input
                                type="checkbox"
                                id="isServingCheck"
                                checked={isServing}
                                onChange={(e) => {
                                    setIsServing(e.target.checked);
                                    if (e.target.checked) setEndDate(null);
                                }}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <label htmlFor="isServingCheck" style={{ fontSize: '14px', cursor: 'pointer' }}>현재 재직중</label>
                        </CheckboxRow>
                    </FormGroup>

                    <FormGroup>
                        <Label>발급 용도</Label>
                        <Input
                            type="text"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="예: 금융기관 제출용, 관공서 제출용"
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>발급 일자</Label>
                        <DatePicker
                            selected={issueDate}
                            onChange={(date: Date | null) => setIssueDate(date || new Date())}
                            dateFormat="yyyy-MM-dd"
                            locale={ko}
                            customInput={<Input />}
                        />
                    </FormGroup>

                    <Button onClick={handlePrintClick} disabled={!selectedWorker || loading}>
                        <FontAwesomeIcon icon={faPrint} />
                        재직증명서 인쇄 / PDF 저장
                    </Button>
                </SettingsCard>
            </Sidebar>

            <PreviewArea>
                <div style={{ boxShadow: '0 0 20px rgba(0,0,0,0.3)' }}>
                    <EmploymentCertificateTemplate
                        ref={componentRef}
                        company={currentCompany}
                        worker={selectedWorker}
                        purpose={purpose}
                        issueDate={issueDate}
                        position={position}
                        duties={duties}
                        joinDate={joinDate}
                        endDate={endDate}
                        isServing={isServing}
                    />
                </div>
            </PreviewArea>
        </PageContainer>
    );
};

export default EmploymentCertificatePage;
