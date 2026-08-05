import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRight,
    faCalculator,
    faDatabase,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import type { SettlementTarget } from '../../../services/settlementTargetService';
import type {
    ProgressAllocationCalculatedRow,
    ProgressClaimStatus,
    ProgressPaymentStatus,
} from '../../../types/progressClaim';
import {
    DEFAULT_BUYBACK_AFTER_TAX_RATE,
    calculateBuybackSettlement,
    resolveProgressSettlementTargetId,
} from '../../../utils/buybackSettlement';
import { formatProgressMoney, formatProgressQuantity, toProgressNumber } from '../../../utils/progressClaimCalculations';

export type ProgressBuybackWorkflowStatus =
    | 'not_started'
    | 'calculation'
    | 'no_buyback'
    | 'allocation'
    | 'review'
    | 'confirmation'
    | 'payment'
    | 'paying'
    | 'complete';

export interface ProgressBuybackSiteSource {
    siteId: string;
    siteName: string;
    clientName: string;
    yearMonth: string;
    hasClaim: boolean;
    claimStatus: ProgressClaimStatus;
    financialsLocked: boolean;
    totalManDay: number;
    currentAmount: number;
    teamPositionAmount: number;
    buybackPoolAmount: number;
    allocationBaseAmount: number;
    allocationAmount: number;
    allocationRemainAmount: number;
    allocationRows: ProgressAllocationCalculatedRow[];
}

export interface ProgressBuybackSiteRow extends ProgressBuybackSiteSource {
    workflowStatus: ProgressBuybackWorkflowStatus;
    targetCount: number;
    unresolvedTargetCount: number;
    evidencePendingCount: number;
    officeIncomeAmount: number;
    externalGrossAmount: number;
    afterTaxAmount: number;
    taxAmount: number;
    paidAmount: number;
    unpaidAmount: number;
}

interface ProgressBuybackSiteBoardProps {
    rows: ProgressBuybackSiteRow[];
    selectedSiteId?: string;
    selectedClientName?: string;
    selectedYearMonth: string;
    onSelectSite: (siteId: string) => void;
    onOpenCalculation: () => void;
    onOpenAllocation: () => void;
}

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

const CLAIM_STATUS_LABELS: Record<ProgressClaimStatus, string> = {
    draft: '작성중',
    review: '검토중',
    confirmed: '확정',
    billed: '청구완료',
    paid: '입금완료',
};

const WORKFLOW_STATUS_META: Record<ProgressBuybackWorkflowStatus, { label: string; className: string }> = {
    not_started: { label: '미작성', className: 'bg-slate-100 text-slate-600' },
    calculation: { label: '산정 필요', className: 'bg-orange-100 text-orange-800' },
    no_buyback: { label: '바이백 없음', className: 'bg-slate-100 text-slate-600' },
    allocation: { label: '배분 필요', className: 'bg-violet-100 text-violet-800' },
    review: { label: '검토 필요', className: 'bg-rose-100 text-rose-800' },
    confirmation: { label: '확정 대기', className: 'bg-amber-100 text-amber-800' },
    payment: { label: '지급 예정', className: 'bg-sky-100 text-sky-800' },
    paying: { label: '지급 중', className: 'bg-blue-100 text-blue-800' },
    complete: { label: '완료', className: 'bg-[#fff200] text-slate-950' },
};

const isOfficeIncome = (row: ProgressAllocationCalculatedRow): boolean =>
    row.allocation.targetType === 'office_income' || row.allocation.targetId === 'office_income';

const resolvePaidAmount = (
    paymentStatus: ProgressPaymentStatus,
    storedPaidAmount: unknown,
    afterTaxAmount: number
): number => {
    const paidAmount = Math.max(0, Math.round(toProgressNumber(storedPaidAmount)));
    if (paymentStatus === 'paid') {
        return storedPaidAmount === undefined ? afterTaxAmount : paidAmount;
    }
    if (paymentStatus === 'partial' || paymentStatus === 'overpaid') return paidAmount;
    return 0;
};

const resolveWorkflowStatus = (
    source: ProgressBuybackSiteSource,
    totals: Pick<ProgressBuybackSiteRow, 'unresolvedTargetCount' | 'evidencePendingCount' | 'afterTaxAmount' | 'paidAmount' | 'unpaidAmount'>
): ProgressBuybackWorkflowStatus => {
    if (!source.hasClaim) return 'not_started';
    if (source.buybackPoolAmount <= 0) {
        return source.claimStatus === 'draft' || source.claimStatus === 'review' ? 'calculation' : 'no_buyback';
    }
    if (source.allocationRemainAmount < 0) return 'review';
    if (source.allocationRemainAmount > 0) return 'allocation';
    if (totals.unresolvedTargetCount > 0 || totals.evidencePendingCount > 0) return 'review';
    if (totals.afterTaxAmount > 0 && totals.unpaidAmount > 0) {
        return totals.paidAmount > 0 ? 'paying' : 'payment';
    }
    if (source.claimStatus === 'draft' || source.claimStatus === 'review') return 'confirmation';
    return 'complete';
};

export const buildProgressBuybackSiteRows = (
    sources: ProgressBuybackSiteSource[],
    targets: SettlementTarget[]
): ProgressBuybackSiteRow[] => {
    const targetById = new Map(
        targets
            .filter((target): target is SettlementTarget & { id: string } => Boolean(target.id))
            .map((target) => [target.id, target])
    );

    return sources.map((source) => {
        const targetKeys = new Set<string>();
        let unresolvedTargetCount = 0;
        let evidencePendingCount = 0;
        let officeIncomeAmount = 0;
        let externalGrossAmount = 0;
        let afterTaxAmount = 0;
        let taxAmount = 0;
        let paidAmount = 0;
        let unpaidAmount = 0;

        source.allocationRows.forEach((calculatedRow) => {
            const amount = Math.max(0, Math.round(toProgressNumber(calculatedRow.amount)));
            if (amount <= 0) return;
            if (isOfficeIncome(calculatedRow)) {
                officeIncomeAmount += amount;
                return;
            }

            const allocation = calculatedRow.allocation;
            const settlementTargetId = resolveProgressSettlementTargetId(allocation);
            const target = settlementTargetId ? targetById.get(settlementTargetId) : undefined;
            const targetKey = settlementTargetId || `allocation:${allocation.id}`;
            targetKeys.add(targetKey);
            if (!target) unresolvedTargetCount += 1;

            const settlement = calculateBuybackSettlement(amount, {
                settlementMode: allocation.settlementMode,
                afterTaxRate: allocation.afterTaxRate ?? (
                    source.financialsLocked
                        ? DEFAULT_BUYBACK_AFTER_TAX_RATE
                        : target?.defaultAfterTaxRate
                ),
                manualAfterTaxAmount: allocation.manualAfterTaxAmount,
            });
            const paymentStatus: ProgressPaymentStatus = allocation.paymentStatus || 'pending';
            const actualPaidAmount = resolvePaidAmount(paymentStatus, allocation.paidAmount, settlement.afterTaxAmount);

            externalGrossAmount += settlement.grossAmount;
            afterTaxAmount += settlement.afterTaxAmount;
            taxAmount += settlement.taxAmount;
            paidAmount += actualPaidAmount;
            if (OUTSTANDING_PAYMENT_STATUSES.has(paymentStatus)) {
                unpaidAmount += Math.max(0, settlement.afterTaxAmount - actualPaidAmount);
            }
            if (allocation.evidenceRequired && allocation.evidenceStatus !== 'received') {
                evidencePendingCount += 1;
            }
        });

        const totals = {
            unresolvedTargetCount,
            evidencePendingCount,
            afterTaxAmount,
            paidAmount,
            unpaidAmount,
        };

        return {
            ...source,
            ...totals,
            workflowStatus: resolveWorkflowStatus(source, totals),
            targetCount: targetKeys.size,
            officeIncomeAmount,
            externalGrossAmount,
            taxAmount,
        };
    });
};

const numberCell = (value: number) => formatProgressMoney(value);

const ProgressBuybackSiteBoard: React.FC<ProgressBuybackSiteBoardProps> = ({
    rows,
    selectedSiteId,
    selectedClientName,
    selectedYearMonth,
    onSelectSite,
    onOpenCalculation,
    onOpenAllocation,
}) => {
    const selectedRow = rows.find((row) => row.siteId === selectedSiteId) || rows[0];
    const totals = useMemo(() => rows.reduce((sum, row) => ({
        buybackPoolAmount: sum.buybackPoolAmount + row.buybackPoolAmount,
        externalGrossAmount: sum.externalGrossAmount + row.externalGrossAmount,
        officeIncomeAmount: sum.officeIncomeAmount + row.officeIncomeAmount,
        allocationRemainAmount: sum.allocationRemainAmount + row.allocationRemainAmount,
        afterTaxAmount: sum.afterTaxAmount + row.afterTaxAmount,
        paidAmount: sum.paidAmount + row.paidAmount,
    }), {
        buybackPoolAmount: 0,
        externalGrossAmount: 0,
        officeIncomeAmount: 0,
        allocationRemainAmount: 0,
        afterTaxAmount: 0,
        paidAmount: 0,
    }), [rows]);

    const summaryCells = [
        ['관리 현장', `${rows.length.toLocaleString('ko-KR')}개`],
        ['바이백', numberCell(totals.buybackPoolAmount)],
        ['세전 배분', numberCell(totals.externalGrossAmount)],
        ['세후', numberCell(totals.afterTaxAmount)],
        ['입금', numberCell(totals.paidAmount)],
        ['사무실 귀속', numberCell(totals.officeIncomeAmount)],
        ['미배분', numberCell(totals.allocationRemainAmount)],
    ];

    return (
        <section data-testid="buyback-site-board" className="buyback-excel-sheet overflow-x-auto border-2 border-slate-800 bg-white shadow-none">
            <div className="min-w-[1510px] font-['Malgun_Gothic',Arial,sans-serif] text-[13px] text-slate-900">
                <div className="flex h-6 border-b border-slate-500 bg-[#e7e6e6] text-center text-[11px] font-bold text-slate-500">
                    <span className="w-10 border-r border-slate-500 py-1">#</span>
                    {'ABCDEFGHIJKLM'.split('').map((column) => (
                        <span key={column} className="flex-1 border-r border-slate-300 py-1 last:border-r-0">{column}</span>
                    ))}
                </div>

                <div className="grid grid-cols-[40px_1fr] border-b border-slate-800">
                    <div className="border-r border-slate-800 bg-[#e7e6e6] py-3 text-center text-xs font-bold text-slate-500">1</div>
                    <div className="bg-[#00b050] px-5 py-3 text-center text-lg font-black tracking-wide text-white">
                        {selectedClientName ? `${selectedClientName} · ` : ''}{selectedYearMonth} 현장 바이백
                    </div>
                </div>

                <div className="grid grid-cols-[40px_1fr] border-b border-slate-800">
                    <div className="border-r border-slate-800 bg-[#e7e6e6] py-3 text-center text-xs font-bold text-slate-500">2</div>
                    <table className="w-full border-collapse">
                        <tbody>
                            <tr>
                                {summaryCells.map(([label, value], index) => (
                                    <React.Fragment key={label}>
                                        <td className={`border-r border-slate-700 bg-slate-100 px-2 py-2 text-center text-xs font-black ${index === summaryCells.length - 1 ? '' : ''}`}>{label}</td>
                                        <td className={`border-r border-slate-700 bg-[#fff200] px-3 py-2 text-right font-mono text-sm font-black ${index === summaryCells.length - 1 ? 'border-r-0' : ''} ${label === '미배분' && totals.allocationRemainAmount !== 0 ? 'text-rose-700' : 'text-slate-950'}`}>{value}</td>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-[40px_1fr] border-b border-slate-800">
                    <div className="border-r border-slate-800 bg-[#e7e6e6] py-2 text-center text-xs font-bold text-slate-500">3</div>
                    <div className="flex items-center justify-between gap-3 bg-white px-3 py-2">
                        <div className="font-bold text-slate-600">현장별 바이백 현황 · 노란색은 원본 엑셀의 집계/입금 표시 방식입니다.</div>
                        <div className="flex items-center gap-0">
                            <a
                                href="/database/manpower-db?tab=settlement-targets"
                                className="inline-flex items-center gap-1.5 border border-slate-700 bg-white px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-100"
                            >
                                <FontAwesomeIcon icon={faDatabase} /> 정산 대상자
                            </a>
                            <button type="button" onClick={onOpenCalculation} className="inline-flex items-center gap-1.5 border border-l-0 border-slate-700 bg-[#fff200] px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-yellow-300">
                                <FontAwesomeIcon icon={faCalculator} /> 바이백 산정
                            </button>
                            <button type="button" onClick={onOpenAllocation} className="inline-flex items-center gap-1.5 border border-l-0 border-slate-700 bg-[#00b050] px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700">
                                <FontAwesomeIcon icon={faUsers} /> 관계자 배분
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-[40px_1fr]">
                    <div className="border-r border-slate-800 bg-[#e7e6e6] text-center text-xs font-bold text-slate-500">4</div>
                    <table className="w-full border-collapse text-[13px]">
                        <thead className="text-center text-xs font-black text-slate-950">
                            <tr className="bg-[#f2f2f2]">
                                {['No.', '기간', '현장', '공수', '바이백', '세전', '세후', '세금', '비고', '입금', '진행 상태', '산정', '배분', '관리'].map((header) => (
                                    <th key={header} className="border-b border-r border-slate-800 px-2 py-2.5 last:border-r-0">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => {
                                const isSelected = row.siteId === selectedSiteId;
                                const workflow = WORKFLOW_STATUS_META[row.workflowStatus];
                                const issues = [
                                    row.unresolvedTargetCount > 0 ? `대상자 미연결 ${row.unresolvedTargetCount}` : '',
                                    row.evidencePendingCount > 0 ? `증빙 대기 ${row.evidencePendingCount}` : '',
                                    row.allocationRemainAmount !== 0 ? `미배분 ${numberCell(row.allocationRemainAmount)}` : '',
                                ].filter(Boolean);

                                return (
                                    <tr key={`${row.siteId}:${row.yearMonth}`} data-testid={`buyback-site-row-${row.siteId}`} className={isSelected ? 'bg-[#d9eaf7]' : 'bg-white hover:bg-slate-50'}>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-center font-mono">{index + 1}</td>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-center font-mono">{row.yearMonth}</td>
                                        <td className="border-b border-r border-slate-500 px-3 py-2">
                                            <div className="font-black">{row.siteName}</div>
                                            <div className="text-[11px] text-slate-500">{row.clientName}</div>
                                        </td>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-right font-mono">{formatProgressQuantity(row.totalManDay)}</td>
                                        <td className="border-b border-r border-slate-500 bg-[#e2f0d9] px-2 py-2 text-right font-mono font-black">{numberCell(row.buybackPoolAmount)}</td>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-right font-mono">{numberCell(row.externalGrossAmount)}</td>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-right font-mono">{numberCell(row.afterTaxAmount)}</td>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-right font-mono">{numberCell(row.taxAmount)}</td>
                                        <td className={`border-b border-r border-slate-500 px-2 py-2 text-left text-[11px] font-bold ${issues.length ? 'text-red-600' : 'text-slate-400'}`}>{issues.join(' · ') || '-'}</td>
                                        <td className="border-b border-r border-slate-500 bg-[#fff200] px-2 py-2 text-right font-mono font-black">{numberCell(row.paidAmount)}</td>
                                        <td className="border-b border-r border-slate-500 px-2 py-2 text-center">
                                            <span className={`inline-block px-2 py-1 text-xs font-black ${workflow.className}`}>{workflow.label}</span>
                                            <div className="mt-1 text-[10px] font-bold text-slate-500">{row.hasClaim ? CLAIM_STATUS_LABELS[row.claimStatus] : '미작성'}</div>
                                        </td>
                                        <td className="border-b border-r border-slate-500 p-1.5 text-center">
                                            <button type="button" onClick={onOpenCalculation} className="border border-slate-700 bg-white px-2 py-1 text-[11px] font-black hover:bg-[#fff200]">산정</button>
                                        </td>
                                        <td className="border-b border-r border-slate-500 p-1.5 text-center">
                                            <button type="button" onClick={onOpenAllocation} className="border border-slate-700 bg-white px-2 py-1 text-[11px] font-black hover:bg-[#e2f0d9]">배분</button>
                                        </td>
                                        <td className="border-b border-r-0 border-slate-500 p-1.5 text-center">
                                            <button
                                                type="button"
                                                aria-current={isSelected ? 'true' : undefined}
                                                onClick={() => onSelectSite(row.siteId)}
                                                className={`inline-flex items-center gap-1 border border-slate-700 px-2 py-1 text-[11px] font-black ${isSelected ? 'bg-[#00b050] text-white' : 'bg-white text-slate-800 hover:bg-slate-100'}`}
                                            >
                                                {isSelected ? '선택됨' : '선택'} <FontAwesomeIcon icon={faArrowRight} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="border-b border-slate-500 px-4 py-14 text-center font-bold text-slate-500">표시할 현장이 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot className="font-black">
                                <tr className="bg-[#fff200]">
                                    <td colSpan={3} className="border-r border-t border-slate-800 px-3 py-2 text-center">합계</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-right font-mono">{formatProgressQuantity(rows.reduce((sum, row) => sum + row.totalManDay, 0))}</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-right font-mono">{numberCell(totals.buybackPoolAmount)}</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-right font-mono">{numberCell(totals.externalGrossAmount)}</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-right font-mono">{numberCell(totals.afterTaxAmount)}</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-right font-mono">{numberCell(rows.reduce((sum, row) => sum + row.taxAmount, 0))}</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-center">대상자 {rows.reduce((sum, row) => sum + row.targetCount, 0)}명</td>
                                    <td className="border-r border-t border-slate-800 px-2 py-2 text-right font-mono">{numberCell(totals.paidAmount)}</td>
                                    <td colSpan={4} className="border-t border-slate-800 px-3 py-2 text-left">미배분 {numberCell(totals.allocationRemainAmount)} · 사무실 귀속 {numberCell(totals.officeIncomeAmount)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {selectedRow && (
                    <div className="grid grid-cols-[40px_1fr] border-t border-slate-800">
                        <div className="border-r border-slate-800 bg-[#e7e6e6] py-2 text-center text-xs font-bold text-slate-500">{rows.length + 5}</div>
                        <div className="grid grid-cols-6 divide-x divide-slate-500 bg-white text-xs">
                            {[
                                ['선택 현장', selectedRow.siteName],
                                ['기성 금액', numberCell(selectedRow.currentAmount)],
                                ['팀장 직책', numberCell(selectedRow.teamPositionAmount)],
                                ['배분 기준', numberCell(selectedRow.allocationBaseAmount)],
                                ['미입금', numberCell(selectedRow.unpaidAmount)],
                                ['정산 대상자', `${selectedRow.targetCount}명`],
                            ].map(([label, value]) => (
                                <div key={label} className="min-w-0">
                                    <div className="border-b border-slate-500 bg-slate-100 px-2 py-1 text-center font-black">{label}</div>
                                    <div className="truncate px-2 py-2 text-right font-mono font-black">{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default ProgressBuybackSiteBoard;
