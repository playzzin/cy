import type { Card } from '../types/card';
import { cardFirestoreService } from './cardFirestoreService';
import { cardService } from './cardService';

jest.mock('./cardFirestoreService', () => ({
    cardFirestoreService: {
        getCard: jest.fn(),
        assignCard: jest.fn(),
        saveCardAssignment: jest.fn(),
        saveCardBillingTarget: jest.fn(),
        applyCardBillingTargetChanges: jest.fn(),
        transitionCardLifecycle: jest.fn(),
    },
}));

const mockedFirestore = cardFirestoreService as jest.Mocked<typeof cardFirestoreService>;

const buildCard = (status: Card['status']): Card => ({
    id: 'card-3909',
    name: '김진민팀 - 김민',
    issuer: '국민카드',
    cardType: 'CREDIT',
    last4: '3909',
    maskedNumber: '****-****-****-3909',
    status,
});
const restoreAuditLog = {
    resourceType: 'card' as const,
    resourceId: 'card-3909',
    resourceLabel: '김진민팀 - 김민',
    reason: 'OTHER' as const,
    reasonLabel: '카드 정지 해제',
    processedDate: '2026-08-19',
    statusBefore: 'SUSPENDED',
    statusAfter: 'AVAILABLE',
    note: '분실 카드 정지 해제',
};

describe('cardService inactive-card guards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedFirestore.assignCard.mockResolvedValue(undefined);
        mockedFirestore.saveCardBillingTarget.mockResolvedValue(undefined);
        mockedFirestore.applyCardBillingTargetChanges.mockResolvedValue(undefined);
        mockedFirestore.transitionCardLifecycle.mockResolvedValue({
            changed: true,
            statusBefore: 'SUSPENDED',
            statusAfter: 'AVAILABLE',
            operationId: 'restore-op',
            closedAssignmentCount: 1,
            closedBillingTargetCount: 1,
        });
    });

    it.each(['SUSPENDED', 'CLOSED'] as const)('blocks assigning a %s card before any write', async (status) => {
        mockedFirestore.getCard.mockResolvedValue(buildCard(status));

        await expect(cardService.assignCard('card-3909', 'team-1', 'TEAM', '김진민팀', '2026-08-19'))
            .rejects.toThrow('inactive-card-operation-blocked');
        expect(mockedFirestore.assignCard).not.toHaveBeenCalled();
    });

    it('blocks a billing upsert for an inactive card', async () => {
        mockedFirestore.getCard.mockResolvedValue(buildCard('SUSPENDED'));

        await expect(cardService.applyCardBillingTargetChanges({
            cardId: 'card-3909',
            upserts: [{
                id: 'target-1',
                cardId: 'card-3909',
                cardLabel: '김진민팀 - 김민 (3909)',
                targetId: 'team-1',
                targetType: 'TEAM',
                targetName: '김진민팀',
                startDate: '2026-08-19',
            }],
        })).rejects.toThrow('inactive-card-operation-blocked');
        expect(mockedFirestore.applyCardBillingTargetChanges).not.toHaveBeenCalled();
    });

    it('rejects a billing upsert whose card does not match the command parent', async () => {
        await expect(cardService.applyCardBillingTargetChanges({
            cardId: 'card-3909',
            upserts: [{
                id: 'target-1',
                cardId: 'another-card',
                cardLabel: '다른 카드',
                targetId: 'team-1',
                targetType: 'TEAM',
                targetName: '김진민팀',
                startDate: '2026-08-19',
            }],
        })).rejects.toThrow('billing-target-card-mismatch');

        expect(mockedFirestore.getCard).not.toHaveBeenCalled();
        expect(mockedFirestore.applyCardBillingTargetChanges).not.toHaveBeenCalled();
    });

    it('allows cleanup-only billing changes for an inactive card', async () => {
        await cardService.applyCardBillingTargetChanges({
            cardId: 'card-3909',
            closeRecords: [{ id: 'target-1', endDate: '2026-05-19' }],
            deleteIds: ['future-target'],
            clearSnapshot: true,
        });

        expect(mockedFirestore.getCard).not.toHaveBeenCalled();
        expect(mockedFirestore.applyCardBillingTargetChanges).toHaveBeenCalledWith(expect.objectContaining({
            cardId: 'card-3909',
            clearSnapshot: true,
        }));
    });

    it('blocks restoring a non-null billing snapshot on an inactive card', async () => {
        mockedFirestore.getCard.mockResolvedValue(buildCard('SUSPENDED'));

        await expect(cardService.applyCardBillingTargetChanges({
            cardId: 'card-3909',
            deleteIds: ['old-target'],
            snapshot: {
                targetId: 'team-1',
                targetType: 'TEAM',
                targetName: '김진민팀',
                startDate: '2026-01-01',
                endDate: '2026-05-19',
            },
        })).rejects.toThrow('inactive-card-operation-blocked');
        expect(mockedFirestore.applyCardBillingTargetChanges).not.toHaveBeenCalled();
    });

    it.each(['AVAILABLE', 'CLOSED'] as const)('refuses restore from %s at the facade boundary', async (status) => {
        mockedFirestore.getCard.mockResolvedValue(buildCard(status));

        await expect(cardService.restoreSuspendedCard({
            cardId: 'card-3909',
            effectiveDate: '2026-08-19',
            operationId: 'restore-op',
            auditLog: restoreAuditLog,
        })).rejects.toThrow('card-restore-requires-suspended-status');
        expect(mockedFirestore.transitionCardLifecycle).not.toHaveBeenCalled();
    });

    it('delegates a suspended restore as one lifecycle command', async () => {
        mockedFirestore.getCard.mockResolvedValue(buildCard('SUSPENDED'));

        await cardService.restoreSuspendedCard({
            cardId: 'card-3909',
            effectiveDate: '2026-08-19',
            operationId: 'restore-op',
            auditLog: restoreAuditLog,
        });

        expect(mockedFirestore.transitionCardLifecycle).toHaveBeenCalledTimes(1);
        expect(mockedFirestore.transitionCardLifecycle).toHaveBeenCalledWith({
            cardId: 'card-3909',
            effectiveDate: '2026-08-19',
            operationId: 'restore-op',
            targetStatus: 'AVAILABLE',
            auditLog: restoreAuditLog,
        });
    });
});
