import { cardFirestoreService } from './cardFirestoreService';
import { CardBillingDocument, CardBillingIssuedToType } from '../types/cardBilling';
import { Card, cardService } from './cardService';
import { Timestamp } from '../types/timestamp';
import { manpowerService } from './manpowerService';

/**
 * CardBillingService - Firestore 통합 버전
 * 모든 요청을 cardFirestoreService로 위임하거나 Firestore 데이터를 기반으로 처리합니다.
 */
export const cardBillingService = {
    buildBillingDocumentId: (params: {
        cardId: string;
        teamId: string;
        issuedToType: CardBillingIssuedToType;
        workerId?: string;
        yearMonth: string;
    }): string => {
        const workerPart = params.workerId ? params.workerId : 'none';
        return `${params.cardId}_${params.teamId}_${params.issuedToType}_${workerPart}_${params.yearMonth}`;
    },

    generateBilling: async (card: Card, yearMonth: string): Promise<CardBillingDocument> => {
        const transactions = await cardService.getTransactionsByCard(card.id, yearMonth);

        const lineItems = transactions.map((tx) => ({
            id: tx.id,
            label: `${tx.merchant || 'Unknown'} - ${tx.date}`,
            amount: tx.amount,
            type: 'VARIABLE' as const,
            category: tx.category
        }));

        const variableCost = lineItems.reduce((acc, it) => acc + (it.amount || 0), 0);

        let assignedTeamId = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeId : undefined;
        let assignedTeamName = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeName : undefined;

        if (card.currentAssigneeType === 'WORKER' && card.currentAssigneeId) {
            try {
                const workers = await manpowerService.getWorkers();
                const worker = workers.find((w) => (
                    String(w.id ?? '') === String(card.currentAssigneeId) ||
                    String(w.legacyId ?? '') === String(card.currentAssigneeId)
                ));
                assignedTeamId = worker?.teamId || assignedTeamId;
                assignedTeamName = worker?.teamName || assignedTeamName;
            } catch (error) {
                console.warn('Failed to resolve card assignee team for billing:', error);
            }
        }

        const issuedToType: CardBillingIssuedToType | undefined =
            card.currentAssigneeType === 'TEAM'
                ? 'team'
                : card.currentAssigneeType === 'WORKER'
                    ? 'worker'
                    : undefined;

        const billingId = cardBillingService.buildBillingDocumentId({
            cardId: card.id,
            teamId: assignedTeamId || 'unassigned',
            issuedToType: issuedToType || 'team',
            workerId: issuedToType === 'worker' ? card.currentAssigneeId : undefined,
            yearMonth
        });

        return {
            id: billingId,
            yearMonth,
            cardId: card.id,
            cardLabel: `${card.name} (${card.last4})`,
            assignedTeamId,
            assignedTeamName,
            teamId: assignedTeamId,
            teamName: assignedTeamName,
            issuedToType,
            issuedToWorkerId: issuedToType === 'worker' ? (card.currentAssigneeId ?? undefined) : undefined,
            issuedToWorkerName: issuedToType === 'team'
                ? (assignedTeamName ?? undefined)
                : issuedToType === 'worker'
                    ? (card.currentAssigneeName ?? undefined)
                    : undefined,
            variableCost,
            totalAmount: variableCost,
            status: 'DRAFT',
            lineItems,
            statementAttachmentPaths: [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    },

    saveBilling: async (billing: CardBillingDocument): Promise<void> => {
        await cardFirestoreService.saveBilling(billing);
    },

    deleteBilling: async (id: string): Promise<void> => {
        await cardFirestoreService.deleteBilling(id);
    },

    getBillingsByMonth: async (yearMonth: string): Promise<CardBillingDocument[]> => {
        return cardFirestoreService.getBillingsByMonth(yearMonth);
    },

    generateMonthlyBillings: async (yearMonth: string): Promise<CardBillingDocument[]> => {
        const cards = await cardService.getCards();
        const promises = cards.map((c) => cardBillingService.generateBilling(c, yearMonth));
        return Promise.all(promises);
    }
};
