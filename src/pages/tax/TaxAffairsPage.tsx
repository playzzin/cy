import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { format, startOfMonth } from 'date-fns';
import { fetchNtsTaxInvoicesRange } from '../../services/taxInvoiceApiService';
import { TransactionFilterBar } from './components/TransactionFilterBar';
import { TransactionSummaryCards } from './components/TransactionSummaryCards';
import { TransactionTable, TaxAffairsRecord } from './components/TransactionTable';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faSave } from '@fortawesome/free-solid-svg-icons';
import { taxLedgerService } from '../../services/taxLedgerService';

// Styled Components
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

const Title = styled.h1`
    font-size: 28px;
    font-weight: 800;
    color: #1e293b;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
`;

const Subtitle = styled.p`
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
`;

// Helpers
const asString = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const asNumber = (v: unknown): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const toIsoDate = (yyyymmdd: string): string => {
    const digits = yyyymmdd.replace(/\D/g, '');
    if (!/^\d{8}$/.test(digits)) return '';
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};
const toYyyyMmDdDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 8);

const TaxAffairsPage: React.FC = () => {
    const navigate = useNavigate();
    // State
    // Default: This Month (1st to Today)
    const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [transactionType, setTransactionType] = useState<'전체' | '매출' | '매입'>('전체');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [records, setRecords] = useState<TaxAffairsRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Filter Logic
    const filteredRecords = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return records.filter(r => {
            if (transactionType !== '전체' && r.type !== transactionType) return false;

            if (query) {
                return (
                    r.partnerName.toLowerCase().includes(query) ||
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
                acc.purchase.supply += curr.supplyAmount;
                // Purchase amounts are stored negative in current logic? 
                // Let's check `mapToRecords`. 
                // Currently `mapToRecords` applies `sign`. 
                // If we want to display positive numbers in summary cards for "amount spent", we might want absolute values, 
                // BUT usually in accounting summary:
                // Sales = Positive, Purchase = Negative (or Positive Cost).
                // Let's look at `TransactionSummaryCards` labels: "총 매입가액". 
                // Usually users want to see "How much I bought" as a positive number.
                // However, `mapToRecords` makes them negative.
                // Let's accumulate RAW values (absolute) for the cards if they are negative.
                // Actually, let's keep the sign logic consistent with the grid.
                // If the grid shows negative for purchase, summary showing negative is mathematically correct, but visually awkward for "Total Purchase Amount".
                // I will use `Math.abs` for the purchase summary to display "Magnitude" of purchase.
                acc.purchase.supply += Math.abs(curr.supplyAmount);
                acc.purchase.tax += Math.abs(curr.taxAmount);
                acc.purchase.total += Math.abs(curr.totalAmount);
            }
            return acc;
        }, initial);
    }, [filteredRecords]);

    // Data Fetching
    const fetchData = async () => {
        const startDigits = toYyyyMmDdDigits(startDate);
        const endDigits = toYyyyMmDdDigits(endDate);

        if (startDigits.length !== 8 || endDigits.length !== 8) {
            Swal.fire('오류', '날짜 형식이 올바르지 않습니다.', 'error');
            return;
        }

        setLoading(true);
        setRecords([]);

        const typesToFetch: ('매출' | '매입')[] = transactionType === '전체' ? ['매출', '매입'] : [transactionType];

        try {
            const promises = typesToFetch.map(async (type) => {
                const res = await fetchNtsTaxInvoicesRange(startDigits, endDigits, type);
                return mapToRecords(res.data, type);
            });

            const results = await Promise.all(promises);
            const combined = results.flat().sort((a, b) => {
                // Sort by Date DESC, then ID
                return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
            });

            setRecords(combined);

            // Optional: Toast for success
            const count = combined.length;
            if (count > 0) {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.addEventListener('mouseenter', Swal.stopTimer)
                        toast.addEventListener('mouseleave', Swal.resumeTimer)
                    }
                });
                Toast.fire({
                    icon: 'success',
                    title: `총 ${count}건의 내역을 조회했습니다.`
                });
            } else {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true,
                });
                Toast.fire({
                    icon: 'info',
                    title: `조회된 내역이 없습니다.`
                });
            }

        } catch (error: any) {
            console.error(error);
            Swal.fire('조회 실패', error.message || '데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Helper: Map API response to Frontend model
    const mapToRecords = (rows: Array<Record<string, unknown>>, type: '매출' | '매입'): TaxAffairsRecord[] => {
        const sign = type === '매입' ? -1 : 1;

        return rows.map((row) => {
            const baseDate =
                asString(row.__baseDate) ||
                asString(row.WriteDate) ||
                asString(row.IssueDT) ||
                asString(row.NTSSendDT);

            const taxInvoiceKey = asString(row.TaxInvoiceKey);
            const invoicerCorpName = asString(row.InvoicerCorpName);
            const invoiceeCorpName = asString(row.InvoiceeCorpName);

            // Note: NTS API field names usually PascalCase
            const supplyAmount = asNumber(row.AmountTotal) || asNumber(row.SupplyCostTotal);
            const taxAmount = asNumber(row.TaxTotal);
            let totalAmount = asNumber(row.TotalAmount);
            if (!totalAmount) totalAmount = supplyAmount + taxAmount;

            return {
                id: `nts-${taxInvoiceKey || Math.random().toString(36).slice(2)}`,
                date: toIsoDate(baseDate),
                type,
                partnerName: type === '매입' ? invoicerCorpName : invoiceeCorpName,
                description: asString(row.ItemName) || asString(row.Remark1) || '품목내용 없음',

                // Keep sign for table display logic (Red for negative/purchase)
                supplyAmount: sign * supplyAmount,
                taxAmount: sign * taxAmount,
                totalAmount: sign * totalAmount,

                invoiceNum: asString(row.InvoiceNum) || undefined,

                // Initialize new fields with smart mapping
                // Remark1 -> Site Name (Common usage)
                // Remark2 -> Team Name
                // Remark3 -> Memo
                siteName: asString(row.Remark1) || '',
                teamName: asString(row.Remark2) || '',
                memo: asString(row.Remark3) || ''
            };
        });
    };

    useEffect(() => {
        // Auto-fetch on mount for better UX
        fetchData();
    }, []);

    const handleViewLedger = () => {
        navigate('/payroll/taxinvoice/ledger');
    };

    const handleSaveToLedger = async () => {
        if (selectedIds.length === 0) {
            Swal.fire('알림', '저장할 내역을 선택해주세요.', 'warning');
            return;
        }

        const selectedRecords = records.filter(r => selectedIds.includes(r.id));

        try {
            setLoading(true);
            await taxLedgerService.saveRecords(selectedRecords);
            setLoading(false);

            const result = await Swal.fire({
                title: '저장 완료',
                text: `${selectedRecords.length}건의 내역을 장부에 저장했습니다. 장부로 이동하시겠습니까?`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: '장부로 이동',
                cancelButtonText: '계속 조회'
            });

            if (result.isConfirmed) {
                navigate('/payroll/taxinvoice/ledger');
            }
            // Clear selection after save? Maybe keep it for reference.
            setSelectedIds([]);
        } catch (error) {
            console.error(error);
            setLoading(false);
            Swal.fire('저장 실패', '장부 저장 중 오류가 발생했습니다.', 'error');
        }
    };

    return (
        <PageContainer>
            <PageHeader>
                <div className="flex justify-between items-end">
                    <div>
                        <Title>전자세금계산서 조회</Title>
                        <Subtitle>국세청(홈택스)에 신고된 매입/매출 세금계산서 내역을 조회합니다.</Subtitle>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveToLedger}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-sm flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faSave} />
                            장부로 저장 ({selectedIds.length})
                        </button>
                        <button
                            onClick={handleViewLedger}
                            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faBook} className="text-slate-500" />
                            장부 보기
                        </button>
                    </div>
                </div>
            </PageHeader>

            {/* Expanded Summary: Sales vs Purchase */}
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
                onRefresh={fetchData}
                loading={loading}
            />

            {/* Replaced Grid with Standard Table */}
            <TransactionTable
                records={filteredRecords}
                loading={loading}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
            />
        </PageContainer>
    );
};

export default TaxAffairsPage;
