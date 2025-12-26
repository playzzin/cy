import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Agent, Task, AgentConversation, AgentType, AgentStatus, TaskStatus } from '../types/agentTypes';

// Firestore 컬렉션 이름
const AGENTS_COLLECTION = 'agents';
const TASKS_COLLECTION = 'tasks';
const CONVERSATIONS_COLLECTION = 'agent_conversations';

// 🤖 에이전트 관리
export const agentService = {
    // 에이전트 생성
    async createAgent(agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, AGENTS_COLLECTION), {
            ...agentData,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        return docRef.id;
    },

    // 에이전트 상태 업데이트
    async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
        const agentRef = doc(db, AGENTS_COLLECTION, agentId);
        await updateDoc(agentRef, {
            status,
            updatedAt: Timestamp.now()
        });
    },

    // 모든 에이전트 조회
    async getAgents(): Promise<Agent[]> {
        const querySnapshot = await getDocs(collection(db, AGENTS_COLLECTION));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        } as Agent));
    },

    // 특정 부모의 서브 에이전트들 조회
    async getSubAgents(parentAgentId: string): Promise<Agent[]> {
        const q = query(
            collection(db, AGENTS_COLLECTION),
            where('parentAgentId', '==', parentAgentId)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate()
        } as Agent));
    }
};

// 📋 작업 관리
export const taskService = {
    // 작업 생성
    async createTask(taskData: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
        const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
            ...taskData,
            createdAt: Timestamp.now()
        });
        return docRef.id;
    },

    // 작업 상태 업데이트
    async updateTaskStatus(
        taskId: string,
        status: TaskStatus,
        output?: any,
        error?: string
    ): Promise<void> {
        const taskRef = doc(db, TASKS_COLLECTION, taskId);
        const updateData: any = { status };

        if (output !== undefined) updateData.output = output;
        if (error !== undefined) updateData.error = error;
        if (status === 'in_progress' && !updateData.startedAt) {
            updateData.startedAt = Timestamp.now();
        }
        if (status === 'completed' || status === 'failed') {
            updateData.completedAt = Timestamp.now();
        }

        await updateDoc(taskRef, updateData);
    },

    // 특정 에이전트의 작업들 조회
    async getAgentTasks(agentId: string): Promise<Task[]> {
        const q = query(
            collection(db, TASKS_COLLECTION),
            where('assignedAgentId', '==', agentId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            startedAt: doc.data().startedAt?.toDate(),
            completedAt: doc.data().completedAt?.toDate()
        } as Task));
    }
};

// 💬 대화 관리
export const conversationService = {
    // 대화 생성
    async createConversation(
        mainAgentId: string,
        userId: string
    ): Promise<string> {
        const docRef = await addDoc(collection(db, CONVERSATIONS_COLLECTION), {
            mainAgentId,
            userId,
            messages: [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });
        return docRef.id;
    },

    // 메시지 추가
    async addMessage(
        conversationId: string,
        message: { role: 'user' | 'assistant' | 'system'; content: string; agentId?: string }
    ): Promise<void> {
        const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
        const conversationDoc = await getDoc(conversationRef);

        if (conversationDoc.exists()) {
            const currentMessages = conversationDoc.data().messages || [];
            await updateDoc(conversationRef, {
                messages: [
                    ...currentMessages,
                    {
                        ...message,
                        timestamp: Timestamp.now()
                    }
                ],
                updatedAt: Timestamp.now()
            });
        }
    },

    // 대화 조회
    async getConversation(conversationId: string): Promise<AgentConversation | null> {
        const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
        const conversationDoc = await getDoc(conversationRef);

        if (conversationDoc.exists()) {
            const data = conversationDoc.data();
            return {
                id: conversationDoc.id,
                ...data,
                messages: data.messages.map((msg: any) => ({
                    ...msg,
                    timestamp: msg.timestamp?.toDate()
                })),
                createdAt: data.createdAt?.toDate(),
                updatedAt: data.updatedAt?.toDate()
            } as AgentConversation;
        }
        return null;
    }
};
