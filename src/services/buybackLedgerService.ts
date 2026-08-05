import { progressClaimService } from './progressClaimService';
import { supportClientSiteAllocationService } from './supportClientSiteAllocationService';
import type {
    ProgressAllocation,
    ProgressClaim,
    ProgressEvidenceStatus,
    ProgressPaymentStatus,
    ProgressSettlementMode,
} from '../types/progressClaim';
import type { SupportClientAllocation, SupportClientAllocationLine } from './supportClientSiteAllocationService';
import { calculateAllocations, toProgressNumber } from '../utils/progressClaimCalculations';
import {
    calculateBuybackSettlement,
    resolveProgressSettlementTargetId,
} from '../utils/buybackSettlement';

export type BuybackLedgerSource = 'progress_claim' | 'support_client_site';

export interface BuybackLedgerRow {
    id: string;
    source: BuybackLedgerSource;
    sourceLabel: string;
    yearMonth: string;
    siteKey: string;
    siteId?: string;
    siteName: string;
    clientCompanyId?: string;
    clientCompanyName?: string;
    /** Canonical reference used by settlement workflows. */
    settlementTargetId?: string;
    /** Legacy reference retained for existing screens and stored documents. */
    targetId?: string;
    targetName: string;
    targetType?: string;
    processType?: 'payable' | 'office_income' | 'memo';
    /** Backward-compatible alias for `grossAmount`. */
    amount: number;
    grossAmount: number;
    afterTaxAmount: number;
    taxAmount: number;
    settlementMode: ProgressSettlementMode;
    afterTaxRate: number;
    baseAmount: number;
    sourceAmount: number;
    method?: string;
    status?: string;
    paymentStatus: ProgressPaymentStatus;
    paidAmount: number;
    remainingAmount: number;
    paymentDueDate?: string;
    paidAt?: string;
    evidenceStatus: ProgressEvidenceStatus;
    paymentMemo?: string;
    memo?: string;
}

export interface BuybackLedgerBuildOptions {
    /** Working draft/review claims are excluded by default because this ledger feeds payout workbooks. */
    includeDraft?: boolean;
}

const toText = (value: unknown): string => String(value ?? '').trim();

const getSiteKey = (siteId: unknown, siteName: unknown): string =>
    toText(siteId) || toText(siteName).replace(/\s+/g, '').toLowerCase() || 'unknown-site';

const hasAllocationSnapshot = (claim: ProgressClaim): boolean =>
    claim.status !== 'draft' && Array.isArray(claim.confirmedSnapshot?.allocations);

const getProgressAllocationBaseAmount = (claim: ProgressClaim): number =>
    toProgressNumber(
        (hasAllocationSnapshot(claim) ? claim.confirmedSnapshot?.allocationBaseAmount : undefined) ??
        claim.distributionBaseAmount ??
        claim.confirmedSnapshot?.allocationBaseAmount ??
        claim.confirmedSnapshot?.buybackPoolAmount ??
        0
    );

const getProgressAllocationManDay = (claim: ProgressClaim): number =>
    toProgressNumber(claim.confirmedSnapshot?.totalManDay ?? 0);

const getProgressSourceAmount = (claim: ProgressClaim): number =>
    toProgressNumber(
        claim.confirmedSnapshot?.buybackPoolAmount ??
        claim.distributionBaseAmount ??
        0
    );

const getProgressClientCompanyId = (claim: ProgressClaim): string =>
    toText(claim.confirmedSnapshot?.site?.clientCompanyId || claim.siteSnapshot?.clientCompanyId);

const getProgressClientCompanyName = (claim: ProgressClaim): string =>
    toText(claim.confirmedSnapshot?.site?.clientCompanyName || claim.siteSnapshot?.clientCompanyName);

const mergePaymentState = (
    snapshotAllocation: ProgressAllocation,
    liveAllocation: ProgressAllocation | undefined
): ProgressAllocation => liveAllocation
    ? {
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
    }
    : snapshotAllocation;

const getProgressLedgerAllocations = (claim: ProgressClaim): ProgressAllocation[] => {
    const snapshotAllocations = claim.confirmedSnapshot?.allocations;
    if (!hasAllocationSnapshot(claim) || !snapshotAllocations) return claim.allocations;

    const liveById = new Map(claim.allocations.map((allocation) => [allocation.id, allocation]));
    return snapshotAllocations.map((allocation) => mergePaymentState(allocation, liveById.get(allocation.id)));
};

export const buildProgressRows = (
    claims: ProgressClaim[],
    options: BuybackLedgerBuildOptions = {}
): BuybackLedgerRow[] =>
    claims
        .filter((claim) => options.includeDraft || claim.status === 'confirmed' || claim.status === 'billed' || claim.status === 'paid')
        .flatMap((claim) => {
            const claimId = toText(claim.id) || `${claim.siteId}_${claim.yearMonth}`;
            const baseAmount = getProgressAllocationBaseAmount(claim);
            const manDay = getProgressAllocationManDay(claim);
            const sourceAmount = getProgressSourceAmount(claim);
            const rows = calculateAllocations(getProgressLedgerAllocations(claim), baseAmount, manDay);

            return rows
                .filter((row) => row.amount > 0)
                .map((row) => {
                    const allocation: ProgressAllocation = row.allocation;
                    const settlement = calculateBuybackSettlement(row.amount, allocation);
                    const siteName = toText(claim.confirmedSnapshot?.site?.siteName || claim.siteSnapshot?.siteName || claim.siteName) || '현장 미지정';
                    const siteKey = getSiteKey(claim.confirmedSnapshot?.site?.siteId || claim.siteSnapshot?.siteId || claim.siteId, siteName);
                    const targetType = toText(allocation.targetType) || 'other';
                    const settlementTargetId = resolveProgressSettlementTargetId(allocation);
                    const paymentStatus = allocation.paymentStatus || 'pending';
                    const storedPaidAmount = Math.max(0, Math.round(toProgressNumber(allocation.paidAmount)));
                    const paidAmount = paymentStatus === 'paid'
                        ? (allocation.paidAmount === undefined ? settlement.afterTaxAmount : storedPaidAmount)
                        : paymentStatus === 'partial' || paymentStatus === 'overpaid'
                            ? storedPaidAmount
                            : 0;

                    return {
                        id: `progress:${claimId}:${allocation.id}`,
                        source: 'progress_claim' as const,
                        sourceLabel: '기성관리',
                        yearMonth: claim.yearMonth,
                        siteKey,
                        siteId: toText(claim.confirmedSnapshot?.site?.siteId || claim.siteSnapshot?.siteId || claim.siteId) || undefined,
                        siteName,
                        clientCompanyId: getProgressClientCompanyId(claim) || undefined,
                        clientCompanyName: getProgressClientCompanyName(claim) || undefined,
                        settlementTargetId,
                        targetId: toText(allocation.targetId) || settlementTargetId,
                        targetName: toText(allocation.targetName) || (targetType === 'office_income' ? '사무실 수입' : '대상자 미지정'),
                        targetType,
                        processType: targetType === 'office_income' ? 'office_income' as const : 'payable' as const,
                        amount: settlement.grossAmount,
                        grossAmount: settlement.grossAmount,
                        afterTaxAmount: settlement.afterTaxAmount,
                        taxAmount: settlement.taxAmount,
                        settlementMode: settlement.settlementMode,
                        afterTaxRate: settlement.afterTaxRate,
                        baseAmount,
                        sourceAmount,
                        method: allocation.method,
                        status: claim.status,
                        paymentStatus,
                        paidAmount,
                        remainingAmount: Math.max(0, settlement.afterTaxAmount - paidAmount),
                        paymentDueDate: allocation.paymentDueDate,
                        paidAt: allocation.paidAt,
                        evidenceStatus: allocation.evidenceRequired && allocation.evidenceStatus === 'not_required'
                            ? 'pending'
                            : allocation.evidenceStatus || (allocation.evidenceRequired ? 'pending' : 'not_required'),
                        paymentMemo: toText(allocation.paymentMemo) || undefined,
                        memo: toText(allocation.memo) || toText(claim.buybackMemo) || undefined,
                    };
                });
        });

const getSupportLineSourceAmount = (allocation: SupportClientAllocation): number =>
    toProgressNumber(allocation.distributableAmount);

const resolveSupportSettlementTargetId = (line: SupportClientAllocationLine): string | undefined => {
    if (line.targetType !== 'client_contact' && line.targetType !== 'salesperson') return undefined;
    return toText(line.targetId) || undefined;
};

const getSupportPaymentStatus = (status: SupportClientAllocationLine['status']): ProgressPaymentStatus => {
    if (status === 'payment_pending') return 'scheduled';
    if (status === 'paid' || status === 'received') return 'paid';
    return 'pending';
};

export const buildSupportRows = (allocations: SupportClientAllocation[]): BuybackLedgerRow[] =>
    allocations.flatMap((allocation) => {
        const allocationId = toText(allocation.id) || `${allocation.yearMonth}_${allocation.siteKey}`;
        const siteName = toText(allocation.siteName) || '현장 미지정';
        const siteKey = getSiteKey(allocation.siteId || allocation.siteKey, siteName);
        const sourceAmount = getSupportLineSourceAmount(allocation);

        return (allocation.lines || [])
            .filter((line: SupportClientAllocationLine) => toProgressNumber(line.amount) > 0)
            .map((line: SupportClientAllocationLine) => {
                const grossAmount = Math.max(0, Math.round(toProgressNumber(line.amount)));
                const settlementTargetId = resolveSupportSettlementTargetId(line);
                const paymentStatus = getSupportPaymentStatus(line.status);
                const paidAmount = paymentStatus === 'paid' ? grossAmount : 0;
                return {
                    id: `support:${allocationId}:${line.id}`,
                    source: 'support_client_site' as const,
                    sourceLabel: '지원현장 차액',
                    yearMonth: allocation.yearMonth,
                    siteKey,
                    siteId: toText(allocation.siteId) || undefined,
                    siteName,
                    clientCompanyId: toText(allocation.clientCompanyId) || undefined,
                    clientCompanyName: toText(allocation.clientCompanyName) || undefined,
                    settlementTargetId,
                    targetId: toText(line.targetId) || undefined,
                    targetName: toText(line.targetName) || (line.targetType === 'office_income' ? '사무실 수입' : '대상자 미지정'),
                    targetType: toText(line.targetType) || 'other',
                    processType: line.processType || (line.targetType === 'office_income' ? 'office_income' : 'payable'),
                    amount: grossAmount,
                    grossAmount,
                    // Support allocations are already final amounts, so gross and after-tax are identical.
                    afterTaxAmount: grossAmount,
                    taxAmount: 0,
                    settlementMode: 'rate' as const,
                    afterTaxRate: 1,
                    baseAmount: toProgressNumber(allocation.distributableAmount),
                    sourceAmount,
                    method: 'direct',
                    status: line.status || allocation.status,
                    paymentStatus,
                    paidAmount,
                    remainingAmount: Math.max(0, grossAmount - paidAmount),
                    paymentDueDate: toText(line.dueDate) || undefined,
                    evidenceStatus: 'not_required' as const,
                    paymentMemo: toText(line.memo) || undefined,
                    memo: toText(line.memo) || undefined,
                };
            });
    });

const sortBuybackRows = (rows: BuybackLedgerRow[]): BuybackLedgerRow[] =>
    [...rows].sort((a, b) =>
        a.yearMonth.localeCompare(b.yearMonth) ||
        a.siteName.localeCompare(b.siteName, 'ko') ||
        a.targetName.localeCompare(b.targetName, 'ko') ||
        a.sourceLabel.localeCompare(b.sourceLabel, 'ko')
    );

/** Pure aggregation for progress claims across any number of months. */
export const buildBuybackLedgerRowsFromClaims = (
    claims: ProgressClaim[],
    options: BuybackLedgerBuildOptions = {}
): BuybackLedgerRow[] => sortBuybackRows(buildProgressRows(claims, options));

/** Pure combined aggregation used by the monthly service and unit tests. */
export const buildBuybackLedgerRows = (
    progressClaims: ProgressClaim[],
    supportAllocations: SupportClientAllocation[] = [],
    options: BuybackLedgerBuildOptions = {}
): BuybackLedgerRow[] => sortBuybackRows([
    ...buildProgressRows(progressClaims, options),
    ...buildSupportRows(supportAllocations),
]);

export const buybackLedgerService = {
    async getRowsByMonth(
        yearMonth: string,
        options: BuybackLedgerBuildOptions = {}
    ): Promise<BuybackLedgerRow[]> {
        const [progressClaims, supportAllocations] = await Promise.all([
            progressClaimService.getClaimsByMonth(yearMonth),
            supportClientSiteAllocationService.getAllocationsByMonth(yearMonth),
        ]);

        return buildBuybackLedgerRows(progressClaims, supportAllocations, options);
    },

    /** Loads all progress claims and builds payout-ledger rows across all months. */
    async getProgressRows(options: BuybackLedgerBuildOptions = {}): Promise<BuybackLedgerRow[]> {
        const progressClaims = await progressClaimService.getClaims();
        return buildBuybackLedgerRowsFromClaims(progressClaims, options);
    },
};
