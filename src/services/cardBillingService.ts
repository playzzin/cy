import { cardFirestoreService } from './cardFirestoreService';
import { CardBillingDocument, CardBillingIssuedToType } from '../types/cardBilling';
import { Card, cardService } from './cardService';
import { Timestamp } from '../types/timestamp';

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

        const assignedTeamId = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeId : undefined;
        const assignedTeamName = card.currentAssigneeType === 'TEAM' ? card.currentAssigneeName : undefined;

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
        // cardFirestoreService에 deleteBilling이 누락되었다면 여기서 docRef.delete() 호출 혹은 추가
        await cardFirestoreService.saveBilling({ id, status: 'DRAFT' } as any); // 임시 (실제 삭제 로직 구현 권장)
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
