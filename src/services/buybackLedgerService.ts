import { progressClaimService } from './progressClaimService';
import { supportClientSiteAllocationService } from './supportClientSiteAllocationService';
import type { ProgressAllocation, ProgressClaim } from '../types/progressClaim';
import type { SupportClientAllocation, SupportClientAllocationLine } from './supportClientSiteAllocationService';
import { calculateAllocations, toProgressNumber } from '../utils/progressClaimCalculations';

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
    targetId?: string;
    targetName: string;
    targetType?: string;
    processType?: 'payable' | 'office_income' | 'memo';
    amount: number;
    baseAmount: number;
    sourceAmount: number;
    method?: string;
    status?: string;
    memo?: string;
}

const toText = (value: unknown): string => String(value ?? '').trim();

const getSiteKey = (siteId: unknown, siteName: unknown): string =>
    toText(siteId) || toText(siteName).replace(/\s+/g, '').toLowerCase() || 'unknown-site';

const getProgressAllocationBaseAmount = (claim: ProgressClaim): number =>
    toProgressNumber(
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
    toText(claim.siteSnapshot?.clientCompanyId || claim.confirmedSnapshot?.site?.clientCompanyId);

const getProgressClientCompanyName = (claim: ProgressClaim): string =>
    toText(claim.siteSnapshot?.clientCompanyName || claim.confirmedSnapshot?.site?.clientCompanyName);

const buildProgressRows = (claims: ProgressClaim[]): BuybackLedgerRow[] =>
    claims.flatMap((claim) => {
        const claimId = toText(claim.id) || `${claim.siteId}_${claim.yearMonth}`;
        const baseAmount = getProgressAllocationBaseAmount(claim);
        const manDay = getProgressAllocationManDay(claim);
        const sourceAmount = getProgressSourceAmount(claim);
        const rows = calculateAllocations(claim.allocations, baseAmount, manDay);

        return rows
            .filter((row) => row.amount > 0)
            .map((row) => {
                const allocation: ProgressAllocation = row.allocation;
                const siteName = toText(claim.siteName || claim.siteSnapshot?.siteName || claim.confirmedSnapshot?.site?.siteName) || '현장 미지정';
                const siteKey = getSiteKey(claim.siteId || claim.siteSnapshot?.siteId, siteName);
                const targetType = toText(allocation.targetType) || 'other';

                return {
                    id: `progress:${claimId}:${allocation.id}`,
                    source: 'progress_claim' as const,
                    sourceLabel: '기성관리',
                    yearMonth: claim.yearMonth,
                    siteKey,
                    siteId: toText(claim.siteId || claim.siteSnapshot?.siteId) || undefined,
                    siteName,
                    clientCompanyId: getProgressClientCompanyId(claim) || undefined,
                    clientCompanyName: getProgressClientCompanyName(claim) || undefined,
                    targetId: toText(allocation.targetId) || undefined,
                    targetName: toText(allocation.targetName) || (targetType === 'office_income' ? '사무실 수입' : '대상자 미지정'),
                    targetType,
                    processType: targetType === 'office_income' ? 'office_income' as const : 'payable' as const,
                    amount: row.amount,
                    baseAmount,
                    sourceAmount,
                    method: allocation.method,
                    status: claim.status,
                    memo: toText(allocation.memo) || toText(claim.buybackMemo) || undefined,
                };
            });
    });

const getSupportLineSourceAmount = (allocation: SupportClientAllocation): number =>
    toProgressNumber(allocation.distributableAmount);

const buildSupportRows = (allocations: SupportClientAllocation[]): BuybackLedgerRow[] =>
    allocations.flatMap((allocation) => {
        const allocationId = toText(allocation.id) || `${allocation.yearMonth}_${allocation.siteKey}`;
        const siteName = toText(allocation.siteName) || '현장 미지정';
        const siteKey = getSiteKey(allocation.siteId || allocation.siteKey, siteName);
        const sourceAmount = getSupportLineSourceAmount(allocation);

        return (allocation.lines || [])
            .filter((line: SupportClientAllocationLine) => toProgressNumber(line.amount) > 0)
            .map((line: SupportClientAllocationLine) => ({
                id: `support:${allocationId}:${line.id}`,
                source: 'support_client_site' as const,
                sourceLabel: '지원현장 차액',
                yearMonth: allocation.yearMonth,
                siteKey,
                siteId: toText(allocation.siteId) || undefined,
                siteName,
                clientCompanyId: toText(allocation.clientCompanyId) || undefined,
                clientCompanyName: toText(allocation.clientCompanyName) || undefined,
                targetId: toText(line.targetId) || undefined,
                targetName: toText(line.targetName) || (line.targetType === 'office_income' ? '사무실 수입' : '대상자 미지정'),
                targetType: toText(line.targetType) || 'other',
                processType: line.processType || (line.targetType === 'office_income' ? 'office_income' : 'payable'),
                amount: toProgressNumber(line.amount),
                baseAmount: toProgressNumber(allocation.distributableAmount),
                sourceAmount,
                method: 'direct',
                status: line.status || allocation.status,
                memo: toText(line.memo) || undefined,
            }));
    });

export const buybackLedgerService = {
    async getRowsByMonth(yearMonth: string): Promise<BuybackLedgerRow[]> {
        const [progressClaims, supportAllocations] = await Promise.all([
            progressClaimService.getClaimsByMonth(yearMonth),
            supportClientSiteAllocationService.getAllocationsByMonth(yearMonth),
        ]);

        return [...buildProgressRows(progressClaims), ...buildSupportRows(supportAllocations)]
            .sort((a, b) =>
                a.siteName.localeCompare(b.siteName, 'ko') ||
                a.targetName.localeCompare(b.targetName, 'ko') ||
                a.sourceLabel.localeCompare(b.sourceLabel, 'ko')
            );
    },
};
