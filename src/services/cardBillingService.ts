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
        let workers: Awaited<ReturnType<typeof manpowerService.getWorkers>> = [];

        try {
            workers = await manpowerService.getWorkers();
        } catch (error) {
            console.warn('Failed to resolve card worker data for billing:', error);
        }

        const findWorker = (workerId?: string) => {
            if (!workerId) return undefined;
            return workers.find((w) => (
                String(w.id ?? '') === String(workerId) ||
                String(w.legacyId ?? '') === String(workerId)
            ));
        };

        if (card.currentAssigneeType === 'WORKER' && card.currentAssigneeId) {
            try {
                const worker = findWorker(card.currentAssigneeId);
                assignedTeamId = worker?.teamId || assignedTeamId;
                assignedTeamName = worker?.teamName || assignedTeamName;
            } catch (error) {
                console.warn('Failed to resolve card assignee team for billing:', error);
            }
        }

        const hasExplicitBillingTarget = Boolean(card.billingTargetType && card.billingTargetId);
        const targetType = hasExplicitBillingTarget ? card.billingTargetType : card.currentAssigneeType;
        const targetId = (hasExplicitBillingTarget ? card.billingTargetId : card.currentAssigneeId) ?? undefined;
        const targetName = (hasExplicitBillingTarget ? card.billingTargetName : card.currentAssigneeName) ?? undefined;
        const targetWorker = targetType === 'WORKER' ? findWorker(targetId) : undefined;

        const issuedToType: CardBillingIssuedToType | undefined =
            targetType === 'TEAM'
                ? 'team'
                : targetType === 'WORKER'
                    ? 'worker'
                    : undefined;
        const billingTeamId = targetType === 'TEAM'
            ? (targetId ?? undefined)
            : (targetWorker?.teamId || assignedTeamId);
        const billingTeamName = targetType === 'TEAM'
            ? (targetName ?? undefined)
            : (targetWorker?.teamName || assignedTeamName);

        const billingId = cardBillingService.buildBillingDocumentId({
            cardId: card.id,
            teamId: billingTeamId || 'unassigned',
            issuedToType: issuedToType || 'team',
            workerId: issuedToType === 'worker' ? targetId : undefined,
            yearMonth
        });

        return {
            id: billingId,
            yearMonth,
            cardId: card.id,
            cardLabel: `${card.name} (${card.last4})`,
            assignedTeamId,
            assignedTeamName,
            teamId: billingTeamId,
            teamName: billingTeamName,
            issuedToType,
            issuedToWorkerId: issuedToType === 'worker' ? (targetId ?? undefined) : undefined,
            issuedToWorkerName: issuedToType === 'team'
                ? (billingTeamName ?? undefined)
                : issuedToType === 'worker'
                    ? (targetName ?? targetWorker?.name ?? undefined)
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
