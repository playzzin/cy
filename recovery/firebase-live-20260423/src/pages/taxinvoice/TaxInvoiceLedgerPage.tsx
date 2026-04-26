import React, { useMemo, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faArrowLeft, faDownload } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';

// Import shared components from Tax Affairs
// Import shared components from Tax Affairs
import { TransactionTable, TaxAffairsRecord } from '../tax/components/TransactionTable';
import { TransactionSummaryCards } from '../tax/components/TransactionSummaryCards';
import { TransactionFilterBar } from '../tax/components/TransactionFilterBar';
import { taxLedgerService } from '../../services/taxLedgerService';
import { receivableService } from '../../services/receivableService';
import { teamService, Team } from '../../services/teamService';
import { format, startOfMonth } from 'date-fns';

// Clean Styled Components (Consistent with TaxAffairsPage)
const PageContainer = styled.div`
    padding: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #f8f9fa;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
`;

const PageHeader = styled.div`
    margin-bottom: 24px;
`;

const HeaderContent = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
`;

const Title = styled.h1`
    font-size: 28px;
    font-weight: 800;
    color: #1e293b;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 12px;
`;

const Subtitle = styled.p`
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
`;

const BackButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: white;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    color: #475569;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 16px;

    &:hover {
        background-color: #f1f5f9;
        text-decoration: none;
    }
`;

const ActionButton = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: #059669; /* Emerald 600 */
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

    &:hover {
        background-color: #047857; /* Emerald 700 */
    }
`;

interface LedgerLocationState {
    records: TaxAffairsRecord[];
    startDate?: string;
    endDate?: string;
}

const TaxInvoiceLedgerPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as LedgerLocationState;

    // Default dates: Use state passed from TaxAffairs, or default to This Month
    const [startDate, setStartDate] = useState<string>(
        state?.startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd')
    );
    const [endDate, setEndDate] = useState<string>(
        state?.endDate || format(new Date(), 'yyyy-MM-dd')
    );

    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsLoading, setTeamsLoading] = useState<boolean>(false);

    const [records, setRecords] = useState<TaxAffairsRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [transactionType, setTransactionType] = useState<'전체' | '매출' | '매입'>('전체'); // For filter bar compatibility
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Fetch from Firestore
    const fetchLedgerData = async () => {
        try {
            setLoading(true);
            const data = await taxLedgerService.fetchRecords(startDate, endDate);
            setRecords(data);
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '장부 데이터를 불러오지 못했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        fetchLedgerData();
    }, [startDate, endDate]);

    // Fetch Construction Teams (시공팀/시공사팀)
    useEffect(() => {
        const fetchTeams = async () => {
            try {
                setTeamsLoading(true);
                const allTeams = await teamService.getTeams();
                console.log('All fetched teams:', allTeams);
                // Filter for '시공팀', '시공사팀', or teams belonging to '청연' (Cheongyeon) - Case insensitive
                const constructionTeams = allTeams.filter(t =>
                    t.type === '시공팀' ||
                    t.type === '시공사팀' ||
                    (t.companyName && (t.companyName.includes('청연') || t.companyName.toLowerCase().includes('cheongyeon')))
                );
                console.log('Filtered construction teams:', constructionTeams);
                setTeams(constructionTeams);
            } catch (error) {
                console.error('Failed to fetch teams:', error);
            } finally {
                setTeamsLoading(false);
            }
        };

        fetchTeams();
    }, []);

    // Local Filtering for "Type" and "Search"
    const filteredRecords = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return records.filter(r => {
            if (transactionType !== '전체' && r.type !== transactionType) return false;

            if (query) {
                return (
                    r.partnerName.toLowerCase().includes(query) ||
                    (r.siteName && r.siteName.toLowerCase().includes(query)) ||
                    (r.teamName && r.teamName.toLowerCase().includes(query)) ||
                    r.description.toLowerCase().includes(query) ||
                    (r.invoiceNum && r.invoiceNum.toLowerCase().includes(query))
                );
            }
            return true;
        });
    }, [records, transactionType, searchQuery]);


    // Calculate Summary Split by Type
    const summary = useMemo(() => {
        const initial = {
            sales: { supply: 0, tax: 0, total: 0 },
            purchase: { supply: 0, tax: 0, total: 0 }
        };

        return filteredRecords.reduce((acc, curr) => {
            if (curr.type === '매출') {
                acc.sales.supply += curr.supplyAmount;
                acc.sales.tax += curr.taxAmount;
                acc.sales.total += curr.totalAmount;
            } else if (curr.type === '매입') {
                acc.purchase.supply += Math.abs(curr.supplyAmount);
                acc.purchase.tax += Math.abs(curr.taxAmount);
                acc.purchase.total += Math.abs(curr.totalAmount);
            }
            return acc;
        }, initial);
    }, [filteredRecords]);

    const handleUpdateRecord = async (id: string, field: keyof TaxAffairsRecord, value: string) => {
        // Optimistic Update
        setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

        // Background Save
        try {
            await taxLedgerService.updateField(id, field as string, value);
        } catch (error) {
            console.error('Update failed:', error);
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            Toast.fire({ icon: 'error', title: '저장 실패' });
        }
    };

    const handleBack = () => {
        navigate('/payroll/tax-affairs');
    };

    const handleExcelDownload = () => {
        Swal.fire('알림', 'Excel 다운로드 기능 준비 중입니다.', 'info');
    };

    const handleRegisterReceivables = async () => {
        if (selectedIds.length === 0) {
            Swal.fire('알림', '선택된 항목이 없습니다.', 'warning');
            return;
        }

        const selectedRecords = records.filter(r => selectedIds.includes(r.id));
        const salesOnly = selectedRecords.filter(r => r.type === '매출');

        if (salesOnly.length !== selectedRecords.length) {
            Swal.fire('주의', '매출(Tax Invoice) 내역만 미수금으로 등록할 수 있습니다.', 'warning');
            return;
        }

        const confirm = await Swal.fire({
            title: '미수금 관리 등록',
            text: `선택한 ${salesOnly.length}건을 미수금 리스트로 전송하시겠습니까?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            confirmButtonText: '전송'
        });

        if (confirm.isConfirmed) {
            try {
                // Use static import
                await receivableService.registerReceivables(salesOnly);

                Swal.fire({
                    title: '완료',
                    text: '성공적으로 등록되었습니다.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });

                // Clear selection
                setSelectedIds([]);

                // Optional: ask to navigate
                // navigate('/payroll/taxinvoice/receivables');

            } catch (error: any) {
                console.error(error);
                Swal.fire('오류', `등록 중 문제가 발생했습니다: ${error.message || '알 수 없는 오류'}`, 'error');
            }
        }
    };

    const handleGoToReceivables = () => {
        navigate('/payroll/taxinvoice/receivables');
    };

    return (
        <PageContainer>
            <BackButton onClick={handleBack}>
                <FontAwesomeIcon icon={faArrowLeft} />
                세무 관리로 돌아가기
            </BackButton>

            <PageHeader>
                <HeaderContent>
                    <div>
                        <Title>
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-600" />
                            세금계산서 거래원장 (저장본)
                        </Title>
                        <Subtitle>
                            저장된 내역을 조회하고 미수금 관리 대장으로 전송할 수 있습니다.
                        </Subtitle>
                    </div>
                    <div className="flex gap-2">
                        <ActionButton onClick={handleGoToReceivables} style={{ backgroundColor: '#2563eb' }}>
                            미수금 관리 이동
                        </ActionButton>
                        <ActionButton onClick={handleExcelDownload}>
                            <FontAwesomeIcon icon={faDownload} />
                            Excel 다운로드
                        </ActionButton>
                    </div>
                </HeaderContent>
            </PageHeader>

            {/* Selection ActionBar */}
            {selectedIds.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                    <div className="text-emerald-800 text-sm font-bold flex items-center gap-2">
                        <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-xs">{selectedIds.length}건 선택됨</span>
                        매출 계산서를 미수금 관리 대장으로 등록합니다.
                    </div>
                    <button
                        onClick={handleRegisterReceivables}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-sm transition-colors"
                    >
                        미수금 등록 실행
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <TransactionSummaryCards
                sales={summary.sales}
                purchase={summary.purchase}
            />

            <TransactionFilterBar
                startDate={startDate}
                endDate={endDate}
                onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                type={transactionType}
                onTypeChange={setTransactionType}
                search={searchQuery}
                onSearchChange={setSearchQuery}
                onRefresh={fetchLedgerData}
                loading={loading}
            />

            {/* Main Table */}
            <TransactionTable
                records={filteredRecords}
                loading={loading}
                editable={true}
                onUpdate={handleUpdateRecord}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                teams={teams.length > 0 ? teams : undefined}
            />
        </PageContainer>
    );
};

export default TaxInvoiceLedgerPage;
