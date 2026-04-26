import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { AgentConversation, AgentMessage } from '../types/agentTypes';

const LOCAL_STORAGE_KEY = 'agent_playground_saved_conversations_v1';

type StoredMessage = Omit<AgentMessage, 'timestamp'> & { timestamp: string };

type StoredSavedConversation = Omit<SavedConversation, 'createdAt' | 'updatedAt' | 'metrics' | 'messages'> & {
    createdAt: string;
    updatedAt: string;
    messages: StoredMessage[];
    metrics: Omit<ConversationMetrics, 'startTime' | 'endTime'> & {
        startTime: string;
        endTime?: string;
    };
};

function loadLocalSavedConversations(): StoredSavedConversation[] {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as StoredSavedConversation[]) : [];
    } catch {
        return [];
    }
}

function saveLocalSavedConversations(conversations: StoredSavedConversation[]): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(conversations));
}

function toStoredSavedConversation(conversation: SavedConversation): StoredSavedConversation {
    return {
        ...conversation,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((msg) => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
        })),
        metrics: {
            ...conversation.metrics,
            startTime: conversation.metrics.startTime.toISOString(),
            endTime: conversation.metrics.endTime ? conversation.metrics.endTime.toISOString() : undefined
        }
    };
}

function fromStoredSavedConversation(data: StoredSavedConversation): SavedConversation {
    return {
        ...data,
        messages: data.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
        })),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        metrics: {
            ...data.metrics,
            startTime: new Date(data.metrics.startTime),
            endTime: data.metrics.endTime ? new Date(data.metrics.endTime) : undefined
        }
    };
}

export interface ConversationMetrics {
    totalMessages: number;
    averageResponseTime: number;
    agentWorkDistribution: Record<string, number>;
    startTime: Date;
    endTime?: Date;
}

export interface SavedConversation extends AgentConversation {
    title: string;
    metrics: ConversationMetrics;
}

// Firestore 데이터 변환 헬퍼
function toFirestore(conversation: SavedConversation): any {
    return {
        ...conversation,
        messages: conversation.messages.map(msg => ({
            ...msg,
            timestamp: Timestamp.fromDate(msg.timestamp)
        })),
        createdAt: Timestamp.fromDate(conversation.createdAt),
        updatedAt: Timestamp.fromDate(conversation.updatedAt),
        metrics: {
            ...conversation.metrics,
            startTime: Timestamp.fromDate(conversation.metrics.startTime),
            endTime: conversation.metrics.endTime ? Timestamp.fromDate(conversation.metrics.endTime) : null
        }
    };
}

function fromFirestore(data: any): SavedConversation {
    return {
        ...data,
        messages: data.messages.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp.toDate()
        })),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        metrics: {
            ...data.metrics,
            startTime: data.metrics.startTime.toDate(),
            endTime: data.metrics.endTime ? data.metrics.endTime.toDate() : undefined
        }
    };
}

// 메트릭 계산
function calculateMetrics(conversation: AgentConversation): ConversationMetrics {
    const messages = conversation.messages;
    const agentWorkDistribution: Record<string, number> = {};

    // 에이전트별 작업 분포 계산
    messages.forEach(msg => {
        if (msg.role === 'assistant' && msg.agentId) {
            agentWorkDistribution[msg.agentId] = (agentWorkDistribution[msg.agentId] || 0) + 1;
        }
    });

    // 평균 응답 시간 계산 (간단히 메시지 간 시간 차이)
    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
        if (messages[i].role === 'assistant' && messages[i - 1].role === 'user') {
            const timeDiff = messages[i].timestamp.getTime() - messages[i - 1].timestamp.getTime();
            totalResponseTime += timeDiff;
            responseCount++;
        }
    }

    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
        totalMessages: messages.length,
        averageResponseTime,
        agentWorkDistribution,
        startTime: conversation.createdAt,
        endTime: conversation.updatedAt
    };
}

export const conversationHistoryService = {
    /**
     * 대화 저장
     */
    async saveConversation(
        conversation: AgentConversation,
        title?: string
    ): Promise<string> {
        const conversationId = conversation.id;
        const metrics = calculateMetrics(conversation);

        const savedConversation: SavedConversation = {
            ...conversation,
            title: title || `대화 ${new Date().toLocaleDateString()}`,
            metrics
        };

        try {
            const docRef = doc(db, 'agent_conversations', conversationId);
            await setDoc(docRef, toFirestore(savedConversation));
            console.log('[ConversationHistory] Saved conversation:', conversationId);
            return conversationId;
        } catch (error) {
            console.warn('[ConversationHistory] Save failed. Falling back to localStorage.', error);
            const existing = loadLocalSavedConversations();
            const stored = toStoredSavedConversation(savedConversation);
            saveLocalSavedConversations([...existing.filter((c) => c.id !== conversationId), stored]);
            return conversationId;
        }
    },

    /**
     * 대화 불러오기
     */
    async loadConversation(conversationId: string): Promise<SavedConversation | null> {
        try {
            const docRef = doc(db, 'agent_conversations', conversationId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const conversation = fromFirestore(docSnap.data());
                console.log('[ConversationHistory] Loaded conversation:', conversationId);
                return conversation;
            }
        } catch (error) {
            console.warn('[ConversationHistory] Load failed. Falling back to localStorage.', error);
        }

        const local = loadLocalSavedConversations().find((c) => c.id === conversationId);
        return local ? fromStoredSavedConversation(local) : null;
    },

    /**
     * 대화 목록 조회
     */
    async listConversations(): Promise<SavedConversation[]> {
        try {
            const q = query(
                collection(db, 'agent_conversations'),
                orderBy('updatedAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            const conversations: SavedConversation[] = [];

            querySnapshot.forEach((doc) => {
                conversations.push(fromFirestore(doc.data()));
            });

            console.log('[ConversationHistory] Listed conversations:', conversations.length);
            return conversations;
        } catch (error) {
            console.warn('[ConversationHistory] List failed. Falling back to localStorage.', error);
            const local = loadLocalSavedConversations().map(fromStoredSavedConversation);
            return local.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
    },

    /**
     * 대화 삭제
     */
    async deleteConversation(conversationId: string): Promise<void> {
        try {
            const docRef = doc(db, 'agent_conversations', conversationId);
            await deleteDoc(docRef);
            console.log('[ConversationHistory] Deleted conversation:', conversationId);
            return;
        } catch (error) {
            console.warn('[ConversationHistory] Delete failed. Falling back to localStorage.', error);
            const existing = loadLocalSavedConversations();
            saveLocalSavedConversations(existing.filter((c) => c.id !== conversationId));
        }
    },

    /**
     * 대화 제목 업데이트
     */
    async updateTitle(conversationId: string, title: string): Promise<void> {
        const conversation = await this.loadConversation(conversationId);
        if (!conversation) {
            throw new Error('대화를 찾을 수 없습니다.');
        }

        conversation.title = title;
        conversation.updatedAt = new Date();

        try {
            const docRef = doc(db, 'agent_conversations', conversationId);
            await setDoc(docRef, toFirestore(conversation));
            console.log('[ConversationHistory] Updated title:', conversationId, title);
        } catch (error) {
            console.warn('[ConversationHistory] Update title failed. Falling back to localStorage.', error);
            const existing = loadLocalSavedConversations();
            const stored = toStoredSavedConversation(conversation);
            saveLocalSavedConversations([...existing.filter((c) => c.id !== conversationId), stored]);
        }
    }
};
