import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDashboard,
    faMoneyBillTrendUp,
    faMoneyBillWave,
    faExclamationTriangle,
    faCheckCircle,
    faClock,
    faThumbtack
} from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { receivableService } from '../../services/receivableService';
import {
    Receivable,
    ReceivableStatistics,
    ReceivableStatus
} from '../../types/receivable';

const ReceivablesDashboardPage: React.FC = () => {
    const navigate = useNavigate();

    // State
    const [statistics, setStatistics] = useState<ReceivableStatistics>({
        totalIssued: 0,
        totalPaid: 0,
        totalBalance: 0,
        overdueCount: 0,
        overdueAmount: 0
    });
    const [recentReceivables, setRecentReceivables] = useState<Receivable[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFixed, setIsFixed] = useState(true);

    // Lock parent scroll for internal scrolling
    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const originalOverflow = mainContent.style.overflow;
            mainContent.style.overflow = 'hidden';
            return () => {
                mainContent.style.overflow = originalOverflow;
            };
        }
    }, []);

    // Load data
    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Load all active receivables
            const all = await receivableService.getReceivables();

            // Calculate statistics locally
            const stats: ReceivableStatistics = all.reduce((acc, curr) => {
                acc.totalIssued += curr.outstandingAmount + curr.totalPaidAmount; // Approximate total issued
                acc.totalPaid += curr.totalPaidAmount;
                acc.totalBalance += curr.outstandingAmount;

                // Overdue logic (simple check: if unpaid and older than 30 days)
                const issueDate = new Date(curr.invoiceData.date);
                const diffTime = Math.abs(new Date().getTime() - issueDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (curr.status !== '완납' && curr.status !== '과입금' && diffDays > 30) {
                    acc.overdueCount += 1;
                    acc.overdueAmount += curr.outstandingAmount;
                }

                return acc;
            }, {
                totalIssued: 0,
                totalPaid: 0,
                totalBalance: 0,
                overdueCount: 0,
                overdueAmount: 0
            });

            setStatistics(stats);

            // Recent unpaid
            const unpaid = all
                .filter(r => r.status !== '완납' && r.status !== '과입금')
                .sort((a, b) => new Date(b.invoiceData.date).getTime() - new Date(a.invoiceData.date).getTime())
                .slice(0, 10);

            // Map to compatible format if needed by component
            const mapStatus = (s: string, date: string): ReceivableStatus => {
                const issueDate = new Date(date);
                const diffTime = Math.abs(new Date().getTime() - issueDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays > 30 && s !== '완납' && s !== '과입금') return ReceivableStatus.OVERDUE;
                if (s === '완납' || s === '과입금') return ReceivableStatus.PAID;
                if (s === '부분수납') return ReceivableStatus.PARTIAL;
                return ReceivableStatus.UNPAID;
            };

            const mappedUnpaid = unpaid.map(r => ({
                id: r.id,
                customerName: r.invoiceData.partnerName,
                issueDate: r.invoiceData.date,
                totalAmount: r.outstandingAmount + r.totalPaidAmount,
                totalPaid: r.totalPaidAmount,
                balance: r.outstandingAmount,
                status: mapStatus(r.status, r.invoiceData.date),
                note: r.invoiceData.itemName
            }));

            setRecentReceivables(mappedUnpaid as any); // Cast to any or fix type in state
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate collection rate
    const collectionRate = statistics.totalIssued > 0
        ? ((statistics.totalPaid / statistics.totalIssued) * 100).toFixed(1)
        : '0';

    // Status badge
    const getStatusBadge = (status: ReceivableStatus) => {
        const badges = {
            [ReceivableStatus.PAID]: { bg: 'bg-green-100', text: 'text-green-800', label: '완납' },
            [ReceivableStatus.PARTIAL]: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '부분납부' },
            [ReceivableStatus.UNPAID]: { bg: 'bg-red-100', text: 'text-red-800', label: '미납' },
            [ReceivableStatus.OVERDUE]: { bg: 'bg-gray-800', text: 'text-white', label: '연체' }
        };
        const badge = badges[status];
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                {badge.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-lg text-gray-500">데이터 로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 p-6 overflow-hidden">
            <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FontAwesomeIcon icon={faDashboard} className="text-blue-600" />
                        미수금 대시보드
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">미수금 현황을 한눈에 확인하세요</p>
                </div>

                {/* Stats Cards */}
                <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total Issued */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <FontAwesomeIcon icon={faMoneyBillTrendUp} className="text-2xl text-blue-600" />
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">총 발행액</div>
                        <div className="text-3xl font-bold text-gray-800 mb-2">
                            {(statistics.totalIssued / 10000).toFixed(0)}
                            <span className="text-lg text-gray-500 ml-1">만원</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {statistics.totalIssued.toLocaleString()}원
                        </div>
                    </div>

                    {/* Total Paid */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-600" />
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">총 입금액</div>
                        <div className="text-3xl font-bold text-green-600 mb-2">
                            {(statistics.totalPaid / 10000).toFixed(0)}
                            <span className="text-lg text-green-500 ml-1">만원</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            수금률: {collectionRate}%
                        </div>
                    </div>

                    {/* Total Balance */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-red-100 rounded-lg">
                                <FontAwesomeIcon icon={faMoneyBillWave} className="text-2xl text-red-600" />
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">총 미수금</div>
                        <div className="text-3xl font-bold text-red-600 mb-2">
                            {(statistics.totalBalance / 10000).toFixed(0)}
                            <span className="text-lg text-red-500 ml-1">만원</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {statistics.totalBalance.toLocaleString()}원
                        </div>
                    </div>

                    {/* Overdue */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-yellow-600" />
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">연체 (30일 초과)</div>
                        <div className="text-3xl font-bold text-yellow-600 mb-2">
                            {statistics.overdueCount}
                            <span className="text-lg text-yellow-500 ml-1">건</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {(statistics.overdueAmount / 10000).toFixed(0)}만원
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => navigate('/payroll/taxinvoice/receivables')}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all hover:border-blue-300"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <FontAwesomeIcon icon={faMoneyBillWave} className="text-xl text-blue-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-gray-800">미수금 관리</div>
                                <div className="text-xs text-gray-500">입금 등록 및 관리</div>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/payroll/taxinvoice/ledger')}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all hover:border-purple-300"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-50 rounded-lg">
                                <FontAwesomeIcon icon={faClock} className="text-xl text-purple-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-gray-800">거래장 조회</div>
                                <div className="text-xs text-gray-500">전체 내역 확인</div>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Recent Unpaid Receivables */}
                <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">미수금 현황</h2>
                            <p className="text-sm text-gray-500 mt-1">미납 및 부분 납부 내역</p>
                        </div>
                        <button
                            onClick={() => setIsFixed(!isFixed)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isFixed
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <FontAwesomeIcon icon={faThumbtack} className={isFixed ? 'rotate-45' : ''} />
                            {isFixed ? '틀고정 해제' : '틀고정 활성'}
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
                                <tr>
                                    <th className={`px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider ${isFixed ? 'sticky left-0 z-40 bg-gray-50 border-r border-gray-200' : ''}`}>
                                        거래처
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        발행일
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        발행액
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        입금액
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        미수금
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        상태
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {recentReceivables.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            미납 내역이 없습니다! 🎉
                                        </td>
                                    </tr>
                                ) : (
                                    recentReceivables.map((receivable) => (
                                        <tr
                                            key={receivable.id}
                                            className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                            onClick={() => navigate('/payroll/taxinvoice/receivables')}
                                        >
                                            <td className={`px-6 py-4 whitespace-nowrap ${isFixed ? 'sticky left-0 z-20 bg-white group-hover:bg-blue-50 border-r border-gray-100' : ''}`}>
                                                <div className="font-medium text-gray-900">{receivable.customerName}</div>
                                                <div className="text-xs text-gray-500">{receivable.note}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {receivable.issueDate}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-900">
                                                {receivable.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-green-600">
                                                {receivable.totalPaid.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-red-600">
                                                {receivable.balance.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {getStatusBadge(receivable.status)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {recentReceivables.length > 0 && (
                        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                            <button
                                onClick={() => navigate('/payroll/taxinvoice/receivables')}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                                전체 미수금 보기 →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReceivablesDashboardPage;
