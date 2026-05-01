import { cardFirestoreService } from './cardFirestoreService';
import {
    Card,
    CardType,
    CardStatus,
    CardAssigneeType,
    CardTransaction,
    CardTransactionCategory,
    CardAssignmentRecord
} from '../types/card';

export {
    type Card,
    type CardType,
    type CardStatus,
    type CardAssigneeType,
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

    assignCard: async (
        cardId: string,
        assigneeId: string,
        assigneeType: CardAssigneeType,
        assigneeName: string,
        startDate: string
    ): Promise<void> => {
        const card = await cardFirestoreService.getCard(cardId);
        const cardLabel = card ? `${card.name} (${card.last4})` : '카드 정보 없음';

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
