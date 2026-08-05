import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faCircleExclamation,
    faCoins,
    faDatabase,
    faMagnifyingGlass,
    faReceipt,
    faUserTie,
    faWallet,
} from '@fortawesome/free-solid-svg-icons';
import type {
    ProgressAllocation,
    ProgressClaim,
    ProgressEvidenceStatus,
    ProgressPaymentStatus,
    ProgressSettlementMode,
} from '../../../types/progressClaim';
import type { SettlementTarget } from '../../../services/settlementTargetService';
import {
    calculateAllocations,
    formatProgressMoney,
    toProgressNumber,
} from '../../../utils/progressClaimCalculations';
import {
    DEFAULT_BUYBACK_AFTER_TAX_RATE,
    calculateBuybackSettlement,
    resolveProgressSettlementTargetId,
} from '../../../utils/buybackSettlement';

type PeriodFilter = 'selected' | 'all';
type PaymentFilter = 'all' | ProgressPaymentStatus;

export interface ProgressBuybackWorkbookRow {
    id: string;
    claimId?: string;
    allocationId: string;
    yearMonth: string;
    siteId?: string;
    siteName: string;
    settlementTargetId?: string;
    settlementTargetResolved: boolean;
    targetName: string;
    targetType?: string;
    companyName?: string;
    grossAmount: number;
    afterTaxAmount: number;
    taxAmount: number;
    afterTaxRate: number;
    settlementMode: ProgressSettlementMode;
    paymentStatus: ProgressPaymentStatus;
    paidAmount: number;
    remainingAmount: number;
    paymentDueDate?: string;
    paidAt?: string;
    evidenceStatus: ProgressEvidenceStatus;
    memo?: string;
    paymentMemo?: string;
    claimStatus: ProgressClaim['status'];
}

interface ProgressBuybackWorkbookLedgerProps {
    claims: ProgressClaim[];
    targets: SettlementTarget[];
    selectedYearMonth: string;
    selectedSiteId?: string;
    selectedSiteName?: string;
    onOpenRow: (row: ProgressBuybackWorkbookRow) => void;
}

const PAYMENT_STATUS_LABELS: Record<ProgressPaymentStatus, string> = {
    pending: '미입금',
    needs_review: '정리 필요',
    calculating: '계산 중',
    retention: '보존 대기',
    scheduled: '입금 예정',
    in_progress: '입금 중',
    partial: '부분입금',
    paid: '입금 완료',
    hold: '보류',
    overpaid: '과입금',
    no_buyback: '바이백 없음',
    cancelled: '취소',
};

const PAYMENT_STATUS_STYLES: Record<ProgressPaymentStatus, string> = {
    pending: 'bg-rose-50 text-rose-700 ring-rose-100',
    needs_review: 'bg-lime-50 text-lime-800 ring-lime-200',
    calculating: 'bg-orange-50 text-orange-700 ring-orange-200',
    retention: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
    scheduled: 'bg-amber-50 text-amber-700 ring-amber-100',
    in_progress: 'bg-sky-50 text-sky-700 ring-sky-200',
    partial: 'bg-blue-50 text-blue-700 ring-blue-200',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    hold: 'bg-slate-100 text-slate-600 ring-slate-200',
    overpaid: 'bg-orange-100 text-orange-800 ring-orange-200',
    no_buyback: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
    cancelled: 'bg-slate-200 text-slate-500 ring-slate-300',
};

const SETTLEMENT_MODE_LABELS: Record<ProgressSettlementMode, string> = {
    rate: '비율 정산',
    taxInvoice: '계산서 전액',
    manual: '세후 직접입력',
};

const EVIDENCE_STATUS_LABELS: Record<ProgressEvidenceStatus, string> = {
    not_required: '선택',
    pending: '대기',
    received: '확인',
};

const OUTSTANDING_PAYMENT_STATUSES = new Set<ProgressPaymentStatus>([
    'pending',
    'needs_review',
    'calculating',
    'retention',
    'scheduled',
    'in_progress',
    'partial',
    'hold',
]);

const CLAIM_STATUS_LABELS: Record<ProgressClaim['status'], string> = {
    draft: '작성중',
    review: '검토중',
    confirmed: '확정',
    billed: '청구완료',
    paid: '입금완료',
};

const toText = (value: unknown): string => String(value ?? '').trim();

const getTargetKey = (row: Pick<ProgressBuybackWorkbookRow, 'settlementTargetId' | 'settlementTargetResolved'>): string =>
    row.settlementTargetResolved && row.settlementTargetId ? row.settlementTargetId : '__unresolved__';

const getWorkbookAllocations = (claim: ProgressClaim): ProgressAllocation[] => {
    const snapshotAllocations = claim.confirmedSnapshot?.allocations;
    if (!Array.isArray(snapshotAllocations)) return claim.allocations;

    const liveById = new Map(claim.allocations.map((allocation) => [allocation.id, allocation]));
    return snapshotAllocations.map((snapshotAllocation) => {
        const liveAllocation = liveById.get(snapshotAllocation.id);
        if (!liveAllocation) return snapshotAllocation;
        return {
            ...snapshotAllocation,
            settlementTargetId: liveAllocation.settlementTargetId,
            targetId: liveAllocation.targetId,
            targetName: liveAllocation.targetName,
            targetType: liveAllocation.targetType,
            companyName: liveAllocation.companyName,
            paymentStatus: liveAllocation.paymentStatus,
            paidAmount: liveAllocation.paidAmount,
            paymentDueDate: liveAllocation.paymentDueDate,
            paidAt: liveAllocation.paidAt,
            evidenceStatus: liveAllocation.evidenceStatus,
            paymentMemo: liveAllocation.paymentMemo,
        };
    });
};

const buildWorkbookRows = (
    claims: ProgressClaim[],
    targets: SettlementTarget[]
): ProgressBuybackWorkbookRow[] => {
    const targetById = new Map(
        targets
            .filter((target): target is SettlementTarget & { id: string } => Boolean(target.id))
            .map((target) => [target.id, target])
    );

    return claims.flatMap((claim) => {
        if (claim.status === 'draft' || claim.status === 'review') return [];

        const allocations = getWorkbookAllocations(claim);
        const baseAmount = toProgressNumber(
            claim.confirmedSnapshot?.allocationBaseAmount ??
            claim.distributionBaseAmount ??
            claim.confirmedSnapshot?.buybackPoolAmount ??
            0
        );
        const manDay = toProgressNumber(claim.confirmedSnapshot?.totalManDay ?? 0);

        return calculateAllocations(allocations, baseAmount, manDay)
            .filter(({ allocation, amount }) =>
                amount > 0 &&
                allocation.targetType !== 'office_income' &&
                allocation.targetId !== 'office_income'
            )
            .map(({ allocation, amount }) => {
                const settlementTargetId = resolveProgressSettlementTargetId(allocation);
                const target = settlementTargetId ? targetById.get(settlementTargetId) : undefined;
                const settlement = calculateBuybackSettlement(amount, {
                    settlementMode: allocation.settlementMode,
                    // Confirmed legacy rows must not change when a directory default changes later.
                    afterTaxRate: allocation.afterTaxRate ?? DEFAULT_BUYBACK_AFTER_TAX_RATE,
                    manualAfterTaxAmount: allocation.manualAfterTaxAmount,
                });
                const paymentStatus: ProgressPaymentStatus = allocation.paymentStatus || 'pending';
                const evidenceStatus: ProgressEvidenceStatus = allocation.evidenceRequired && allocation.evidenceStatus === 'not_required'
                    ? 'pending'
                    : allocation.evidenceStatus || (allocation.evidenceRequired ? 'pending' : 'not_required');
                const storedPaidAmount = Math.max(0, Math.round(toProgressNumber(allocation.paidAmount)));
                const paidAmount = paymentStatus === 'paid'
                    ? (allocation.paidAmount === undefined ? settlement.afterTaxAmount : storedPaidAmount)
                    : paymentStatus === 'partial' || paymentStatus === 'overpaid'
                        ? storedPaidAmount
                        : 0;

                return {
                    id: `progress:${claim.id || `${claim.siteId}_${claim.yearMonth}`}:${allocation.id}`,
                    claimId: claim.id,
                    allocationId: allocation.id,
                    yearMonth: claim.yearMonth,
                    siteId: claim.confirmedSnapshot?.site?.siteId || claim.siteSnapshot?.siteId || claim.siteId,
                    siteName: claim.confirmedSnapshot?.site?.siteName || claim.siteSnapshot?.siteName || claim.siteName || '현장 미지정',
                    settlementTargetId,
                    settlementTargetResolved: Boolean(target),
                    targetName: allocation.targetName || target?.name || '대상자 미지정',
                    targetType: allocation.targetType || target?.targetType,
                    companyName: allocation.companyName || target?.companyName,
                    grossAmount: settlement.grossAmount,
                    afterTaxAmount: settlement.afterTaxAmount,
                    taxAmount: settlement.taxAmount,
                    afterTaxRate: settlement.afterTaxRate,
                    settlementMode: settlement.settlementMode,
                    paymentStatus,
                    paidAmount,
                    remainingAmount: Math.max(0, settlement.afterTaxAmount - paidAmount),
                    paymentDueDate: allocation.paymentDueDate,
                    paidAt: allocation.paidAt?.slice(0, 10),
                    evidenceStatus,
                    memo: allocation.memo,
                    paymentMemo: allocation.paymentMemo,
                    claimStatus: claim.status,
                };
            });
    }).sort((a, b) =>
        b.yearMonth.localeCompare(a.yearMonth) ||
        a.targetName.localeCompare(b.targetName, 'ko') ||
        a.siteName.localeCompare(b.siteName, 'ko')
    );
};

const metricCard = (
    label: string,
    value: string,
    icon: typeof faCoins,
    tone: string
) => (
    <div className="border border-slate-500 bg-white shadow-none">
        <div className="flex items-center justify-between border-b border-slate-500 bg-slate-100 px-3 py-1.5">
            <span className="text-xs font-black text-slate-700">{label}</span>
            <FontAwesomeIcon icon={icon} className="text-slate-400" />
        </div>
        <div className={`bg-[#fff200] px-3 py-2 text-right font-mono text-lg font-black ${tone}`}>{value}</div>
    </div>
);

const ProgressBuybackWorkbookLedger: React.FC<ProgressBuybackWorkbookLedgerProps> = ({
    claims,
    targets,
    selectedYearMonth,
    selectedSiteId,
    selectedSiteName,
    onOpenRow,
}) => {
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('selected');
    const [targetFilter, setTargetFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const rows = useMemo(() => buildWorkbookRows(claims, targets), [claims, targets]);
    const selectedSiteRows = useMemo(
        () => rows.filter((row) => Boolean(selectedSiteId) && row.siteId === selectedSiteId),
        [rows, selectedSiteId]
    );

    useEffect(() => {
        setTargetFilter('all');
    }, [selectedSiteId]);

    const targetTabs = useMemo(() => {
        const rowTargetIds = new Set(selectedSiteRows
            .filter((row) => row.settlementTargetResolved)
            .map((row) => row.settlementTargetId)
            .filter(Boolean));
        const fromDirectory = targets
            .filter((target) =>
                target.status !== 'inactive' &&
                Boolean(target.id && rowTargetIds.has(target.id))
            )
            .map((target) => ({
                key: target.id || `name:${target.name}`,
                label: [target.name, target.positionTitle].filter(Boolean).join(' '),
            }));
        const knownKeys = new Set(fromDirectory.map((target) => target.key));
        const fromRows = selectedSiteRows
            .map((row) => ({
                key: getTargetKey(row),
                label: row.settlementTargetResolved ? row.targetName : '미연결',
            }))
            .filter((target, index, list) =>
                !knownKeys.has(target.key) && list.findIndex((item) => item.key === target.key) === index
            );

        return [...fromDirectory, ...fromRows].sort((a, b) => a.label.localeCompare(b.label, 'ko'));
    }, [selectedSiteRows, targets]);

    const filteredRows = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return selectedSiteRows.filter((row) => {
            if (periodFilter === 'selected' && row.yearMonth !== selectedYearMonth) return false;
            if (targetFilter !== 'all' && getTargetKey(row) !== targetFilter) return false;
            if (paymentFilter !== 'all' && row.paymentStatus !== paymentFilter) return false;
            if (!query) return true;
            return [
                row.targetName,
                row.companyName,
                row.siteName,
                row.memo,
                row.paymentMemo,
            ].map(toText).join(' ').toLowerCase().includes(query);
        });
    }, [paymentFilter, periodFilter, searchTerm, selectedSiteRows, selectedYearMonth, targetFilter]);

    const totals = useMemo(() => ({
        gross: filteredRows.reduce((sum, row) => sum + row.grossAmount, 0),
        afterTax: filteredRows.reduce((sum, row) => sum + row.afterTaxAmount, 0),
        tax: filteredRows.reduce((sum, row) => sum + row.taxAmount, 0),
        unpaid: filteredRows
            .filter((row) => OUTSTANDING_PAYMENT_STATUSES.has(row.paymentStatus))
            .reduce((sum, row) => sum + row.remainingAmount, 0),
        unresolved: filteredRows.filter((row) => !row.settlementTargetResolved).length,
    }), [filteredRows]);

    return (
        <section className="buyback-workbook-ledger overflow-hidden border-2 border-slate-800 bg-white shadow-none">
            <div className="border-b-2 border-slate-800 bg-white p-4 md:p-5">
                <div className="-mx-4 -mt-4 mb-4 border-b border-slate-800 bg-[#00b050] px-4 py-2 text-center text-sm font-black tracking-wide text-white md:-mx-5 md:px-5">
                    선택 현장 바이백 · 지급 / 증빙 대장
                </div>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">Selected Site Payment Detail</div>
                        <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-950">
                            <FontAwesomeIcon icon={faReceipt} className="text-violet-600" />
                            선택 현장 지급·증빙 대장
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {selectedSiteName || '선택 현장'}의 확정 바이백만 월별로 모아 대상자별 세전·세후·입금·증빙을 확인합니다.
                        </p>
                    </div>
                    <a
                        href="/database/manpower-db?tab=settlement-targets"
                        className="inline-flex items-center justify-center gap-2 border border-slate-700 bg-white px-4 py-2 text-sm font-black text-slate-800 hover:bg-[#fff200]"
                    >
                        <FontAwesomeIcon icon={faDatabase} />
                        정산 대상자 관리
                    </a>
                </div>

                <div className="mt-4 grid gap-0 border-l border-t border-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                    {metricCard('세전 바이백', `${formatProgressMoney(totals.gross)}원`, faCoins, 'text-slate-950')}
                    {metricCard('세후 지급액', `${formatProgressMoney(totals.afterTax)}원`, faWallet, 'text-emerald-700')}
                    {metricCard('세금/보류액', `${formatProgressMoney(totals.tax)}원`, faReceipt, 'text-amber-700')}
                    {metricCard('미입금 세후액', `${formatProgressMoney(totals.unpaid)}원`, faCircleExclamation, totals.unpaid > 0 ? 'text-rose-700' : 'text-slate-950')}
                </div>

                <div className="mt-4 overflow-x-auto pb-1">
                    <div className="flex min-w-max gap-2" aria-label="선택 현장 지급 대상 필터">
                        <button
                            type="button"
                            onClick={() => setTargetFilter('all')}
                            className={`rounded-lg border px-3 py-2 text-xs font-black ${targetFilter === 'all' ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                        >
                            전체 관계자
                        </button>
                        {targetTabs.map((target) => (
                            <button
                                key={target.key}
                                type="button"
                                onClick={() => setTargetFilter(target.key)}
                                className={`rounded-lg border px-3 py-2 text-xs font-black ${targetFilter === target.key ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                <FontAwesomeIcon icon={faUserTie} className="mr-1.5" />
                                {target.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-[180px_180px_minmax(260px,1fr)]">
                    <select
                        aria-label="바이백 조회 기간"
                        value={periodFilter}
                        onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                    >
                        <option value="selected">선택월 {selectedYearMonth}</option>
                        <option value="all">전체 기간</option>
                    </select>
                    <select
                        aria-label="바이백 입금 상태"
                        value={paymentFilter}
                        onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                    >
                        <option value="all">전체 입금상태</option>
                        {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="관계자, 회사, 비고 검색"
                            className="min-w-0 flex-1 text-sm outline-none"
                        />
                    </label>
                </div>

                {totals.unresolved > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5" />
                        정산대상자 ID가 연결되지 않은 과거 배분이 {totals.unresolved.toLocaleString('ko-KR')}건 있습니다. 이름만으로 자동 병합하지 말고 정산대상자에서 확인해 주세요.
                    </div>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="buyback-workbook-table w-full min-w-[1420px] border-collapse text-sm">
                    <thead className="sticky top-0 z-10 text-xs font-black text-white">
                        <tr>
                            <th className="bg-slate-800 px-3 py-3 text-center">청구월</th>
                            <th className="bg-slate-800 px-3 py-3 text-left">정산 대상자</th>
                            <th className="bg-slate-800 px-3 py-3 text-left">현장</th>
                            <th className="bg-violet-700 px-3 py-3 text-right">세전</th>
                            <th className="bg-emerald-700 px-3 py-3 text-right">세후</th>
                            <th className="bg-amber-600 px-3 py-3 text-right">세금</th>
                            <th className="bg-slate-700 px-3 py-3 text-left">정산 방식</th>
                            <th className="bg-slate-700 px-3 py-3 text-left">비고</th>
                            <th className="bg-teal-700 px-3 py-3 text-center">입금</th>
                            <th className="bg-teal-700 px-3 py-3 text-center">예정일</th>
                            <th className="bg-teal-700 px-3 py-3 text-center">입금일</th>
                            <th className="bg-sky-700 px-3 py-3 text-center">증빙</th>
                            <th className="bg-slate-900 px-3 py-3 text-center">원본</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredRows.map((row) => {
                            const isCurrentContext = row.yearMonth === selectedYearMonth && row.siteId === selectedSiteId;
                            return (
                                <tr key={row.id} className={isCurrentContext ? 'bg-violet-50' : 'hover:bg-slate-50'}>
                                    <td className="px-3 py-3 text-center font-black text-slate-700">{row.yearMonth}</td>
                                    <td className="px-3 py-3">
                                        <div className="font-black text-slate-950">{row.targetName}</div>
                                        <div className="mt-0.5 text-xs font-semibold text-slate-400">{row.companyName || row.targetType || '-'}</div>
                                        {!row.settlementTargetResolved && (
                                            <div className="mt-1 text-[11px] font-black text-amber-700">정산대상자 연결 재확인</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 font-bold text-slate-700">{row.siteName}</td>
                                    <td className="bg-violet-50/60 px-3 py-3 text-right font-mono font-black text-violet-800">{formatProgressMoney(row.grossAmount)}</td>
                                    <td className="bg-emerald-50/60 px-3 py-3 text-right font-mono font-black text-emerald-800">{formatProgressMoney(row.afterTaxAmount)}</td>
                                    <td className="bg-amber-50/60 px-3 py-3 text-right font-mono font-black text-amber-800">{formatProgressMoney(row.taxAmount)}</td>
                                    <td className="px-3 py-3 text-slate-600">
                                        <div className="font-bold">{SETTLEMENT_MODE_LABELS[row.settlementMode]}</div>
                                        {row.settlementMode === 'rate' && <div className="text-xs text-slate-400">세후 {(row.afterTaxRate * 100).toFixed(1)}%</div>}
                                    </td>
                                    <td className="max-w-[320px] px-3 py-3 text-slate-600">
                                        <div className="truncate" title={[row.memo, row.paymentMemo].filter(Boolean).join(' / ')}>
                                            {[row.memo, row.paymentMemo].filter(Boolean).join(' / ') || '-'}
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${PAYMENT_STATUS_STYLES[row.paymentStatus]}`}>
                                            {PAYMENT_STATUS_LABELS[row.paymentStatus]}
                                        </span>
                                        <div className="mt-1 text-[11px] font-bold text-slate-400">{CLAIM_STATUS_LABELS[row.claimStatus]}</div>
                                        <div className="mt-1 text-[11px] font-black text-slate-600">입금 {formatProgressMoney(row.paidAmount)}</div>
                                        {row.remainingAmount > 0 && (
                                            <div className="text-[11px] font-black text-rose-600">잔액 {formatProgressMoney(row.remainingAmount)}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-center font-semibold text-slate-600">{row.paymentDueDate || '-'}</td>
                                    <td className="px-3 py-3 text-center font-semibold text-slate-600">{row.paidAt || '-'}</td>
                                    <td className="px-3 py-3 text-center text-xs font-black text-slate-600">{EVIDENCE_STATUS_LABELS[row.evidenceStatus]}</td>
                                    <td className="px-3 py-3 text-center">
                                        <button
                                            type="button"
                                            disabled={!row.siteId}
                                            onClick={() => onOpenRow(row)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            열기
                                            <FontAwesomeIcon icon={faArrowRight} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredRows.length === 0 && (
                            <tr>
                                <td colSpan={13} className="px-4 py-14 text-center">
                                    <div className="font-black text-slate-500">선택 현장의 확정 바이백 지급 내역이 없습니다.</div>
                                    <div className="mt-1 text-xs font-semibold text-slate-400">위 배분표에서 관계자를 연결하고 저장·확정하면 이 현장의 지급 이력에 표시됩니다.</div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-500">
                {selectedSiteName || '선택 현장'} · {filteredRows.length.toLocaleString('ko-KR')}건 · 작성·검토중 문서는 지급 대장에서 제외 · 정산대상자 ID로 연결
            </div>
        </section>
    );
};

export default ProgressBuybackWorkbookLedger;
