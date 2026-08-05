import type { SettlementTarget } from '../../../services/settlementTargetService';
import type { ProgressAllocation } from '../../../types/progressClaim';
import {
    buildProgressBuybackSiteRows,
    type ProgressBuybackSiteSource,
} from './ProgressBuybackSiteBoard';

const makeAllocation = (overrides: Partial<ProgressAllocation> = {}): ProgressAllocation => ({
    id: 'allocation-1',
    settlementTargetId: 'target-1',
    targetId: 'target-1',
    targetName: '김영업',
    targetType: 'salesperson',
    method: 'fixed',
    fixedAmount: 10_000,
    settlementMode: 'rate',
    paymentStatus: 'pending',
    evidenceStatus: 'not_required',
    ...overrides,
});

const makeSource = (overrides: Partial<ProgressBuybackSiteSource> = {}): ProgressBuybackSiteSource => ({
    siteId: 'site-1',
    siteName: '가평 현장',
    clientName: '보천토건',
    yearMonth: '2026-07',
    hasClaim: true,
    claimStatus: 'draft',
    financialsLocked: false,
    totalManDay: 10,
    currentAmount: 100_000,
    teamPositionAmount: 80_000,
    buybackPoolAmount: 20_000,
    allocationBaseAmount: 20_000,
    allocationAmount: 0,
    allocationRemainAmount: 20_000,
    allocationRows: [],
    ...overrides,
});

const targets: SettlementTarget[] = [
    {
        id: 'target-1',
        name: '김영업',
        targetType: 'salesperson',
        defaultProcessType: 'payable',
        defaultAfterTaxRate: 0.75,
        evidenceRequired: false,
        status: 'active',
    },
];

describe('buildProgressBuybackSiteRows', () => {
    it('keeps unallocated and not-yet-created sites visible as one row per site', () => {
        const rows = buildProgressBuybackSiteRows([
            makeSource(),
            makeSource({
                siteId: 'site-2',
                siteName: '가평 현장',
                hasClaim: false,
                buybackPoolAmount: 0,
                allocationBaseAmount: 0,
                allocationRemainAmount: 0,
            }),
        ], targets);

        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.siteId)).toEqual(['site-1', 'site-2']);
        expect(rows[0]).toMatchObject({ workflowStatus: 'allocation', buybackPoolAmount: 20_000 });
        expect(rows[1]).toMatchObject({ workflowStatus: 'not_started', targetCount: 0 });
    });

    it('separates office income from external payouts without duplicating the site buyback pool', () => {
        const personAllocation = makeAllocation({ paymentStatus: 'partial', paidAmount: 2_500 });
        const officeAllocation = makeAllocation({
            id: 'office-income',
            settlementTargetId: undefined,
            targetId: 'office_income',
            targetName: '사무실 수입',
            targetType: 'office_income',
            fixedAmount: 10_000,
        });
        const [row] = buildProgressBuybackSiteRows([
            makeSource({
                claimStatus: 'confirmed',
                financialsLocked: true,
                buybackPoolAmount: 20_000,
                allocationAmount: 20_000,
                allocationRemainAmount: 0,
                allocationRows: [
                    { allocation: personAllocation, amount: 10_000 },
                    { allocation: officeAllocation, amount: 10_000 },
                ],
            }),
        ], targets);

        expect(row).toMatchObject({
            buybackPoolAmount: 20_000,
            externalGrossAmount: 10_000,
            officeIncomeAmount: 10_000,
            afterTaxAmount: 7_500,
            taxAmount: 2_500,
            paidAmount: 2_500,
            unpaidAmount: 5_000,
            targetCount: 1,
            workflowStatus: 'paying',
        });
    });

    it('uses the locked compatibility rate and reports canonical-link and evidence issues', () => {
        const unresolvedAllocation = makeAllocation({
            settlementTargetId: undefined,
            targetId: 'missing-target',
            targetName: '과거 수기 대상',
            afterTaxRate: undefined,
            evidenceRequired: true,
            evidenceStatus: 'pending',
        });
        const [row] = buildProgressBuybackSiteRows([
            makeSource({
                claimStatus: 'confirmed',
                financialsLocked: true,
                allocationAmount: 20_000,
                allocationRemainAmount: 0,
                allocationRows: [{ allocation: unresolvedAllocation, amount: 20_000 }],
            }),
        ], targets);

        expect(row).toMatchObject({
            afterTaxAmount: 15_000,
            taxAmount: 5_000,
            unresolvedTargetCount: 1,
            evidencePendingCount: 1,
            workflowStatus: 'review',
        });
    });
});
