/**
 * 서브 에이전트 클라이언트 서비스
 * Firebase Functions의 서브 에이전트/협업 API를 호출
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../config/firebase';
import type { AgentId } from './agentExecutionService';

const functions = getFunctions(app, 'asia-northeast3');

// ============================================
// 타입 정의
// ============================================

export interface SubAgentInstance {
    instanceId: string;
    agentId: AgentId;
    state: 'created' | 'idle' | 'busy' | 'completed' | 'failed' | 'terminated';
    parentId?: string;
    currentTask?: {
        taskId: string;
        description: string;
        status: string;
    };
    taskHistoryCount: number;
    createdAt: number;
    updatedAt: number;
}

export interface TaskAssignment {
    taskId: string;
    instanceId: string;
    agentId: AgentId;
    reason: string;
}

export interface TaskResult {
    taskId: string;
    instanceId: string;
    agentId: AgentId;
    status: 'completed' | 'failed';
    output: string;
    error?: string;
    artifacts?: Array<{ type: string; name: string; content: string }>;
    executionTime: number;
    tokenUsage?: { input: number; output: number };
}

export interface CollaborationSessionInfo {
    sessionId: string;
    name: string;
    description: string;
    status: 'active' | 'paused' | 'completed' | 'failed';
    participantCount?: number;
    participants?: Array<{
        instanceId: string;
        agentId: AgentId;
        role: string;
        status: string;
    }>;
    orchestratorId?: string;
    sharedContext?: {
        goal: string;
        currentPhase: string;
        decisionsCount: number;
        artifactsCount: number;
    };
    messagesCount?: number;
    createdAt: number;
    updatedAt?: number;
}

export interface CollaborationResult {
    success: boolean;
    results: Array<{
        instanceId: string;
        agentId: AgentId;
        output: string;
    }>;
    artifactsCount: number;
    artifacts: Array<{ type: string; name: string; content: string }>;
}

// ============================================
// 서브 에이전트 API
// ============================================

/** 서브 에이전트 생성 */
export async function createSubAgent(
    agentId: AgentId,
    options?: { parentId?: string; metadata?: Record<string, unknown> }
): Promise<SubAgentInstance> {
    const fn = httpsCallable<
        { agentId: string; parentId?: string; metadata?: Record<string, unknown> },
        { success: boolean; instance: SubAgentInstance }
    >(functions, 'createSubAgent');

    const result = await fn({ agentId, ...options });
    return result.data.instance;
}

/** 에이전트 팀 생성 */
export async function createAgentTeam(
    name: string,
    agents: Array<{ agentId: AgentId; count: number }>,
    parentId?: string
): Promise<{ teamId: string; instances: SubAgentInstance[] }> {
    const fn = httpsCallable<
        { name: string; agents: Array<{ agentId: string; count: number }>; parentId?: string },
        { success: boolean; teamId: string; instances: SubAgentInstance[] }
    >(functions, 'createAgentTeam');

    const result = await fn({ name, agents, parentId });
    return { teamId: result.data.teamId, instances: result.data.instances };
}

/** 서브 에이전트 목록 조회 */
export async function getSubAgents(filter?: {
    agentId?: AgentId;
    state?: string;
    parentId?: string;
}): Promise<SubAgentInstance[]> {
    const fn = httpsCallable<
        typeof filter,
        { success: boolean; count: number; instances: SubAgentInstance[] }
    >(functions, 'getSubAgents');

    const result = await fn(filter || {});
    return result.data.instances;
}

/** 서브 에이전트 상태 업데이트 */
export async function updateSubAgentState(
    instanceId: string,
    state: string
): Promise<SubAgentInstance> {
    const fn = httpsCallable<
        { instanceId: string; state: string },
        { success: boolean; instance: SubAgentInstance }
    >(functions, 'updateSubAgentState');

    const result = await fn({ instanceId, state });
    return result.data.instance;
}

/** 서브 에이전트 종료 */
export async function terminateSubAgent(instanceId: string): Promise<boolean> {
    const fn = httpsCallable<
        { instanceId: string },
        { success: boolean }
    >(functions, 'terminateSubAgent');

    const result = await fn({ instanceId });
    return result.data.success;
}

// ============================================
// 작업 분배 API
// ============================================

/** 작업 분배 */
export async function distributeTasks(
    tasks: Array<{
        description: string;
        input?: Record<string, unknown>;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        dependsOn?: string[];
    }>,
    strategy: 'round_robin' | 'load_balanced' | 'capability_based' | 'priority_based' = 'load_balanced'
): Promise<{
    assignments: TaskAssignment[];
    unassignedTasks: Array<{ taskId: string; description: string }>;
    reasoning: string;
}> {
    const fn = httpsCallable<
        { tasks: typeof tasks; strategy: string },
        {
            success: boolean;
            assignments: TaskAssignment[];
            unassignedTasks: Array<{ taskId: string; description: string }>;
            reasoning: string;
            error?: string;
        }
    >(functions, 'distributeTasks');

    const result = await fn({ tasks, strategy });

    if (!result.data.success && result.data.error) {
        throw new Error(result.data.error);
    }

    return {
        assignments: result.data.assignments,
        unassignedTasks: result.data.unassignedTasks,
        reasoning: result.data.reasoning
    };
}

/** 단일 작업 실행 */
export async function executeTask(taskId: string): Promise<TaskResult> {
    const fn = httpsCallable<
        { taskId: string },
        { success: boolean; result: TaskResult }
    >(functions, 'executeTask');

    const result = await fn({ taskId });
    return result.data.result;
}

/** 여러 작업 병렬 실행 */
export async function executeTasksParallel(
    taskIds: string[]
): Promise<TaskResult[]> {
    const fn = httpsCallable<
        { taskIds: string[] },
        { success: boolean; results: TaskResult[] }
    >(functions, 'executeTasksParallel');

    const result = await fn({ taskIds });
    return result.data.results;
}

// ============================================
// 협업 세션 API
// ============================================

/** 협업 세션 생성 */
export async function createCollaboration(config: {
    name: string;
    description?: string;
    goal: string;
    orchestratorAgentId: AgentId;
    participantAgentIds: AgentId[];
    constraints?: string[];
}): Promise<CollaborationSessionInfo> {
    const fn = httpsCallable<
        typeof config,
        { success: boolean; session: CollaborationSessionInfo }
    >(functions, 'createCollaboration');

    const result = await fn(config);
    return result.data.session;
}

/** 협업 시작 */
export async function startCollaboration(
    sessionId: string,
    task: string
): Promise<CollaborationResult> {
    const fn = httpsCallable<
        { sessionId: string; task: string },
        CollaborationResult
    >(functions, 'startCollaboration');

    const result = await fn({ sessionId, task });
    return result.data;
}

/** 협업 세션 조회 */
export async function getCollaboration(
    sessionId: string
): Promise<CollaborationSessionInfo> {
    const fn = httpsCallable<
        { sessionId: string },
        { success: boolean; session: CollaborationSessionInfo }
    >(functions, 'getCollaboration');

    const result = await fn({ sessionId });
    return result.data.session;
}

/** 협업 세션 종료 */
export async function endCollaboration(
    sessionId: string,
    status: 'completed' | 'failed' = 'completed'
): Promise<boolean> {
    const fn = httpsCallable<
        { sessionId: string; status: string },
        { success: boolean }
    >(functions, 'endCollaboration');

    const result = await fn({ sessionId, status });
    return result.data.success;
}
