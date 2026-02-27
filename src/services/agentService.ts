import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createAgent,
    createAgentConversation,
    listAllAgentConversations,
    listAllAgents,
    updateAgent,
    updateAgentConversation
} from '../dataconnect-generated';
import { Agent, AgentConversation, AgentMessage, AgentStatus } from '../types/agentTypes';

const dc = getDataConnect(app, connectorConfig);

const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const LOCAL_STORAGE_KEYS = {
    agents: 'agent_playground_agents_v1',
    conversations: 'agent_playground_conversations_v1'
} as const;

type StoredAgent = Omit<Agent, 'createdAt' | 'updatedAt'> & {
    createdAt: string;
    updatedAt: string;
};

type StoredConversation = Omit<AgentConversation, 'createdAt' | 'updatedAt' | 'messages'> & {
    createdAt: string;
    updatedAt: string;
    messages: Array<Omit<AgentMessage, 'timestamp'> & { timestamp: string }>;
};

const loadLocalAgents = (): StoredAgent[] => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.agents);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as StoredAgent[]) : [];
    } catch {
        return [];
    }
};

const saveLocalAgents = (agents: StoredAgent[]): void => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.agents, JSON.stringify(agents));
};

const loadLocalConversations = (): StoredConversation[] => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.conversations);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as StoredConversation[]) : [];
    } catch {
        return [];
    }
};

const saveLocalConversations = (conversations: StoredConversation[]): void => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.conversations, JSON.stringify(conversations));
};

const toStoredMessage = (m: AgentMessage): StoredConversation['messages'][number] => ({
    role: m.role,
    content: m.content,
    agentId: m.agentId,
    timestamp: (m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp as unknown as string)).toISOString()
});

const toStoredAgent = (agent: Agent): StoredAgent => ({
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString()
});

const toStoredConversation = (conv: AgentConversation): StoredConversation => ({
    id: conv.id,
    mainAgentId: conv.mainAgentId,
    userId: conv.userId,
    messages: (conv.messages ?? []).map(toStoredMessage),
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString()
});

const toDate = (value?: string | null): Date => {
    if (!value) return new Date();
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? new Date() : d;
};

const parseStringArray = (value: unknown): string[] => {
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
        // ignore
    }
    return trimmed
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
};

const serializeMessages = (messages: AgentMessage[]): string => {
    return JSON.stringify(
        messages.map((m) => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : new Date(m.timestamp as any).toISOString()
        }))
    );
};

const parseMessages = (value: unknown): AgentMessage[] => {
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((msg: any) => ({
                role: msg?.role as AgentMessage['role'],
                content: String(msg?.content ?? ''),
                agentId: msg?.agentId ? String(msg.agentId) : undefined,
                timestamp: toDate(msg?.timestamp)
            }))
            .filter((m) => m.role && m.content);
    } catch {
        return [];
    }
};

const mapAgent = (row: any): Agent => {
    return {
        id: String(row?.id ?? ''),
        name: row?.name ? String(row.name) : '',
        type: (row?.type ? String(row.type) : 'main') as any,
        role: row?.role ? String(row.role) : '',
        capabilities: parseStringArray(row?.capabilities),
        systemPrompt: row?.systemPrompt ? String(row.systemPrompt) : '',
        status: (row?.status ? String(row.status) : 'idle') as any,
        createdAt: toDate(row?.createdAt),
        updatedAt: toDate(row?.updatedAt)
    };
};

const mapConversation = (row: any): AgentConversation => {
    return {
        id: String(row?.id ?? ''),
        mainAgentId: row?.mainAgentId ? String(row.mainAgentId) : '',
        userId: row?.userId ? String(row.userId) : '',
        messages: parseMessages(row?.messages),
        createdAt: toDate(row?.createdAt),
        updatedAt: toDate(row?.updatedAt)
    };
};

// 에이전트 관리
export const agentService = {
    // 에이전트 생성
    async createAgent(agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
        const id = generateId('agent');
        try {
            await createAgent(dc, {
                id,
                name: agentData.name,
                type: agentData.type,
                role: agentData.role,
                capabilities: JSON.stringify(agentData.capabilities ?? []),
                systemPrompt: agentData.systemPrompt,
                status: agentData.status
            } as any);
        } catch (error) {
            console.warn('[agentService] Data Connect createAgent failed. Falling back to localStorage.', error);
            const now = new Date();
            const next: Agent = {
                id,
                name: agentData.name,
                type: agentData.type,
                role: agentData.role,
                capabilities: agentData.capabilities ?? [],
                systemPrompt: agentData.systemPrompt,
                status: agentData.status,
                parentAgentId: agentData.parentAgentId,
                createdAt: now,
                updatedAt: now
            };
            const agents = loadLocalAgents();
            saveLocalAgents([...agents.filter((a) => a.id !== id), toStoredAgent(next)]);
        }
        return id;
    },

    // 에이전트 상태 업데이트
    async updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
        try {
            await updateAgent(dc, {
                id: agentId,
                status
            } as any);
        } catch (error) {
            console.warn('[agentService] Data Connect updateAgentStatus failed. Falling back to localStorage.', error);
            const agents = loadLocalAgents();
            const nowIso = new Date().toISOString();
            saveLocalAgents(
                agents.map((a) => (a.id === agentId ? { ...a, status: status as any, updatedAt: nowIso } : a))
            );
        }
    },

    // 모든 에이전트 조회
    async getAgents(): Promise<Agent[]> {
        try {
            const response = await listAllAgents(dc);
            const rows = (response as any)?.data?.agents ?? [];
            return Array.isArray(rows) ? rows.map(mapAgent) : [];
        } catch (error) {
            console.warn('[agentService] Data Connect listAgents failed. Falling back to localStorage.', error);
            return loadLocalAgents().map((a) => ({
                ...a,
                createdAt: toDate(a.createdAt),
                updatedAt: toDate(a.updatedAt)
            }));
        }
    },

    // 특정 부모의 서브 에이전트들 조회
    async getSubAgents(parentAgentId: string): Promise<Agent[]> {
        console.warn('getSubAgents is not supported in Data Connect schema yet (missing parentAgentId).', parentAgentId);
        return [];
    }
};

// 💬 대화 관리
export const conversationService = {
    // 대화 생성
    async createConversation(
        mainAgentId: string,
        userId: string
    ): Promise<string> {
        const id = generateId('conv');
        try {
            await createAgentConversation(dc, {
                id,
                mainAgentId,
                userId,
                messages: JSON.stringify([])
            } as any);
        } catch (error) {
            console.warn('[conversationService] Data Connect createConversation failed. Falling back to localStorage.', error);
            const now = new Date();
            const conv: AgentConversation = {
                id,
                mainAgentId,
                userId,
                messages: [],
                createdAt: now,
                updatedAt: now
            };
            const conversations = loadLocalConversations();
            saveLocalConversations([...conversations.filter((c) => c.id !== id), toStoredConversation(conv)]);
        }
        return id;
    },

    // 메시지 추가
    async addMessage(
        conversationId: string,
        message: { role: 'user' | 'assistant' | 'system'; content: string; agentId?: string }
    ): Promise<void> {
        const existing = await conversationService.getConversation(conversationId);
        if (!existing) return;

        const nextMessages: AgentMessage[] = [
            ...(existing.messages ?? []),
            {
                role: message.role,
                content: message.content,
                agentId: message.agentId,
                timestamp: new Date()
            }
        ];

        try {
            await updateAgentConversation(dc, {
                id: conversationId,
                messages: serializeMessages(nextMessages)
            } as any);
        } catch (error) {
            console.warn('[conversationService] Data Connect addMessage failed. Falling back to localStorage.', error);
            const conversations = loadLocalConversations();
            const nowIso = new Date().toISOString();
            const updated = conversations.map((c) => {
                if (c.id !== conversationId) return c;
                return {
                    ...c,
                    messages: nextMessages.map(toStoredMessage),
                    updatedAt: nowIso
                };
            });
            saveLocalConversations(updated);
        }
    },

    // 대화 조회
    async getConversation(conversationId: string): Promise<AgentConversation | null> {
        try {
            const response = await listAllAgentConversations(dc);
            const rows = (response as any)?.data?.agentConversations ?? [];
            const row = Array.isArray(rows)
                ? rows.find((r: any) => String(r?.id ?? '') === String(conversationId))
                : null;

            if (row) return mapConversation(row);
        } catch (error) {
            console.warn('[conversationService] Data Connect getConversation failed. Falling back to localStorage.', error);
        }

        const local = loadLocalConversations().find((c) => c.id === conversationId);
        if (!local) return null;
        return {
            id: local.id,
            mainAgentId: local.mainAgentId,
            userId: local.userId,
            messages: (local.messages ?? []).map((m) => ({
                role: m.role,
                content: m.content,
                agentId: m.agentId,
                timestamp: toDate(m.timestamp)
            })),
            createdAt: toDate(local.createdAt),
            updatedAt: toDate(local.updatedAt)
        };
    }
};
