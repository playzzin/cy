import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar,
    faSearch,
    faFilter,
    faPlus,
    faDownload,
    faMoneyBillWave,
    faCheckCircle,
    faExclamationTriangle,
    faTimesCircle,
    faEdit
} from '@fortawesome/free-solid-svg-icons';
import { Timestamp } from 'firebase/firestore';
import { receivableService } from '../../services/receivableService';
import {
    Receivable,
    ReceivableFilters,
    ReceivableStatus
} from '../../types/receivable';
import * as XLSX from 'xlsx';

const ReceivablesManagementPage: React.FC = () => {
    // State
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Filters
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | ''>('');
    const [selectedStatus, setSelectedStatus] = useState<ReceivableStatus | ''>('');

    // Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);

    // Payment Form
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('이체');
    const [paymentNote, setPaymentNote] = useState('');

    // Load data
    useEffect(() => {
        loadReceivables();
    }, [selectedYear, selectedMonth, selectedStatus]);

    const loadReceivables = async () => {
        setLoading(true);
        try {
            const filters: ReceivableFilters = {
                year: selectedYear
            };
            if (selectedMonth) filters.month = selectedMonth as number;
            if (selectedStatus) filters.status = selectedStatus as ReceivableStatus;

            const data = await receivableService.getAll(filters);
            setReceivables(data);
        } catch (error) {
            console.error('Error loading receivables:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filtered receivables
    const filteredReceivables = receivables.filter(r =>
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.note?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Status badge
    const getStatusBadge = (status: ReceivableStatus) => {
        const badges = {
            [ReceivableStatus.PAID]: { bg: 'bg-green-100', text: 'text-green-800', icon: faCheckCircle, label: '완납' },
            [ReceivableStatus.PARTIAL]: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: faExclamationTriangle, label: '부분납부' },
            [ReceivableStatus.UNPAID]: { bg: 'bg-red-100', text: 'text-red-800', icon: faTimesCircle, label: '미납' },
            [ReceivableStatus.OVERDUE]: { bg: 'bg-gray-800', text: 'text-white', icon: faExclamationTriangle, label: '연체' }
        };
        const badge = badges[status];
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                <FontAwesomeIcon icon={badge.icon} className="text-xs" />
                {badge.label}
            </span>
        );
    };

    // Open payment modal
    const openPaymentModal = (receivable: Receivable) => {
        setSelectedReceivable(receivable);
        setPaymentAmount(receivable.balance.toString());
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('이체');
        setPaymentNote('');
        setIsPaymentModalOpen(true);
    };

    // Submit payment
    const handleSubmitPayment = async () => {
        if (!selectedReceivable || !paymentAmount) return;

        try {
            await receivableService.addPayment(selectedReceivable.id!, {
                paymentDate,
                amount: parseFloat(paymentAmount),
                method: paymentMethod,
                note: paymentNote,
                createdBy: 'current-user', // TODO: 실제 사용자 정보
                createdAt: Timestamp.now()
            });

            alert('입금이 등록되었습니다.');
            setIsPaymentModalOpen(false);
            loadReceivables();
        } catch (error) {
            console.error('Error adding payment:', error);
            alert('입금 등록 중 오류가 발생했습니다.');
        }
    };

    // Excel download
    const downloadExcel = () => {
        const data = filteredReceivables.map(r => ({
            '년도': r.issueYear,
            '거래처명': r.customerName,
            '발행일': r.issueDate,
            '발행액': r.totalAmount,
            '세액': r.taxAmount,
            '공급가액': r.supplyAmount,
            '총 입금액': r.totalPaid,
            '미수금': r.balance,
            '상태': r.status === ReceivableStatus.PAID ? '완납' :
                r.status === ReceivableStatus.PARTIAL ? '부분납부' :
                    r.status === ReceivableStatus.UNPAID ? '미납' : '연체',
            '담당자': r.manager || '',
            '비고': r.note || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '미수금');
        XLSX.writeFile(wb, `미수금_${selectedYear}년${selectedMonth ? `_${selectedMonth}월` : ''}.xlsx`);
    };

    // Years for filter
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    if (loading && receivables.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-lg text-gray-500">데이터 로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-blue-600" />
                        미수금 관리
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">세금계산서 발행에 대한 입금 및 미수금을 관리합니다</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Year */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">년도</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {years.map(year => (
                                    <option key={year} value={year}>{year}년</option>
                                ))}
                            </select>
                        </div>

                        {/* Month */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">월</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : '')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">전체</option>
                                {months.map(month => (
                                    <option key={month} value={month}>{month}월</option>
                                ))}
                            </select>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value as ReceivableStatus | '')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">전체</option>
                                <option value={ReceivableStatus.UNPAID}>미납</option>
                                <option value={ReceivableStatus.PARTIAL}>부분납부</option>
                                <option value={ReceivableStatus.PAID}>완납</option>
                                <option value={ReceivableStatus.OVERDUE}>연체</option>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">검색</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="거래처명, 비고 검색..."
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={downloadExcel}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faDownload} />
                            Excel 다운로드
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
                        <div className="text-sm text-gray-600">총 발행액</div>
                        <div className="text-2xl font-bold text-gray-800 mt-1">
                            {filteredReceivables.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString()}원
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                        <div className="text-sm text-gray-600">총 입금액</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">
                            {filteredReceivables.reduce((sum, r) => sum + r.totalPaid, 0).toLocaleString()}원
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
                        <div className="text-sm text-gray-600">총 미수금</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">
                            {filteredReceivables.reduce((sum, r) => sum + r.balance, 0).toLocaleString()}원
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
                        <div className="text-sm text-gray-600">미납 건수</div>
                        <div className="text-2xl font-bold text-yellow-600 mt-1">
                            {filteredReceivables.filter(r => r.status !== ReceivableStatus.PAID).length}건
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">년도</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">거래처명</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">발행일</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">발행액</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">입금액</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">미수금</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredReceivables.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                            조회된 미수금 내역이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReceivables.map((receivable) => (
                                        <tr key={receivable.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-900">{receivable.issueYear}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{receivable.customerName}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{receivable.issueDate}</td>
                                            <td className="px-4 py-3 text-sm text-right text-gray-900 font-mono">
                                                {receivable.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-green-600 font-mono">
                                                {receivable.totalPaid.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-red-600 font-mono font-bold">
                                                {receivable.balance.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {getStatusBadge(receivable.status)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                                {receivable.note || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {receivable.status !== ReceivableStatus.PAID && (
                                                    <button
                                                        onClick={() => openPaymentModal(receivable)}
                                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faMoneyBillWave} className="mr-1" />
                                                        입금등록
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payment Modal */}
                {isPaymentModalOpen && selectedReceivable && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-4">입금 등록</h3>

                                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                    <div className="text-sm text-gray-600">거래처</div>
                                    <div className="font-bold text-gray-800">{selectedReceivable.customerName}</div>
                                    <div className="text-xs text-gray-500 mt-1">발행일: {selectedReceivable.issueDate}</div>
                                    <div className="text-sm text-red-600 font-bold mt-2">
                                        미수금: {selectedReceivable.balance.toLocaleString()}원
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">입금일</label>
                                        <input
                                            type="date"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">입금액</label>
                                        <input
                                            type="number"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="입금액 입력"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">입금 방법</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="이체">이체</option>
                                            <option value="현금">현금</option>
                                            <option value="수표">수표</option>
                                            <option value="기타">기타</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                                        <textarea
                                            value={paymentNote}
                                            onChange={(e) => setPaymentNote(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            rows={3}
                                            placeholder="비고 입력 (선택)"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={handleSubmitPayment}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        등록
                                    </button>
                                    <button
                                        onClick={() => setIsPaymentModalOpen(false)}
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                                    >
                                        취소
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceivablesManagementPage;
