import { cardBillingService } from './cardBillingService';
import { cardFirestoreService } from './cardFirestoreService';
import { cardService } from './cardService';
import { manpowerService } from './manpowerService';
import { cardBillingLogService } from './cardBillingLogService';
import type { Card, CardAssignmentRecord, CardTransaction } from '../types/card';
import type { CardBillingDocument, CardBillingCostItem } from '../types/cardBilling';

jest.mock('./cardFirestoreService', () => ({
    cardFirestoreService: {
        getBillingById: jest.fn(),
        saveBilling: jest.fn(),
        replaceDraftBilling: jest.fn(),
        deleteDraftBillings: jest.fn(),
        deleteBilling: jest.fn(),
        getBillingsByMonth: jest.fn()
    }
}));

jest.mock('./cardBillingLogService', () => ({
    cardBillingLogService: {
        createLog: jest.fn()
    }
}));

jest.mock('./cardService', () => ({
    cardService: {
        getCards: jest.fn(),
        getTransactionsByCard: jest.fn(),
        getAssignmentHistory: jest.fn(),
        listAllCardBillingTargets: jest.fn()
    }
}));

jest.mock('./manpowerService', () => ({
    manpowerService: {
        getWorkers: jest.fn()
    }
}));

const mockedCardService = cardService as jest.Mocked<typeof cardService>;
const mockedManpowerService = manpowerService as jest.Mocked<typeof manpowerService>;
const mockedCardFirestoreService = cardFirestoreService as jest.Mocked<typeof cardFirestoreService>;
const mockedCardBillingLogService = cardBillingLogService as jest.Mocked<typeof cardBillingLogService>;

const baseCard: Card = {
    id: 'card-1',
    name: '법인카드',
    issuer: 'KB',
    cardType: 'CREDIT',
    last4: '1234',
    maskedNumber: '****-****-****-1234',
    status: 'ASSIGNED',
    currentAssigneeId: 'team-current',
    currentAssigneeType: 'TEAM',
    currentAssigneeName: '현재팀'
};

const buildTx = (id: string, date: string, amount: number): CardTransaction => ({
    id,
    cardId: baseCard.id,
    cardLabel: `${baseCard.name} (${baseCard.last4})`,
    date,
    yearMonth: date.slice(0, 7),
    merchant: `가맹점 ${id}`,
    category: 'OTHER',
    amount
});

describe('cardBillingService.generateAssignmentBillings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedCardService.listAllCardBillingTargets.mockResolvedValue([]);
        mockedManpowerService.getWorkers.mockResolvedValue([]);
    });

    it('does not charge a transaction outside known assignment history to the current assignee', async () => {
        const assignments: CardAssignmentRecord[] = [{
            id: 'assignment-1',
            cardId: baseCard.id,
            cardLabel: `${baseCard.name} (${baseCard.last4})`,
            assigneeId: 'team-a',
            assigneeType: 'TEAM',
            assigneeName: 'A팀',
            startDate: '2026-06-01',
            endDate: '2026-06-10'
        }];
        mockedCardService.getAssignmentHistory.mockResolvedValue(assignments);
        mockedCardService.getTransactionsByCard.mockResolvedValue([
            buildTx('tx-in-range', '2026-06-05', 10000),
            buildTx('tx-gap', '2026-06-20', 20000)
        ]);

        const billings = await cardBillingService.generateAssignmentBillings(baseCard, '2026-06');

        expect(billings).toHaveLength(1);
        expect(billings[0]).toMatchObject({
            teamId: 'team-a',
            teamName: 'A팀',
            totalAmount: 10000
        });
        expect(billings[0].lineItems.map((item) => item.id)).toEqual(['tx-in-range']);
    });

    it('keeps current-assignee fallback for legacy cards with no assignment history', async () => {
        mockedCardService.getAssignmentHistory.mockResolvedValue([]);
        mockedCardService.getTransactionsByCard.mockResolvedValue([
            buildTx('tx-legacy', '2026-06-20', 20000)
        ]);

        const billings = await cardBillingService.generateAssignmentBillings(baseCard, '2026-06');

        expect(billings).toHaveLength(1);
        expect(billings[0]).toMatchObject({
            teamId: 'team-current',
            teamName: '현재팀',
            totalAmount: 20000
        });
        expect(billings[0].lineItems.map((item) => item.id)).toEqual(['tx-legacy']);
    });

    it('ignores assignment rows with invalid end dates instead of treating them as open-ended', async () => {
        const assignments: CardAssignmentRecord[] = [{
            id: 'assignment-invalid-end',
            cardId: baseCard.id,
            cardLabel: `${baseCard.name} (${baseCard.last4})`,
            assigneeId: 'team-invalid',
            assigneeType: 'TEAM',
            assigneeName: 'Invalid team',
            startDate: '2026-05-01',
            endDate: '202605-12-02'
        }];
        mockedCardService.getAssignmentHistory.mockResolvedValue(assignments);
        mockedCardService.getTransactionsByCard.mockResolvedValue([
            buildTx('tx-after-invalid-end', '2026-06-20', 20000)
        ]);

        const billings = await cardBillingService.generateAssignmentBillings(baseCard, '2026-06');

        expect(billings).toHaveLength(0);
    });
});

const cardLineItem = (amount: number): CardBillingCostItem => ({
    id: 'fuel',
    label: 'fuel',
    amount,
    type: 'VARIABLE',
    category: 'FUEL',
    sourceType: 'card_ledger'
});

const buildBilling = (patch: Partial<CardBillingDocument> = {}): CardBillingDocument => ({
    id: 'card-1_team-1_team_none_2026-07',
    yearMonth: '2026-07',
    cardId: 'card-1',
    cardLabel: '법인카드 (1234)',
    teamId: 'team-1',
    teamName: 'A팀',
    issuedToType: 'team',
    variableCost: 1000,
    totalAmount: 1000,
    status: 'DRAFT',
    lineItems: [cardLineItem(1000)],
    statementAttachmentPaths: [],
    ...patch
});

describe('cardBillingService posted document protection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedCardFirestoreService.saveBilling.mockResolvedValue(undefined);
        mockedCardFirestoreService.replaceDraftBilling.mockResolvedValue(undefined);
        mockedCardFirestoreService.deleteDraftBillings.mockResolvedValue(undefined);
        mockedCardBillingLogService.createLog.mockResolvedValue({} as any);
    });

    it('blocks amount and line item changes on a CONFIRMED document', async () => {
        mockedCardFirestoreService.getBillingById.mockResolvedValue(buildBilling({ status: 'CONFIRMED' }));

        await expect(cardBillingService.saveBilling(buildBilling({
            variableCost: 2000,
            totalAmount: 2000,
            lineItems: [cardLineItem(2000)]
        }))).rejects.toThrow('card-billing-posted-modification-blocked');

        expect(mockedCardFirestoreService.saveBilling).not.toHaveBeenCalled();
    });

    it('allows the same amount and line item changes on a DRAFT document', async () => {
        mockedCardFirestoreService.getBillingById.mockResolvedValue(buildBilling({ status: 'DRAFT' }));

        await cardBillingService.saveBilling(buildBilling({
            variableCost: 2000,
            totalAmount: 2000,
            lineItems: [cardLineItem(2000)]
        }));

        expect(mockedCardFirestoreService.saveBilling).toHaveBeenCalledWith(expect.objectContaining({
            id: 'card-1_team-1_team_none_2026-07',
            variableCost: 2000,
            totalAmount: 2000,
            status: 'DRAFT',
            lineItems: [cardLineItem(2000)]
        }));
    });

    it('cancels confirmation only through the explicit API and writes reason metadata', async () => {
        mockedCardFirestoreService.getBillingById.mockResolvedValue(buildBilling({ status: 'CONFIRMED' }));

        await cardBillingService.cancelConfirmation('card-1_team-1_team_none_2026-07', {
            reason: 'duplicate entry',
            actorId: 'user-1',
            actorName: 'Manager'
        });

        expect(mockedCardFirestoreService.saveBilling).toHaveBeenCalledWith(expect.objectContaining({
            id: 'card-1_team-1_team_none_2026-07',
            status: 'DRAFT',
            confirmationCancelReason: 'duplicate entry',
            confirmationCancelledById: 'user-1',
            confirmationCancelledByName: 'Manager',
            confirmationCancelledAt: expect.any(Object)
        }));
        expect(mockedCardBillingLogService.createLog).toHaveBeenCalledWith(expect.objectContaining({
            action: 'updated',
            source: 'cardBillingService.cancelConfirmation',
            before: expect.objectContaining({ status: 'CONFIRMED' }),
            after: expect.objectContaining({
                status: 'DRAFT',
                confirmationCancelReason: 'duplicate entry'
            })
        }));
    });

    it('atomically replaces a DRAFT billing and removes stale legacy drafts', async () => {
        const next = buildBilling({ id: 'billing-row', totalAmount: 502750, variableCost: 502750 });
        mockedCardFirestoreService.getBillingById.mockImplementation(async (id: string) => (
            id === 'billing-legacy'
                ? buildBilling({ id, totalAmount: 1005500, variableCost: 1005500, status: 'DRAFT' })
                : null
        ));

        await cardBillingService.replaceDraftBilling(next, ['billing-legacy']);

        expect(mockedCardFirestoreService.replaceDraftBilling).toHaveBeenCalledWith(
            next,
            ['billing-legacy']
        );
        expect(mockedCardBillingLogService.createLog).toHaveBeenCalledWith(expect.objectContaining({
            action: 'created',
            after: expect.objectContaining({ id: 'billing-row', totalAmount: 502750 }),
            source: 'cardBillingService.replaceDraftBilling'
        }));
        expect(mockedCardBillingLogService.createLog).toHaveBeenCalledWith(expect.objectContaining({
            action: 'deleted',
            before: expect.objectContaining({ id: 'billing-legacy', totalAmount: 1005500 }),
            source: 'cardBillingService.replaceDraftBilling'
        }));
    });

    it('does not replace or delete a posted billing', async () => {
        mockedCardFirestoreService.getBillingById.mockImplementation(async (id: string) => (
            buildBilling({ id, status: id === 'billing-legacy' ? 'CONFIRMED' : 'DRAFT' })
        ));

        await expect(cardBillingService.replaceDraftBilling(
            buildBilling({ id: 'billing-row' }),
            ['billing-legacy']
        )).rejects.toThrow('card-billing-posted-replace-blocked');

        expect(mockedCardFirestoreService.replaceDraftBilling).not.toHaveBeenCalled();
    });

    it('deletes only DRAFT documents during zero-amount reconciliation', async () => {
        mockedCardFirestoreService.getBillingById.mockImplementation(async (id: string) => (
            id === 'draft-1'
                ? buildBilling({ id, status: 'DRAFT' })
                : buildBilling({ id, status: 'CANCELLED' })
        ));

        await cardBillingService.deleteDraftBillings(['draft-1', 'cancelled-1', 'draft-1']);

        expect(mockedCardFirestoreService.deleteDraftBillings).toHaveBeenCalledWith([
            'draft-1',
            'cancelled-1'
        ]);
        expect(mockedCardBillingLogService.createLog).toHaveBeenCalledTimes(1);
        expect(mockedCardBillingLogService.createLog).toHaveBeenCalledWith(expect.objectContaining({
            action: 'deleted',
            before: expect.objectContaining({ id: 'draft-1', status: 'DRAFT' }),
            source: 'cardBillingService.deleteDraftBillings'
        }));
    });

    it('blocks zero-amount deletion when any related document is posted', async () => {
        mockedCardFirestoreService.getBillingById.mockImplementation(async (id: string) => (
            buildBilling({ id, status: id === 'posted-1' ? 'PAID' : 'DRAFT' })
        ));

        await expect(cardBillingService.deleteDraftBillings([
            'draft-1',
            'posted-1'
        ])).rejects.toThrow('card-billing-posted-delete-blocked');

        expect(mockedCardFirestoreService.deleteDraftBillings).not.toHaveBeenCalled();
    });
});
