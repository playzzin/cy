import { cardFirestoreService } from './cardFirestoreService';
import type {
    Card,
    CardType,
    CardStatus,
    CardAssigneeType,
    CardBillingTargetRecord,
    CardBillingTargetType,
    CardTransaction,
    CardTransactionCategory,
    CardAssignmentRecord
} from '../types/card';

export {
    type Card,
    type CardType,
    type CardStatus,
    type CardAssigneeType,
    type CardBillingTargetRecord,
    type CardBillingTargetType,
    type CardTransaction,
    type CardTransactionCategory,
    type CardAssignmentRecord
};

/**
 * CardService - Firestore 통합 버전
 * 모든 요청을 cardFirestoreService로 위임합니다.
 */
export const cardService = {
    getCards: async (): Promise<Card[]> => {
        return cardFirestoreService.getCards();
    },

    createCard: async (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        return cardFirestoreService.createCard(card);
    },

    updateCard: async (id: string, updates: Partial<Card>): Promise<void> => {
        return cardFirestoreService.updateCard(id, updates);
    },

    deleteCard: async (id: string): Promise<void> => {
        const card = await cardFirestoreService.getCard(id);
        if (card) {
            await cardFirestoreService.updateCard(id, { status: 'CLOSED' });
            // 실제 삭제를 원할 경우 delete doc 호출 가능하나, 서비스 정책상 상태 변경 우선
        }
    },

    getAssignmentHistory: async (cardId: string): Promise<CardAssignmentRecord[]> => {
        return cardFirestoreService.getAssignmentHistory(cardId);
    },

    listAllCardAssignments: async (): Promise<CardAssignmentRecord[]> => {
        return cardFirestoreService.listAllCardAssignments();
    },

    updateCardAssignment: async (
        data: Partial<CardAssignmentRecord> & { id: string; cardId: string }
    ): Promise<void> => {
        await cardFirestoreService.saveCardAssignment(data);
        if (!data.endDate && data.assigneeId && data.assigneeType && data.assigneeName) {
            await cardFirestoreService.updateCard(data.cardId, {
                status: 'ASSIGNED',
                currentAssigneeId: data.assigneeId,
                currentAssigneeType: data.assigneeType,
                currentAssigneeName: data.assigneeName
            });
        }
    },

    listAllCardBillingTargets: async (cardId?: string): Promise<CardBillingTargetRecord[]> => {
        return cardFirestoreService.listCardBillingTargets(cardId);
    },

    saveCardBillingTarget: async (
        data: Omit<CardBillingTargetRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): Promise<string> => {
        const id = data.id || `${data.cardId}_${data.targetId}_${data.startDate}_${Date.now()}`;
        await cardFirestoreService.saveCardBillingTarget({ ...data, id });
        return id;
    },

    deleteCardBillingTarget: async (id: string): Promise<void> => {
        await cardFirestoreService.deleteCardBillingTarget(id);
    },

    applyCardBillingTargetChanges: async (params: {
        cardId: string;
        upserts?: Array<Omit<CardBillingTargetRecord, 'createdAt' | 'updatedAt'>>;
        closeRecords?: Array<{ id: string; endDate: string }>;
        deleteIds?: string[];
        clearSnapshot?: boolean;
    }): Promise<void> => {
        await cardFirestoreService.applyCardBillingTargetChanges(params);
    },

    assignCard: async (
        cardId: string,
        assigneeId: string,
        assigneeType: CardAssigneeType,
        assigneeName: string,
        startDate: string
    ): Promise<void> => {
        const card = await cardFirestoreService.getCard(cardId);
        if (!card) {
            throw new Error('카드 정보를 찾을 수 없습니다.');
        }
        const cardLabel = `${card.name} (${card.last4})`;

        await cardFirestoreService.assignCard({
            cardId,
            assigneeId,
            assigneeType,
            assigneeName,
            startDate,
            cardLabel
        });
    },

    unassignCard: async (cardId: string, endDate: string): Promise<void> => {
        await cardFirestoreService.unassignCard(cardId, endDate);
    },

    getTransactionsByMonth: async (yearMonth: string): Promise<CardTransaction[]> => {
        return cardFirestoreService.getTransactionsByMonth(yearMonth);
    },

    getTransactionsByCard: async (cardId: string, yearMonth?: string): Promise<CardTransaction[]> => {
        // Firestore query where cardId == id && yearMonth == target
        // cardFirestoreService에 해당 기능이 없으면 추가하거나 필터링
        const txs = await cardFirestoreService.getTransactionsByMonth(yearMonth || '');
        // Note: yearMonth가 필수인 쿼리를 사용 중이므로, 모든 트랜잭션 조회가 필요할 경우 로직 보강 필요
        // 우선 기존 인터페이스 유지를 위해 필터링 사용
        if (yearMonth) {
            return txs.filter(t => t.cardId === cardId);
        }
        // yearMonth가 없을 경우에 대한 처리는 추후 고도화 (현재 요구사항은 대부분 월별 조회임)
        return txs.filter(t => t.cardId === cardId);
    },

    addTransaction: async (payload: {
        cardId: string;
        cardLabel: string;
        date: string;
        merchant: string;
        category: CardTransactionCategory;
        amount: number;
        memo?: string;
        evidenceUrl?: string;
    }): Promise<string> => {
        const yearMonth = payload.date.slice(0, 7);
        return cardFirestoreService.addTransaction({
            ...payload,
            yearMonth
        });
    },

    deleteTransaction: async (id: string): Promise<void> => {
        await cardFirestoreService.deleteTransaction(id);
    }
};
