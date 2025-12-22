/**
 * 세금계산서 거래장/원장 조회 페이지
 * 
 * 사용자 엑셀 양식과 동일한 UI로 구현
 * - 거래처별 세금계산서 목록
 * - 매출/매입 필터
 * - 연도/월/분기 필터
 * - 합계/잔액 자동 계산
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar,
    faSearch,
    faFilter,
    faDownload,
    faExchangeAlt,
    faChartLine,
    faWon
} from '@fortawesome/free-solid-svg-icons';

// 거래 타입
type TransactionType = '매출' | '매입' | '전체';

// 세금계산서 데이터 인터페이스
interface TaxInvoiceRecord {
    id: string;
    date: string;                    // 발행일 (YYYY-MM-DD)
    partnerName: string;             // 거래처명
    description: string;             // 품목/내용
    supplyAmount: number;            // 공급가액
    taxAmount: number;               // 부가세
    totalAmount: number;             // 합계
    type: '매출' | '매입';            // 매출/매입 구분
    siteName?: string;               // 현장명
    teamName?: string;               // 팀명
    invoiceNum?: string;             // 세금계산서 번호
    status: 'issued' | 'received';   // 발행/수취
    memo?: string;                   // 비고
}

// Mock 데이터 생성
const generateMockData = (): TaxInvoiceRecord[] => {
    const partners = [
        '건원종합개발 주식회사', '성균레미컨주식회사', '주식회사 탑엔지니어링',
        '주식회사 화유건설', '큐브시스템', '한창실업(주)', 'MTK건설',
        '신영건개발산', '(주)도모플러스', 'Y&S 건설(주)', '감진종합건설(주)',
        '고이건설(주)', '현대캐피탈'
    ];

    const sites = ['수원 건원종합개발 현장', '천안 GS대산 현장', '충북대 탑엔지니어링 현장',
        '부천 소새울유치원 현장', '인천공항 현장', '김포 화유건설현장 11현'];

    const descriptions = ['시스템', '시스템비계', 'PVC덕', '입대료', '자재이동외 외 1건', '가설재 외'];

    const data: TaxInvoiceRecord[] = [];

    // 2025년 데이터 생성
    for (let month = 1; month <= 12; month++) {
        const numRecords = Math.floor(Math.random() * 10) + 5;

        for (let i = 0; i < numRecords; i++) {
            const supplyAmount = Math.floor(Math.random() * 50000000) + 1000000;
            const taxAmount = Math.floor(supplyAmount * 0.1);
            const isSales = Math.random() > 0.3;

            data.push({
                id: `inv-2025-${month}-${i}`,
                date: `2025-${String(month).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                partnerName: partners[Math.floor(Math.random() * partners.length)],
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                supplyAmount: isSales ? supplyAmount : -supplyAmount,
                taxAmount: isSales ? taxAmount : -taxAmount,
                totalAmount: isSales ? supplyAmount + taxAmount : -(supplyAmount + taxAmount),
                type: isSales ? '매출' : '매입',
                siteName: sites[Math.floor(Math.random() * sites.length)],
                teamName: ['이재욱', '김재욱', '박재욱'][Math.floor(Math.random() * 3)],
                invoiceNum: `20250${month}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
                status: 'issued',
                memo: Math.random() > 0.7 ? '비고 메모' : undefined,
            });
        }
    }

    return data.sort((a, b) => a.date.localeCompare(b.date));
};

const TaxInvoiceLedgerPage: React.FC = () => {
    // 필터 상태
    const [year, setYear] = useState(2025);
    const [startMonth, setStartMonth] = useState(1);
    const [endMonth, setEndMonth] = useState(12);
    const [transactionType, setTransactionType] = useState<TransactionType>('전체');
    const [partnerFilter, setPartnerFilter] = useState('');
    const [teamFilter, setTeamFilter] = useState('');

    // 데이터 상태
    const [data, setData] = useState<TaxInvoiceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Mock 데이터 로드
    useEffect(() => {
        setLoading(true);
        // 실제로는 API 호출
        setTimeout(() => {
            setData(generateMockData());
            setLoading(false);
        }, 500);
    }, []);

    // 필터링된 데이터
    const filteredData = useMemo(() => {
        return data.filter(record => {
            const recordDate = new Date(record.date);
            const recordMonth = recordDate.getMonth() + 1;
            const recordYear = recordDate.getFullYear();

            // 연도 필터
            if (recordYear !== year) return false;

            // 월 범위 필터
            if (recordMonth < startMonth || recordMonth > endMonth) return false;

            // 매출/매입 필터
            if (transactionType !== '전체' && record.type !== transactionType) return false;

            // 거래처 필터
            if (partnerFilter && !record.partnerName.includes(partnerFilter)) return false;

            // 팀 필터
            if (teamFilter && record.teamName !== teamFilter) return false;

            return true;
        });
    }, [data, year, startMonth, endMonth, transactionType, partnerFilter, teamFilter]);

    // 합계 계산
    const totals = useMemo(() => {
        return filteredData.reduce((acc, record) => ({
            supplyAmount: acc.supplyAmount + record.supplyAmount,
            taxAmount: acc.taxAmount + record.taxAmount,
            totalAmount: acc.totalAmount + record.totalAmount,
        }), { supplyAmount: 0, taxAmount: 0, totalAmount: 0 });
    }, [filteredData]);

    // 거래처 목록 (필터 드롭다운용)
    const partners = useMemo(() => {
        const set = new Set(data.map(d => d.partnerName));
        return Array.from(set).sort();
    }, [data]);

    // 팀 목록
    const teams = useMemo(() => {
        const set = new Set(data.filter(d => d.teamName).map(d => d.teamName!));
        return Array.from(set).sort();
    }, [data]);

    // 금액 포맷
    const formatMoney = (value: number) => {
        const formatted = new Intl.NumberFormat('ko-KR').format(Math.abs(value));
        return value < 0 ? `-${formatted}` : formatted;
    };

    // Excel 다운로드 (간단 구현)
    const handleExcelDownload = () => {
        alert('Excel 다운로드 기능은 실제 구현 시 추가됩니다.');
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 mb-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-3xl" />
                            <div>
                                <h1 className="text-2xl font-bold">세금계산서 거래장</h1>
                                <p className="text-emerald-100">주식회사 청연이엔지</p>
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
                    <div className="flex items-center gap-2 mb-4">
                        <FontAwesomeIcon icon={faFilter} className="text-gray-500" />
                        <h2 className="font-semibold">조회 조건</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {/* 연도 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">연도</label>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                {[2023, 2024, 2025].map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                        </div>

                        {/* 시작월 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">시작월</label>
                            <select
                                value={startMonth}
                                onChange={(e) => setStartMonth(Number(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>

                        {/* 종료월 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">종료월</label>
                            <select
                                value={endMonth}
                                onChange={(e) => setEndMonth(Number(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{m}월</option>
                                ))}
                            </select>
                        </div>

                        {/* 매출/매입 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">구분</label>
                            <select
                                value={transactionType}
                                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="전체">전체</option>
                                <option value="매출">매출</option>
                                <option value="매입">매입</option>
                            </select>
                        </div>

                        {/* 거래처 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">거래처</label>
                            <select
                                value={partnerFilter}
                                onChange={(e) => setPartnerFilter(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">전체</option>
                                {partners.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        {/* 팀 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">팀명</label>
                            <select
                                value={teamFilter}
                                onChange={(e) => setTeamFilter(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">전체</option>
                                {teams.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* 조회 버튼 */}
                        <div className="flex items-end">
                            <button className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                                <FontAwesomeIcon icon={faSearch} />
                                조회
                            </button>
                        </div>
                    </div>
                </div>

                {/* 요약 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">공급가액 합계</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    ₩{formatMoney(totals.supplyAmount)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faChartLine} className="text-blue-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">부가세 합계</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    ₩{formatMoney(totals.taxAmount)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faExchangeAlt} className="text-amber-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">총 합계</p>
                                <p className="text-2xl font-bold text-emerald-600">
                                    ₩{formatMoney(totals.totalAmount)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <FontAwesomeIcon icon={faWon} className="text-emerald-600 text-xl" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 테이블 */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <h3 className="font-semibold">
                            세금계산서 목록 ({filteredData.length}건)
                        </h3>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-500">
                            로딩 중...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-yellow-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">No</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">날짜</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">거래처명</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">현장명</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r">품목</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-r">공급가액</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-r">세액</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-r">합계</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r">구분</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">팀명</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((record, index) => (
                                        <tr key={record.id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-2 text-sm text-gray-600 border-r">{index + 1}</td>
                                            <td className="px-4 py-2 text-sm border-r">{record.date}</td>
                                            <td className="px-4 py-2 text-sm border-r">{record.partnerName}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600 border-r">{record.siteName || '-'}</td>
                                            <td className="px-4 py-2 text-sm border-r">{record.description}</td>
                                            <td className={`px-4 py-2 text-sm text-right border-r ${record.supplyAmount < 0 ? 'text-red-600' : ''}`}>
                                                {formatMoney(record.supplyAmount)}
                                            </td>
                                            <td className={`px-4 py-2 text-sm text-right border-r ${record.taxAmount < 0 ? 'text-red-600' : ''}`}>
                                                {formatMoney(record.taxAmount)}
                                            </td>
                                            <td className={`px-4 py-2 text-sm text-right font-medium border-r ${record.totalAmount < 0 ? 'text-red-600' : ''}`}>
                                                {formatMoney(record.totalAmount)}
                                            </td>
                                            <td className="px-4 py-2 text-center border-r">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.type === '매출'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {record.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-center">{record.teamName || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-green-100 font-semibold">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right border-r">합 계</td>
                                        <td className={`px-4 py-3 text-right border-r ${totals.supplyAmount < 0 ? 'text-red-600' : ''}`}>
                                            {formatMoney(totals.supplyAmount)}
                                        </td>
                                        <td className={`px-4 py-3 text-right border-r ${totals.taxAmount < 0 ? 'text-red-600' : ''}`}>
                                            {formatMoney(totals.taxAmount)}
                                        </td>
                                        <td className={`px-4 py-3 text-right border-r ${totals.totalAmount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                            {formatMoney(totals.totalAmount)}
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaxInvoiceLedgerPage;
