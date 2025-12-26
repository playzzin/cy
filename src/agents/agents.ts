import { AgentBus } from './AgentBus';
import { AgentTask, AgentResult, AgentRole } from './types';

export abstract class BaseAgent {
    constructor(
        protected readonly bus: AgentBus,
        public readonly role: AgentRole
    ) { }

    abstract canHandle(task: AgentTask): boolean;
    abstract execute(task: AgentTask): Promise<AgentResult>;
}

export class AnalysisAgent extends BaseAgent {
    canHandle(task: AgentTask): boolean {
        return task.role === 'analysis';
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        this.bus.publish({
            type: 'TASK_PROGRESS',
            taskId: task.id,
            role: this.role,
            timestamp: Date.now(),
            detail: '분석 시작'
        });

        const output = `분석 결과: ${task.input}`;

        return {
            taskId: task.id,
            role: this.role,
            output,
            context: { notes: '요약 및 요구 정의' }
        };
    }
}

export class CodingAgent extends BaseAgent {
    canHandle(task: AgentTask): boolean {
        return task.role === 'coding';
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        this.bus.publish({
            type: 'TASK_PROGRESS',
            taskId: task.id,
            role: this.role,
            timestamp: Date.now(),
            detail: '구현 시작'
        });

        const output = `코드 초안: ${task.input}`;

        return {
            taskId: task.id,
            role: this.role,
            output,
            context: { notes: '구현 세부 내용' }
        };
    }
}

export class TestingAgent extends BaseAgent {
    canHandle(task: AgentTask): boolean {
        return task.role === 'testing';
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        this.bus.publish({
            type: 'TASK_PROGRESS',
            taskId: task.id,
            role: this.role,
            timestamp: Date.now(),
            detail: '검증 시작'
        });

        const output = `테스트 결과 OK: ${task.input}`;

        return {
            taskId: task.id,
            role: this.role,
            output,
            context: { coverage: '기본 시나리오' }
        };
    }
}
