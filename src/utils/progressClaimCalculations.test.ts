import type { ProgressClaim, ProgressClaimLine } from '../types/progressClaim';
import { calculateProgressClaimSummary } from './progressClaimCalculations';

const makeClaim = (yearMonth: string, progressLines: ProgressClaimLine[]): ProgressClaim => ({
    siteId: 'site-1',
    siteName: '테스트 현장',
    yearMonth,
    status: 'draft',
    progressLines,
    allocations: [],
    claimAttachments: [],
    vatMode: 'none',
    vatRate: 0.1,
    showAllocationsOnInvoice: false,
    showAttachmentsOnInvoice: true,
});

describe('progressClaimCalculations', () => {
    it('carries remaining extra progress metadata into later sparse claim lines', () => {
        const previousClaim = makeClaim('2026-05', [{
            itemId: 'extra-1',
            source: 'extra',
            category: '추가',
            workName: '잔여 추가 기성',
            workType: '설치',
            contractQuantity: 10,
            unit: 'm',
            unitPrice: 100,
            currentQuantity: 4,
            memo: '이월 대상',
        }]);
        const currentClaim = makeClaim('2026-06', [{
            itemId: 'extra-1',
            source: 'extra',
            currentQuantity: 3,
        }]);

        const result = calculateProgressClaimSummary(
            undefined,
            [previousClaim],
            currentClaim,
            undefined,
            '2026-06'
        );
        const row = result.itemRows.find((item) => item.item.id === 'extra-1');

        expect(row?.item.workName).toBe('잔여 추가 기성');
        expect(row?.item.contractQuantity).toBe(10);
        expect(row?.item.unitPrice).toBe(100);
        expect(row?.previousQuantity).toBe(4);
        expect(row?.currentQuantity).toBe(3);
        expect(row?.remainingQuantity).toBe(3);
        expect(row?.remainingAmount).toBe(300);
        expect(result.summary.remainingAmount).toBe(300);
    });
});
