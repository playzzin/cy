
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useReactToPrint } from 'react-to-print';
import { companyService, Company } from '../../services/companyService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { EmploymentCertificateTemplate } from '../../components/hr/EmploymentCertificateTemplate';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faSearch } from '@fortawesome/free-solid-svg-icons';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const PageContainer = styled.div`
  display: flex;
  height: calc(100vh - 64px); // Adjust based on header height
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
  box-shadow: 2px 0 5px rgba(0,0,0,0.05);
`;

const PreviewArea = styled.div`
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #525659; // Darker background to make paper pop
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
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
`;

// Simple Workers Search List
const WorkerList = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 5px;
  background: white;
`;

const WorkerItem = styled.div<{ $isActive: boolean }>`
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  background-color: ${props => props.$isActive ? '#eff6ff' : 'transparent'};
  color: ${props => props.$isActive ? '#1d4ed8' : '#1e293b'};
  
  &:hover {
    background-color: #f1f5f9;
  }
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
                {/* ... (Header and Company Select) */}
                <div>
                    <SectionHeader>재직증명서 발급 설정</SectionHeader>
                </div>

                <FormGroup>
                    <Label>발급 회사 (시공사)</Label>
                    <Select
                        value={selectedCompanyId}
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Input
                                type="text"
                                placeholder="대상 근로자 이름 검색 (선택사항)"
                                value={searchWorkerName}
                                onChange={(e) => setSearchWorkerName(e.target.value)}
                                style={{ flex: 1 }}
                            />
                        </div>
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
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                            {worker.teamName || '소속 팀 없음'}
                                        </div>
                                    </WorkerItem>
                                ))}
                            </WorkerList>
                        )}
                        {/* ... (Empty state) */}
                        {filteredWorkers.length === 0 && (
                            <div style={{ padding: '12px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                                대상 근로자가 없습니다.
                            </div>
                        )}
                        {selectedWorker && (
                            <div style={{ marginTop: '8px', fontSize: '13px', padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', color: '#166534' }}>
                                선택됨: <strong>{selectedWorker.name}</strong> ({selectedWorker.idNumber})
                                <button
                                    style={{ float: 'right', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
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
                                </button>
                            </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
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
                    </div>
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

                <div style={{ flex: 1 }}></div>

                <Button onClick={handlePrintClick} disabled={!selectedWorker}>
                    <FontAwesomeIcon icon={faPrint} />
                    재직증명서 인쇄 / PDF 저장
                </Button>
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
