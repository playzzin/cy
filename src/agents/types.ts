export type AgentRole = 'analysis' | 'coding' | 'testing';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface AgentTask {
    id: string;
    role: AgentRole;
    input: string;
    metadata?: Record<string, unknown>;
    status: TaskStatus;
}

export interface AgentResult {
    taskId: string;
    role: AgentRole;
    output: string;
    context: Record<string, unknown>;
}

export type AgentEventType = 'TASK_ASSIGNED' | 'TASK_PROGRESS' | 'TASK_DONE' | 'TASK_BLOCKED';

export interface AgentEvent {
    type: AgentEventType;
    timestamp: number;
    taskId: string;
    role: AgentRole;
    detail?: string;
    payload?: Record<string, unknown>;
}

export interface UserGoal {
    id: string;
    statement: string;
    constraints?: string[];
    acceptanceCriteria?: string[];
}
