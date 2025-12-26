import { AgentBus } from './AgentBus';
import { BaseAgent } from './agents';
import { AgentResult, AgentTask, AgentRole, UserGoal } from './types';

const roleSequence: AgentRole[] = ['analysis', 'coding', 'testing'];

const taskId = (() => {
    let counter = 0;
    return () => `task-${++counter}`;
})();

export interface ExecutionReport {
    goal: UserGoal;
    results: AgentResult[];
    startedAt: number;
    finishedAt: number;
}

export class MainAgent {
    constructor(
        private readonly bus: AgentBus,
        private readonly agents: BaseAgent[]
    ) { }

    public plan(goal: UserGoal): AgentTask[] {
        return roleSequence.map(role => ({
            id: taskId(),
            role,
            input: `${goal.statement} - step:${role}`,
            metadata: {
                constraints: goal.constraints || [],
                acceptance: goal.acceptanceCriteria || []
            },
            status: 'pending'
        }));
    }

    public async execute(goal: UserGoal): Promise<ExecutionReport> {
        const tasks = this.plan(goal);
        const results: AgentResult[] = [];
        const startedAt = Date.now();

        for (const task of tasks) {
            const agent = this.agents.find(a => a.canHandle(task));
            if (!agent) {
                this.bus.publish({
                    type: 'TASK_BLOCKED',
                    taskId: task.id,
                    role: task.role,
                    timestamp: Date.now(),
                    detail: `No agent for role ${task.role}`
                });
                continue;
            }

            this.bus.publish({
                type: 'TASK_ASSIGNED',
                taskId: task.id,
                role: agent.role,
                timestamp: Date.now(),
                detail: '작업 할당'
            });

            task.status = 'in_progress';
            const result = await agent.execute(task);
            task.status = 'done';
            results.push(result);

            this.bus.publish({
                type: 'TASK_DONE',
                taskId: task.id,
                role: agent.role,
                timestamp: Date.now(),
                detail: '작업 완료',
                payload: { summary: result.output }
            });
        }

        return {
            goal,
            results,
            startedAt,
            finishedAt: Date.now()
        };
    }
}

export const createDefaultAgentSystem = () => {
    const bus = new AgentBus();

    const { AnalysisAgent, CodingAgent, TestingAgent } = require('./agents') as typeof import('./agents');

    const agents: BaseAgent[] = [
        new AnalysisAgent(bus, 'analysis'),
        new CodingAgent(bus, 'coding'),
        new TestingAgent(bus, 'testing')
    ];

    return { mainAgent: new MainAgent(bus, agents), bus };
};
