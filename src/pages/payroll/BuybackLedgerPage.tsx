import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faCalendarAlt,
    faChevronRight,
    faCoins,
    faRotateRight,
    faSearch,
    faSpinner,
    faUserTie,
} from '@fortawesome/free-solid-svg-icons';
import { buybackLedgerService, BuybackLedgerRow, BuybackLedgerSource } from '../../services/buybackLedgerService';
import { formatProgressMoney, getCurrentYearMonth } from '../../utils/progressClaimCalculations';
import { toast } from '../../utils/swal';

type SourceFilter = 'all' | BuybackLedgerSource;
type TargetFilter = 'all' | 'office_income' | 'payable';

interface SiteGroup {
    key: string;
    siteName: string;
    clientCompanyName: string;
    rows: BuybackLedgerRow[];
    totalAmount: number;
    officeAmount: number;
    payableAmount: number;
}

const sourceLabels: Record<SourceFilter, string> = {
    all: '전체',
    progress_claim: '기성관리',
    support_client_site: '지원현장 차액',
};

const targetFilterLabels: Record<TargetFilter, string> = {
    all: '전체 대상',
    office_income: '사무실',
    payable: '정산 대상자',
};

const getTargetTypeLabel = (row: BuybackLedgerRow): string =>
    row.targetType === 'office_income' || row.processType === 'office_income'
        ? '사무실'
        : '정산 대상자';

const getStatusLabel = (status?: string): string => {
    if (status === 'confirmed') return '확정';
    if (status === 'payment_pending') return '지급예정';
    if (status === 'received') return '입금완료';
    if (status === 'review') return '검토중';
    if (status === 'billed') return '청구완료';
    if (status === 'paid') return '입금완료';
    if (status === 'draft') return '작성중';
    return status || '-';
};

const getMethodLabel = (method?: string): string => {
    if (method === 'fixed') return '고정금액';
    if (method === 'percent') return '비율';
    if (method === 'perManDay') return '공수당';
    if (method === 'manual') return '직접입력';
    if (method === 'direct') return '직접배분';
    return method || '-';
};

const getSourcePath = (source: BuybackLedgerSource): string =>
    source === 'progress_claim'
        ? '/payroll/progress-claims?tab=buyback'
        : '/payroll/support-client-site';

const BuybackLedgerPage: React.FC = () => {
    const navigate = useNavigate();
    const [yearMonth, setYearMonth] = useState(getCurrentYearMonth());
    const [rows, setRows] = useState<BuybackLedgerRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');

    const loadRows = async () => {
        setLoading(true);
        try {
            const nextRows = await buybackLedgerService.getRowsByMonth(yearMonth);
            setRows(nextRows);
        } catch (error) {
            console.error('[BuybackLedgerPage] load failed:', error);
            toast.error('바이백 내역을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [yearMonth]);

    const filteredRows = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return rows.filter((row) => {
            if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
            const isOffice = row.targetType === 'office_income' || row.processType === 'office_income';
            if (targetFilter === 'office_income' && !isOffice) return false;
            if (targetFilter === 'payable' && isOffice) return false;
            if (!query) return true;
            return [
                row.siteName,
                row.clientCompanyName,
                row.targetName,
                row.sourceLabel,
                row.memo,
            ].join(' ').toLowerCase().includes(query);
        });
    }, [rows, searchTerm, sourceFilter, targetFilter]);

    const siteGroups = useMemo<SiteGroup[]>(() => {
        const map = new Map<string, SiteGroup>();
        filteredRows.forEach((row) => {
            const key = row.siteKey || row.siteId || row.siteName;
            const group = map.get(key) || {
                key,
                siteName: row.siteName || '현장 미지정',
                clientCompanyName: row.clientCompanyName || '-',
                rows: [],
                totalAmount: 0,
                officeAmount: 0,
                payableAmount: 0,
            };
            const isOffice = row.targetType === 'office_income' || row.processType === 'office_income';
            group.rows.push(row);
            group.totalAmount += row.amount;
            if (isOffice) group.officeAmount += row.amount;
            else group.payableAmount += row.amount;
            map.set(key, group);
        });

        return Array.from(map.values())
            .map((group) => ({
                ...group,
                rows: [...group.rows].sort((a, b) =>
                    a.targetName.localeCompare(b.targetName, 'ko') ||
                    a.sourceLabel.localeCompare(b.sourceLabel, 'ko')
                ),
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount || a.siteName.localeCompare(b.siteName, 'ko'));
    }, [filteredRows]);

    const totals = useMemo(() => ({
        amount: filteredRows.reduce((sum, row) => sum + row.amount, 0),
        officeAmount: filteredRows
            .filter((row) => row.targetType === 'office_income' || row.processType === 'office_income')
            .reduce((sum, row) => sum + row.amount, 0),
        progressAmount: filteredRows
            .filter((row) => row.source === 'progress_claim')
            .reduce((sum, row) => sum + row.amount, 0),
        supportAmount: filteredRows
            .filter((row) => row.source === 'support_client_site')
            .reduce((sum, row) => sum + row.amount, 0),
        siteCount: siteGroups.length,
        targetCount: new Set(filteredRows.map((row) => `${row.targetType}:${row.targetId || row.targetName}`)).size,
    }), [filteredRows, siteGroups.length]);

    const metricCards = [
        { label: '총 바이백', value: `${formatProgressMoney(totals.amount)}원`, icon: faCoins, tone: 'text-slate-950' },
        { label: '사무실 수입', value: `${formatProgressMoney(totals.officeAmount)}원`, icon: faBuilding, tone: 'text-emerald-700' },
        { label: '기성관리', value: `${formatProgressMoney(totals.progressAmount)}원`, icon: faCalendarAlt, tone: 'text-indigo-700' },
        { label: '지원현장 차액', value: `${formatProgressMoney(totals.supportAmount)}원`, icon: faUserTie, tone: 'text-sky-700' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="text-xs font-black uppercase tracking-wide text-indigo-600">Buyback Ledger</div>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-black">
                        <FontAwesomeIcon icon={faCoins} className="text-indigo-600" />
                        현장별 바이백 정리
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        기성관리 바이백과 지원현장 차액 배분을 월별·현장별·대상자별로 모아 확인합니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadRows()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                >
                    <FontAwesomeIcon icon={loading ? faSpinner : faRotateRight} spin={loading} />
                    새로고침
                </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((card) => (
                    <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-black text-slate-500">{card.label}</div>
                            <FontAwesomeIcon icon={card.icon} className="text-slate-300" />
                        </div>
                        <div className={`mt-2 text-2xl font-black ${card.tone}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[180px_180px_180px_minmax(240px,1fr)]">
                    <label>
                        <span className="text-xs font-black text-slate-500">조회월</span>
                        <input
                            type="month"
                            value={yearMonth}
                            onChange={(event) => setYearMonth(event.target.value)}
                            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                        />
                    </label>
                    <label>
                        <span className="text-xs font-black text-slate-500">소스</span>
                        <select
                            value={sourceFilter}
                            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                        >
                            {Object.entries(sourceLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="text-xs font-black text-slate-500">대상</span>
                        <select
                            value={targetFilter}
                            onChange={(event) => setTargetFilter(event.target.value as TargetFilter)}
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                        >
                            {Object.entries(targetFilterLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="text-xs font-black text-slate-500">검색</span>
                        <div className="mt-1 flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                            <FontAwesomeIcon icon={faSearch} className="text-slate-400" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="현장, 발주사, 대상자 검색"
                                className="min-w-0 flex-1 text-sm outline-none"
                            />
                        </div>
                    </label>
                </div>
                <div className="mt-3 text-xs font-bold text-slate-500">
                    현장 {totals.siteCount.toLocaleString('ko-KR')}곳 · 대상 {totals.targetCount.toLocaleString('ko-KR')}개 · 내역 {filteredRows.length.toLocaleString('ko-KR')}건
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-12 text-center font-bold text-slate-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        바이백 내역을 불러오는 중입니다.
                    </div>
                ) : siteGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-12 text-center font-bold text-slate-400">
                        표시할 바이백 내역이 없습니다.
                    </div>
                ) : siteGroups.map((group) => (
                    <section key={group.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-black text-slate-950">{group.siteName}</h2>
                                <div className="mt-1 text-xs font-bold text-slate-500">
                                    {group.clientCompanyName || '-'} · 내역 {group.rows.length.toLocaleString('ko-KR')}건
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-right text-xs font-black md:min-w-[420px]">
                                <div>
                                    <div className="text-slate-400">합계</div>
                                    <div className="mt-1 text-base text-slate-950">{formatProgressMoney(group.totalAmount)}원</div>
                                </div>
                                <div>
                                    <div className="text-slate-400">사무실</div>
                                    <div className="mt-1 text-base text-emerald-700">{formatProgressMoney(group.officeAmount)}원</div>
                                </div>
                                <div>
                                    <div className="text-slate-400">대상자</div>
                                    <div className="mt-1 text-base text-indigo-700">{formatProgressMoney(group.payableAmount)}원</div>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1040px] text-sm">
                                <thead className="bg-slate-900 text-xs font-black text-white">
                                    <tr>
                                        <th className="px-3 py-3 text-left">월</th>
                                        <th className="px-3 py-3 text-left">소스</th>
                                        <th className="px-3 py-3 text-left">대상</th>
                                        <th className="px-3 py-3 text-left">구분</th>
                                        <th className="px-3 py-3 text-right">기준금액</th>
                                        <th className="px-3 py-3 text-right">바이백</th>
                                        <th className="px-3 py-3 text-left">방식/상태</th>
                                        <th className="px-3 py-3 text-left">메모</th>
                                        <th className="px-3 py-3 text-center">이동</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {group.rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-3 font-bold text-slate-600">{row.yearMonth}</td>
                                            <td className="px-3 py-3">
                                                <span className={`rounded-full px-2 py-1 text-xs font-black ${row.source === 'progress_claim' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'}`}>
                                                    {row.sourceLabel}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 font-black text-slate-900">{row.targetName}</td>
                                            <td className="px-3 py-3 text-slate-600">{getTargetTypeLabel(row)}</td>
                                            <td className="px-3 py-3 text-right font-mono text-slate-600">{formatProgressMoney(row.baseAmount)}</td>
                                            <td className="px-3 py-3 text-right font-mono font-black text-indigo-700">{formatProgressMoney(row.amount)}</td>
                                            <td className="px-3 py-3 text-slate-600">
                                                <div className="font-bold">{getMethodLabel(row.method)}</div>
                                                <div className="text-xs text-slate-400">{getStatusLabel(row.status)}</div>
                                            </td>
                                            <td className="px-3 py-3 text-slate-500">{row.memo || '-'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(getSourcePath(row.source))}
                                                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1 text-xs font-black text-slate-700 hover:bg-slate-100"
                                                >
                                                    열기
                                                    <FontAwesomeIcon icon={faChevronRight} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default BuybackLedgerPage;
