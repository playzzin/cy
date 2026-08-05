jest.mock('./progressClaimService', () => ({
    progressClaimService: {
        getClaims: jest.fn(),
        getClaimsByMonth: jest.fn(),
    },
}));

jest.mock('./supportClientSiteAllocationService', () => ({
    supportClientSiteAllocationService: {
        getAllocationsByMonth: jest.fn(),
    },
}));

import type { ProgressAllocation, ProgressClaim, ProgressClaimSnapshot } from '../types/progressClaim';
import type { SupportClientAllocation } from './supportClientSiteAllocationService';
import { buildProgressRows, buildSupportRows } from './buybackLedgerService';

const makeAllocation = (overrides: Partial<ProgressAllocation> = {}): ProgressAllocation => ({
    id: 'allocation-1',
    targetId: 'legacy-target-1',
    targetName: '홍길동',
    targetType: 'client_contact',
    method: 'fixed',
    fixedAmount: 10_000,
    ...overrides,
});

const makeClaim = (overrides: Partial<ProgressClaim> = {}): ProgressClaim => ({
    id: 'claim-1',
    siteId: 'site-1',
    siteName: '테스트 현장',
    yearMonth: '2026-07',
    status: 'confirmed',
    progressLines: [],
    allocations: [makeAllocation()],
    claimAttachments: [],
    vatMode: 'none',
    vatRate: 0.1,
    showAllocationsOnInvoice: false,
    showAttachmentsOnInvoice: true,
    distributionBaseAmount: 10_000,
    ...overrides,
});

const makeSnapshot = (allocations: ProgressAllocation[]): ProgressClaimSnapshot => ({
    site: { siteId: 'site-1', siteName: '테스트 현장' },
    contractItems: [],
    progressLines: [],
    allocations,
    totalManDay: 10,
    contractAmount: 10_000,
    previousAmount: 0,
    currentAmount: 10_000,
    cumulativeAmount: 10_000,
    remainingAmount: 0,
    sukumiUnitPrice: 1_000,
    buybackPoolAmount: 10_000,
    allocationBaseAmount: 10_000,
    allocationRemainAmount: 0,
    supplyAmount: 10_000,
    vatAmount: 0,
    billingAmount: 10_000,
    allocationAmount: 10_000,
    confirmedAt: '2026-07-31T00:00:00.000Z',
});

describe('buybackLedgerService pure builders', () => {
    it('excludes draft and review claims by default and can include working claims explicitly', () => {
        const draft = makeClaim({ status: 'draft' });
        const review = makeClaim({ id: 'claim-review', status: 'review' });

        expect(buildProgressRows([draft, review])).toHaveLength(0);
        expect(buildProgressRows([draft, review], { includeDraft: true })).toHaveLength(2);
    });

    it('uses the legacy non-office target id as the canonical id and calculates settlement amounts', () => {
        const [row] = buildProgressRows([makeClaim({
            allocations: [makeAllocation({ afterTaxRate: 75 })],
        })]);

        expect(row).toMatchObject({
            settlementTargetId: 'legacy-target-1',
            targetId: 'legacy-target-1',
            amount: 10_000,
            grossAmount: 10_000,
            afterTaxAmount: 7_500,
            taxAmount: 2_500,
            settlementMode: 'rate',
            afterTaxRate: 0.75,
            paymentStatus: 'pending',
            evidenceStatus: 'not_required',
        });
    });

    it('calculates the remaining payout from cumulative actual payments', () => {
        const [partialRow] = buildProgressRows([makeClaim({
            allocations: [makeAllocation({
                afterTaxRate: 0.75,
                paymentStatus: 'partial',
                paidAmount: 2_500,
            })],
        })]);
        const [paidRow] = buildProgressRows([makeClaim({
            allocations: [makeAllocation({
                afterTaxRate: 0.75,
                paymentStatus: 'paid',
            })],
        })]);

        expect(partialRow).toMatchObject({ paidAmount: 2_500, remainingAmount: 5_000 });
        expect(paidRow).toMatchObject({ paidAmount: 7_500, remainingAmount: 0 });
    });

    it('uses confirmed allocation amounts while overlaying live payment state', () => {
        const snapshotAllocation = makeAllocation({ fixedAmount: 10_000, paymentStatus: 'pending' });
        const liveAllocation = makeAllocation({ fixedAmount: 99_000, paymentStatus: 'paid' });
        const claim = makeClaim({
            allocations: [liveAllocation],
            confirmedSnapshot: makeSnapshot([snapshotAllocation]),
        });

        const [row] = buildProgressRows([claim]);

        expect(row.grossAmount).toBe(10_000);
        expect(row.paymentStatus).toBe('paid');
    });

    it('allows live payment metadata to clear values captured in the confirmation snapshot', () => {
        const snapshotAllocation = makeAllocation({
            fixedAmount: 10_000,
            paymentStatus: 'scheduled',
            paymentDueDate: '2026-07-31',
            paidAt: '2026-07-30T00:00:00.000Z',
            evidenceStatus: 'received',
            paymentMemo: '기존 메모',
        });
        const liveAllocation = makeAllocation({ fixedAmount: 99_000 });
        const claim = makeClaim({
            allocations: [liveAllocation],
            confirmedSnapshot: makeSnapshot([snapshotAllocation]),
        });

        const [row] = buildProgressRows([claim]);

        expect(row.grossAmount).toBe(10_000);
        expect(row.paymentStatus).toBe('pending');
        expect(row.paymentDueDate).toBeUndefined();
        expect(row.paidAt).toBeUndefined();
        expect(row.evidenceStatus).toBe('not_required');
        expect(row.paymentMemo).toBeUndefined();
    });

    it('uses a live canonical relink while retaining confirmed financial values', () => {
        const snapshotAllocation = makeAllocation({
            targetId: 'legacy-missing-target',
            targetName: '과거 수기명',
            fixedAmount: 10_000,
        });
        const liveAllocation = makeAllocation({
            settlementTargetId: 'target-real',
            targetId: 'target-real',
            targetName: '정산대상자 이름',
            targetType: 'salesperson',
            fixedAmount: 99_000,
        });
        const claim = makeClaim({
            allocations: [liveAllocation],
            confirmedSnapshot: makeSnapshot([snapshotAllocation]),
        });

        const [row] = buildProgressRows([claim]);

        expect(row.grossAmount).toBe(10_000);
        expect(row.settlementTargetId).toBe('target-real');
        expect(row.targetName).toBe('정산대상자 이름');
        expect(row.targetType).toBe('salesperson');
    });

    it('treats support amounts as fully after-tax and only canonicalizes supported person types', () => {
        const supportAllocation = {
            id: 'support-1',
            yearMonth: '2026-07',
            siteKey: 'site-1',
            siteId: 'site-1',
            siteName: '테스트 현장',
            issuedAmount: 20_000,
            settlementAmount: 0,
            distributableAmount: 20_000,
            allocatedAmount: 20_000,
            status: 'balanced',
            lines: [
                {
                    id: 'support-line-1',
                    targetId: 'person-1',
                    targetName: '영업사원',
                    targetType: 'salesperson',
                    amount: 10_000,
                    processType: 'payable',
                    status: 'paid',
                },
                {
                    id: 'support-line-2',
                    targetId: 'other-1',
                    targetName: '기타',
                    targetType: 'other',
                    amount: 10_000,
                    processType: 'payable',
                    status: 'confirmed',
                },
            ],
        } as SupportClientAllocation;

        const rows = buildSupportRows([supportAllocation]);

        expect(rows[0]).toMatchObject({
            settlementTargetId: 'person-1',
            grossAmount: 10_000,
            afterTaxAmount: 10_000,
            taxAmount: 0,
            afterTaxRate: 1,
            paymentStatus: 'paid',
        });
        expect(rows[1].settlementTargetId).toBeUndefined();
    });
});
