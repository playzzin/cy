/**
 * 거래처별 매출/매입 거래장 페이지
 * 
 * Firestore 연동:
 * - 거래처별 잔액 관리
 * - 매출 발생 + 입금 내역
 * - 잔액 = 매출금액 - 입금금액
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSearch,
    faFilter,
    faDownload,
    faArrowUp,
    faArrowDown,
    faBalanceScale,
    faSpinner,
    faPlus,
    faKeyboard,
    faList
} from '@fortawesome/free-solid-svg-icons';
import { companyService } from '../../services/companyService';
import { balanceCalculationService } from '../../services/paymentFirestoreService';
import DepositModal from './components/DepositModal';
import ManualSalesModal from './components/ManualSalesModal';

// 거래 내역 인터페이스
interface TransactionRecord {
    id: string;
    date: string;
    description: string;
    saleAmount: number;
    paymentAmount: number;
    balance: number;
    siteName: string;
    memo?: string;
    teamName?: string;
    type: 'invoice' | 'payment';
    sourceId: string;
}

// 거래처 인터페이스 (잔액 포함)
interface PartnerWithBalance {
    id: string;
    name: string;
    type: string;
    businessNumber: string;
    totalSales: number;
    totalPayments: number;
    receivableBalance: number;  // 미수금
    payableBalance: number;     // 미지급
}

const PartnerTransactionLedgerPage: React.FC = () => {
    // 필터 상태
    const [startDate, setStartDate] = useState('2019-01-01');
    const [endDate, setEndDate] = useState('2025-12-31');
    const [transactionType, setTransactionType] = useState<'매출' | '매입'>('매출');

    // 모드 상태: 'registered' (등록업체) | 'manual' (수기입력)
    const [viewMode, setViewMode] = useState<'registered' | 'manual'>('registered');

    // 선택 상태
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [manualCompanyName, setManualCompanyName] = useState<string>(''); // 수기 입력 시 회사명
    const [siteFilter, setSiteFilter] = useState('');

    // 데이터 상태
    const [partners, setPartners] = useState<PartnerWithBalance[]>([]);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [transactionLoading, setTransactionLoading] = useState(false);

    // 모달 상태 (추후 구현)
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showSalesModal, setShowSalesModal] = useState(false);

    // 새로고침 트리거
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 데이터 새로고침 핸들러
    const handleRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // 협력사/건설사 목록 로드 (등록업체 모드일 때만)
    useEffect(() => {
        if (viewMode === 'registered') {
            const loadPartners = async () => {
                setLoading(true);
                try {
                    // 협력사 + 건설사 로드
                    const allCompanies = await companyService.getActiveCompanies();
                    const filteredCompanies = allCompanies.filter(
                        c => c.type === '협력사' || c.type === '건설사'
                    );

                    // 각 회사별 잔액 계산
                    const partnersWithBalance: PartnerWithBalance[] = await Promise.all(
                        filteredCompanies.map(async (company) => {
                            try {
                                const balance = await balanceCalculationService.calculateCompanyBalance(company.id!);
                                return {
                                    id: company.id!,
                                    name: company.name,
                                    type: company.type,
                                    businessNumber: company.businessNumber,
                                    totalSales: balance.salesTotal,
                                    totalPayments: balance.receivedTotal,
                                    receivableBalance: balance.receivableBalance,
                                    payableBalance: balance.payableBalance,
                                };
                            } catch {
                                return {
                                    id: company.id!,
                                    name: company.name,
                                    type: company.type,
                                    businessNumber: company.businessNumber,
                                    totalSales: 0,
                                    totalPayments: 0,
                                    receivableBalance: 0,
                                    payableBalance: 0,
                                };
                            }
                        })
                    );

                    setPartners(partnersWithBalance);
                } catch (error) {
                    console.error('거래처 목록 로드 실패:', error);
                } finally {
                    setLoading(false);
                }
            };
            loadPartners();
        }
    }, [viewMode, refreshTrigger]);

    // 거래 내역 로드
    useEffect(() => {
        const fetchHistory = async () => {
            // 조건 불충족 시 리턴
            if (viewMode === 'registered' && !selectedCompanyId) {
                setTransactions([]);
                return;
            }
            if (viewMode === 'manual' && !manualCompanyName) {
                setTransactions([]);
                return;
            }

            setTransactionLoading(true);
            try {
                let history;
                if (viewMode === 'registered') {
                    history = await balanceCalculationService.getCompanyTransactionHistory(selectedCompanyId);
                } else {
                    history = await balanceCalculationService.getCompanyTransactionHistoryByName(manualCompanyName);
                }

                setTransactions(history.map(h => ({
                    id: h.sourceId,
                    date: h.date,
                    description: h.description,
                    saleAmount: h.saleAmount,
                    paymentAmount: h.paymentAmount,
                    balance: h.balance,
                    siteName: h.siteName || '',
                    memo: h.memo,
                    teamName: h.teamName,
                    type: h.type,
                    sourceId: h.sourceId,
                })));
            } catch (error) {
                console.error('거래 내역 로드 실패:', error);
                setTransactions([]);
            } finally {
                setTransactionLoading(false);
            }
        };

        fetchHistory();
    }, [viewMode, selectedCompanyId, manualCompanyName, refreshTrigger]);

    // 선택된 거래처 정보 (등록 모드일 때)
    const selectedPartner = useMemo(() => {
        if (viewMode === 'registered') {
            return partners.find(p => p.id === selectedCompanyId);
        }
        return null;
    }, [partners, selectedCompanyId, viewMode]);

    // 필터링된 거래 내역
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (tx.date < startDate || tx.date > endDate) return false;
            if (siteFilter && tx.siteName && !tx.siteName.includes(siteFilter)) return false;
            return true;
        });
    }, [transactions, startDate, endDate, siteFilter]);

    // 합계 계산
    const totals = useMemo(() => {
        return filteredTransactions.reduce((acc, tx) => ({
            saleAmount: acc.saleAmount + tx.saleAmount,
            paymentAmount: acc.paymentAmount + tx.paymentAmount,
        }), { saleAmount: 0, paymentAmount: 0 });
    }, [filteredTransactions]);

    // 현장 목록 (필터용)
    const sites = useMemo(() => {
        const set = new Set(transactions.filter(t => t.siteName).map(t => t.siteName));
        return Array.from(set).sort();
    }, [transactions]);

    // 금액 포맷
    const formatMoney = (value: number) => {
        return new Intl.NumberFormat('ko-KR').format(value);
    };

    // Excel 다운로드
    const handleExcelDownload = () => {
        alert('Excel 다운로드 기능은 실제 구현 시 추가됩니다.');
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faBalanceScale} className="text-3xl" />
                            <div>
                                <h1 className="text-2xl font-bold">매출/매입 거래장</h1>
                                <p className="text-purple-100">거래처별 잔액 관리</p>
                            </div>
                        </div>
                        <button
                            onClick={handleExcelDownload}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <FontAwesomeIcon icon={faDownload} />
                            Excel 다운로드
                        </button>
                    </div>
                </div>

                {/* 필터 영역 */}
                <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faFilter} className="text-gray-500" />
                            <h2 className="font-semibold">조회 조건</h2>
                        </div>
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('registered')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'registered'
                                    ? 'bg-white text-purple-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faList} className="mr-2" />
                                등록 거래처
                            </button>
                            <button
                                onClick={() => setViewMode('manual')}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'manual'
                                    ? 'bg-white text-purple-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faKeyboard} className="mr-2" />
                                수기 입력 (회사명)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        {/* 검색시작일 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">검색시작일</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* 검색종료일 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">검색종료일</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* 구분 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">구분</label>
                            <select
                                value={transactionType}
                                onChange={(e) => setTransactionType(e.target.value as '매출' | '매입')}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="매출">매출</option>
                                <option value="매입">매입</option>
                            </select>
                        </div>

                        {/* 거래처 선택/입력 */}
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                {viewMode === 'registered' ? '거래처 선택' : '회사명 입력'}
                            </label>
                            {viewMode === 'registered' ? (
                                <select
                                    value={selectedCompanyId}
                                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">선택하세요</option>
                                    {partners.map(p => (
                                        <option key={p.id} value={p.id}>[{p.type}] {p.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={manualCompanyName}
                                    onChange={(e) => setManualCompanyName(e.target.value)}
                                    placeholder="회사명 직접 입력"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                />
                            )}
                        </div>

                        {/* 조회 버튼 (수기 모드일 때 유용) */}
                        <div className="flex items-end">
                            <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2">
                                <FontAwesomeIcon icon={faSearch} />
                                조회
                            </button>
                        </div>
                    </div>
                </div>

                {/* 로딩 */}
                {loading && (
                    <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                        <FontAwesomeIcon icon={faSpinner} className="text-4xl text-purple-500 animate-spin" />
                        <p className="mt-4 text-gray-500">데이터 로딩 중...</p>
                    </div>
                )}

                {/* 등록된 거래처 목록 (거래처 미선택 시) */}
                {!loading && viewMode === 'registered' && !selectedCompanyId && (
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-semibold mb-4">거래처별 잔액 현황 (협력사/건설사)</h3>
                        {partners.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                등록된 협력사/건설사가 없습니다.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-yellow-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">구분</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">거래처명</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-r">총 매출</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-r">총 입금</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">미수금</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {partners.map(partner => (
                                            <tr
                                                key={partner.id}
                                                className="border-t hover:bg-purple-50 cursor-pointer"
                                                onClick={() => setSelectedCompanyId(partner.id)}
                                            >
                                                <td className="px-4 py-3 text-sm border-r">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${partner.type === '협력사' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {partner.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-blue-600 border-r">
                                                    {partner.name}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right border-r">
                                                    {formatMoney(partner.totalSales)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right border-r">
                                                    {formatMoney(partner.totalPayments)}
                                                </td>
                                                <td className={`px-4 py-3 text-sm text-right font-semibold ${partner.receivableBalance > 0 ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                    {formatMoney(partner.receivableBalance)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 거래 내역 뷰 (거래처 선택됨 OR 수기입력 모드) */}
                {(
                    (viewMode === 'registered' && selectedCompanyId) ||
                    (viewMode === 'manual' && manualCompanyName)
                ) && (
                        <>
                            {/* 거래처 제목 */}
                            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 relative">
                                <h2 className="text-2xl font-bold text-center">
                                    {viewMode === 'registered' && selectedPartner ? (
                                        <>
                                            <span className={`px-2 py-1 rounded text-sm font-medium mr-2 ${selectedPartner.type === '협력사' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {selectedPartner.type}
                                            </span>
                                            {selectedPartner.name}
                                        </>
                                    ) : (
                                        <>
                                            <span className="px-2 py-1 rounded text-sm font-medium mr-2 bg-gray-100 text-gray-700">
                                                수기입력
                                            </span>
                                            {manualCompanyName}
                                        </>
                                    )}
                                </h2>
                                {viewMode === 'registered' && selectedPartner && (
                                    <p className="text-center text-gray-500 mt-1">사업자번호: {selectedPartner.businessNumber}</p>
                                )}

                                {/* 등록 버튼 그룹 */}
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button
                                        onClick={() => setShowDepositModal(true)}
                                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="mr-1.5" />
                                        입금 등록
                                    </button>
                                    <button
                                        onClick={() => setShowSalesModal(true)}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="mr-1.5" />
                                        매출(수기) 등록
                                    </button>
                                </div>
                            </div>

                            {/* 요약 카드 */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-white rounded-xl shadow-sm border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500">매출금액 합계</p>
                                            <p className="text-2xl font-bold text-blue-600">
                                                ₩{formatMoney(totals.saleAmount)}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                            <FontAwesomeIcon icon={faArrowUp} className="text-blue-600 text-xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500">입금금액 합계</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                ₩{formatMoney(totals.paymentAmount)}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <FontAwesomeIcon icon={faArrowDown} className="text-green-600 text-xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-sm border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500">현재 잔액</p>
                                            <p className={`text-2xl font-bold ${filteredTransactions.length > 0
                                                ? filteredTransactions[filteredTransactions.length - 1].balance > 0
                                                    ? 'text-red-600'
                                                    : 'text-green-600'
                                                : 'text-gray-600'
                                                }`}>
                                                ₩{formatMoney(
                                                    filteredTransactions.length > 0
                                                        ? filteredTransactions[filteredTransactions.length - 1].balance
                                                        : 0
                                                )}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                            <FontAwesomeIcon icon={faBalanceScale} className="text-purple-600 text-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 거래 내역 테이블 */}
                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                    <h3 className="font-semibold">
                                        거래 내역 ({filteredTransactions.length}건)
                                    </h3>
                                    {/* 현장명 필터 */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">현장 필터:</span>
                                        <select
                                            value={siteFilter}
                                            onChange={(e) => setSiteFilter(e.target.value)}
                                            className="text-sm border rounded px-2 py-1"
                                        >
                                            <option value="">전체 현장</option>
                                            {sites.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {transactionLoading ? (
                                    <div className="p-12 text-center text-gray-500">
                                        <FontAwesomeIcon icon={faSpinner} className="text-2xl animate-spin" />
                                        <p className="mt-2">로딩 중...</p>
                                    </div>
                                ) : filteredTransactions.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500">
                                        거래 내역이 없습니다.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1000px]">
                                            <colgroup>
                                                <col width="100" /> {/* 날짜 */}
                                                <col width="*" />   {/* 내용 */}
                                                <col width="120" /> {/* 매출 */}
                                                <col width="120" /> {/* 입금 */}
                                                <col width="120" /> {/* 잔액 */}
                                                <col width="150" /> {/* 현장명 */}
                                                <col width="150" /> {/* 비고 */}
                                                <col width="100" /> {/* 팀명 */}
                                            </colgroup>
                                            <thead className="bg-[#FFF4E5] border-b-2 border-orange-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200">날짜</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200">내용</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200 bg-blue-50">매출금액</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200 bg-green-50">입금금액</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200 bg-red-50">잔액</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200">현장명</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800 border-r border-orange-200">비고</th>
                                                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-800">팀명</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* 이월 잔액 표시 (Optional: logic could be added here if filtered by date) */}

                                                {filteredTransactions.map((tx) => (
                                                    <tr key={tx.id} className="border-b hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-2 text-sm text-center border-r text-gray-600">{tx.date}</td>
                                                        <td className="px-4 py-2 text-sm border-r font-medium text-gray-800">{tx.description}</td>
                                                        <td className="px-4 py-2 text-sm text-right border-r bg-blue-50/20 text-blue-600 font-medium">
                                                            {tx.saleAmount > 0 ? formatMoney(tx.saleAmount) : '-'}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-right border-r bg-green-50/20 text-green-600 font-medium">
                                                            {tx.paymentAmount > 0 ? formatMoney(tx.paymentAmount) : '-'}
                                                        </td>
                                                        <td className={`px-4 py-2 text-sm text-right border-r bg-red-50/20 font-bold ${tx.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                            {formatMoney(tx.balance)}
                                                        </td>
                                                        <td className="px-4 py-2 text-sm text-center border-r text-gray-600">{tx.siteName}</td>
                                                        <td className="px-4 py-2 text-sm text-center border-r text-gray-500">{tx.memo || '-'}</td>
                                                        <td className="px-4 py-2 text-sm text-center text-gray-600">{tx.teamName || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-[#E6F4EA] border-t-2 border-green-200 font-bold">
                                                <tr>
                                                    <td colSpan={2} className="px-4 py-3 text-center border-r border-green-200">합 계</td>
                                                    <td className="px-4 py-3 text-right border-r border-green-200 text-blue-700">{formatMoney(totals.saleAmount)}</td>
                                                    <td className="px-4 py-3 text-right border-r border-green-200 text-green-700">{formatMoney(totals.paymentAmount)}</td>
                                                    <td className={`px-4 py-3 text-right border-r border-green-200 ${filteredTransactions.length > 0 && filteredTransactions[filteredTransactions.length - 1].balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {formatMoney(filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].balance : 0)}
                                                    </td>
                                                    <td colSpan={3}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}

                                {/* 안내 문구 */}
                                <div className="p-3 bg-yellow-50 text-yellow-700 text-xs text-center border-t border-yellow-100">
                                    ※ 최근 5년간의 데이터가 표시됩니다. 기간 설정을 통해 과거나 미래 내역을 확인하세요.
                                </div>
                            </div>
                        </>
                    )}
            </div>

            <DepositModal
                isOpen={showDepositModal}
                onClose={() => setShowDepositModal(false)}
                onSuccess={handleRefresh}
                initialCompanyId={viewMode === 'registered' ? selectedCompanyId : undefined}
                initialCompanyName={viewMode === 'registered' ? selectedPartner?.name : manualCompanyName}
            />

            <ManualSalesModal
                isOpen={showSalesModal}
                onClose={() => setShowSalesModal(false)}
                onSuccess={handleRefresh}
                initialCompanyId={viewMode === 'registered' ? selectedCompanyId : undefined}
                initialCompanyName={viewMode === 'registered' ? selectedPartner?.name : manualCompanyName}
                initialBusinessNumber={viewMode === 'registered' ? selectedPartner?.businessNumber : undefined}
            />
        </div>
    );
};

export default PartnerTransactionLedgerPage;
