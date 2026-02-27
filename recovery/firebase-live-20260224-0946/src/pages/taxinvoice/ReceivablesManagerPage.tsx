import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileInvoiceDollar, faTimes, faHistory, faPencilAlt, faSyncAlt, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { format, startOfMonth } from 'date-fns';

import { receivableService, ReceivableLedger, ReceivablePayment } from '../../services/receivableService';
import { ReceivableSummaryCards } from '../tax/components/ReceivableSummaryCards';
import { ReceivableFilterBar } from '../tax/components/ReceivableFilterBar';
import { ReceivableTable } from '../tax/components/ReceivableTable';
import { BankMatchModal } from './modals/BankMatchModal';
import { ManualPaymentModal } from './modals/ManualPaymentModal';
import { ReceivableEditModal } from './modals/ReceivableEditModal';

// --- Styled Components (Matching TaxInvoiceLedgerPage) ---
const PageContainer = styled.div`
    padding: 0; /* DashboardLayout already has padding */
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #f8f9fa;
`;

const PageHeader = styled.div`
    margin-bottom: 24px;
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

const ContentArea = styled.div`
    flex: 1;
    display: flex;
    gap: 24px;
    overflow: hidden;
`;

const TableSection = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

// Integrated Detail Panel
const DetailPanel = styled.div<{ $isOpen: boolean }>`
    width: ${props => props.$isOpen ? '380px' : '0px'};
    background: white;
    border-radius: 16px;
    border: ${props => props.$isOpen ? '1px solid #e2e8f0' : 'none'};
    box-shadow: -4px 0 20px rgba(0,0,0,0.05);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    opacity: ${props => props.$isOpen ? 1 : 0};
    margin-left: 0;
`;

// --- Main Component ---
const ReceivablesManagerPage: React.FC = () => {
    // State
    const [receivables, setReceivables] = useState<ReceivableLedger[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState<'전체' | '미수' | '완납'>('전체');
    const [searchQuery, setSearchQuery] = useState('');
    const [isFixed, setIsFixed] = useState(false);

    // Selection & Modals
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isBankMatchModalOpen, setIsBankMatchModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Fetch Data
    const fetchReceivables = useCallback(async () => {
        setLoading(true);
        try {
            const data = await receivableService.getReceivables();
            setReceivables(data);
        } catch (error) {
            console.error(error);
            Swal.fire('오류', '미수금 데이터를 불러오지 못했습니다.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReceivables();
    }, []);

    // Derived State
    const filteredReceivables = useMemo(() => {
        return receivables.filter(r => {
            // Date Filter (Using Invoice Date)
            if (r.invoiceData.date < startDate || r.invoiceData.date > endDate) return false;

            // Status Filter
            if (statusFilter !== '전체') {
                if (statusFilter === '미수' && (r.status === '완납' || r.status === '과입금')) return false;
                if (statusFilter === '완납' && r.status !== '완납') return false;
            }

            // Search Query
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    r.invoiceData.partnerName.toLowerCase().includes(q) ||
                    r.invoiceData.itemName.toLowerCase().includes(q)
                );
            }

            return true;
        });
    }, [receivables, startDate, endDate, statusFilter, searchQuery]);

    const summary = useMemo(() => {
        return filteredReceivables.reduce((acc, r) => ({
            totalReceivables: acc.totalReceivables + r.invoiceData.totalAmount,
            totalCollected: acc.totalCollected + r.totalPaidAmount,
            outstandingAmount: acc.outstandingAmount + r.outstandingAmount
        }), { totalReceivables: 0, totalCollected: 0, outstandingAmount: 0 });
    }, [filteredReceivables]);

    const selectedReceivable = useMemo(() =>
        receivables.find(r => r.id === selectedId),
        [receivables, selectedId]);

    // Handlers
    const handleRowClick = (record: ReceivableLedger) => {
        setSelectedId(prev => prev === record.id ? null : record.id);
    };

    const handleDeleteReceivable = async () => {
        if (!selectedReceivable) return;

        const confirm = await Swal.fire({
            title: '미수금 삭제',
            text: '정말 삭제하시겠습니까? 관련 입금 내역은 유지되거나 별도 정리가 필요할 수 있습니다.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: '삭제'
        });

        if (confirm.isConfirmed) {
            try {
                await receivableService.deleteReceivable(selectedReceivable.id);
                Swal.fire('삭제됨', '삭제되었습니다.', 'success');
                setSelectedId(null);
                fetchReceivables();
            } catch (e) {
                console.error(e);
                Swal.fire('오류', '삭제 실패', 'error');
            }
        }
    };

    return (
        <PageContainer>
            <PageHeader>
                <div>
                    <Title>
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-emerald-600" />
                        미수금 관리
                    </Title>
                    <Subtitle>세금계산서 기반 미수 채권 관리 및 입금 매칭</Subtitle>
                </div>
            </PageHeader>

            {/* Summary Cards */}
            <ReceivableSummaryCards summary={summary} />

            {/* Filter Bar */}
            <ReceivableFilterBar
                startDate={startDate}
                endDate={endDate}
                onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                status={statusFilter}
                onStatusChange={setStatusFilter}
                search={searchQuery}
                onSearchChange={setSearchQuery}
                onRefresh={fetchReceivables}
                loading={loading}
                isFixed={isFixed}
                onFixedChange={setIsFixed}
            />

            <ContentArea>
                <TableSection>
                    <ReceivableTable
                        records={filteredReceivables}
                        loading={loading}
                        onRowClick={handleRowClick}
                        selectedId={selectedId}
                        isFixed={isFixed}
                    />
                </TableSection>

                {/* Detail Panel */}
                <DetailPanel $isOpen={!!selectedId}>
                    {selectedReceivable && (
                        <div className="flex flex-col h-full bg-white">
                            {/* Panel Header */}
                            <div className="p-5 border-b border-gray-100 bg-slate-50">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-slate-800">{selectedReceivable.invoiceData.partnerName}</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsEditModalOpen(true)}
                                            className="text-slate-400 hover:text-blue-600 transition p-1"
                                            title="수정"
                                        >
                                            <FontAwesomeIcon icon={faEdit} />
                                        </button>
                                        <button
                                            onClick={handleDeleteReceivable}
                                            className="text-slate-400 hover:text-red-600 transition p-1"
                                            title="삭제"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                        <button
                                            onClick={() => setSelectedId(null)}
                                            className="text-slate-400 hover:text-slate-600 transition p-1 ml-2"
                                            title="닫기"
                                        >
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-slate-500 text-sm mb-4 truncate">{selectedReceivable.invoiceData.itemName}</p>

                                <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-500">청구금액</span>
                                        <span className="font-medium text-slate-800">{selectedReceivable.invoiceData.totalAmount.toLocaleString()}원</span>
                                    </div>
                                    <div className="flex justify-between text-base font-bold text-red-600">
                                        <span>미수잔액</span>
                                        <span>{selectedReceivable.outstandingAmount.toLocaleString()}원</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 grid grid-cols-2 gap-3 border-b border-gray-100">
                                <button
                                    onClick={() => setIsBankMatchModalOpen(true)}
                                    className="p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 font-bold text-sm transition flex flex-col items-center gap-2 group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-white transition">
                                        <FontAwesomeIcon icon={faHistory} />
                                    </div>
                                    계좌조회 매칭
                                </button>
                                <button
                                    onClick={() => setIsManualModalOpen(true)}
                                    className="p-3 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 font-bold text-sm transition flex flex-col items-center gap-2 group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center group-hover:bg-white transition">
                                        <FontAwesomeIcon icon={faPencilAlt} />
                                    </div>
                                    직접 입력
                                </button>
                            </div>

                            {/* History List */}
                            <div className="flex-1 overflow-auto bg-white">
                                <PaymentHistoryList
                                    key={selectedReceivable?.id}
                                    receivableId={selectedReceivable.id}
                                />
                            </div>
                        </div>
                    )}
                </DetailPanel>
            </ContentArea>

            {/* MODALS */}
            {selectedReceivable && isBankMatchModalOpen && (
                <BankMatchModal
                    isOpen={isBankMatchModalOpen}
                    onClose={() => setIsBankMatchModalOpen(false)}
                    receivable={selectedReceivable}
                    onSuccess={() => {
                        setIsBankMatchModalOpen(false);
                        fetchReceivables();
                    }}
                />
            )}

            {selectedReceivable && isManualModalOpen && (
                <ManualPaymentModal
                    isOpen={isManualModalOpen}
                    onClose={() => setIsManualModalOpen(false)}
                    receivable={selectedReceivable}
                    onSuccess={() => {
                        setIsManualModalOpen(false);
                        fetchReceivables();
                    }}
                />
            )}

            {selectedReceivable && isEditModalOpen && (
                <ReceivableEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    receivable={selectedReceivable}
                    onSuccess={() => {
                        setIsEditModalOpen(false);
                        fetchReceivables();
                    }}
                />
            )}
        </PageContainer>
    );
};

// Internal Sub-component for Payment History
const PaymentHistoryList: React.FC<{ receivableId: string }> = ({ receivableId }) => {
    const [payments, setPayments] = useState<ReceivablePayment[]>([]);
    const [refreshTick, setRefreshTick] = useState<number>(0);

    const loadPayments = async () => {
        try {
            const data = await receivableService.getPayments(receivableId);
            setPayments(data);
        } catch (error: any) {
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                console.warn('Index building for payments');
            } else {
                console.error('Failed to load payments:', error);
            }
            setPayments([]);
        }
    };

    useEffect(() => {
        loadPayments();
    }, [receivableId, refreshTick]); // re-load when ID changes or refreshTick changes

    const handleDelete = async (payment: ReceivablePayment) => {
        const confirm = await Swal.fire({
            title: '입금 취소',
            text: '이 입금 내역을 삭제하고 미수금액을 복구하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: '삭제'
        });

        if (confirm.isConfirmed) {
            try {
                await receivableService.deletePayment(payment.id, payment.receivableId, payment.amount);
                Swal.fire({
                    title: '삭제됨',
                    text: '입금 내역이 취소되었습니다.',
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false
                });
                // Force update to reload payments
                setRefreshTick(prev => prev + 1);
            } catch (e) {
                Swal.fire('오류', '삭제 실패', 'error');
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3 px-4 pt-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">입금 처리 내역</h4>
                <button
                    onClick={() => setRefreshTick(prev => prev + 1)}
                    className="text-xs text-slate-400 hover:text-emerald-600"
                    title="새로고침"
                >
                    <FontAwesomeIcon icon={faSyncAlt} />
                </button>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-4">
                {payments.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-4">
                        <div className="italic">입금 내역이 없습니다.</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {payments.map(p => (
                            <div key={p.id} className="border border-gray-100 rounded-lg p-3 shadow-sm bg-white hover:border-emerald-200 transition">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.type === 'BANK_MATCH' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {p.method === 'BankMatch' ? '계좌조회' :
                                            p.method === 'Cash' ? '현금' :
                                                p.method === 'Corporate' ? '법인계좌' :
                                                    p.method === 'Personal' ? '개인계좌' : '수기'}
                                    </span>
                                    <button onClick={() => handleDelete(p)} className="text-gray-300 hover:text-red-500 text-xs transition">
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-sm font-bold text-gray-800">{p.amount.toLocaleString()}원</div>
                                        <div className="text-xs text-gray-400 mt-1">{p.paymentDate}</div>
                                    </div>
                                    <div className="text-xs text-right text-gray-500 max-w-[120px] truncate">
                                        {p.bankSender && <div>{p.bankSender}</div>}
                                        {p.memo && <div>{p.memo}</div>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceivablesManagerPage;
