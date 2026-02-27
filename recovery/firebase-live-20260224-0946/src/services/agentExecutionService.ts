/**
 * AI 에이전트 실행 서비스
 * Firebase Functions의 에이전트 API를 호출하는 클라이언트
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../config/firebase';

// 에이전트 타입 정의
export type AgentCategory = 'core' | 'specialist' | 'emergency';

export type AgentId =
    | 'planner' | 'frontend' | 'backend' | 'qa' | 'tester'
    | 'designer' | 'db_engineer' | 'security' | 'refactor'
    | 'sequential' | 'debugger' | 'healer';

export interface AgentInfo {
    id: AgentId;
    name: string;
    description: string;
    category: AgentCategory;
    capabilities: string[];
}

export interface AgentArtifact {
    type: 'code' | 'schema' | 'spec' | 'test' | 'report';
    name: string;
    content: string;
    language?: string;
    filePath?: string;
}

export interface AgentResult {
    agentId: AgentId;
    status: 'idle' | 'running' | 'completed' | 'failed';
    output: string;
    artifacts?: AgentArtifact[];
    error?: string;
    executionTime: number;
    tokenUsage?: {
        input: number;
        output: number;
    };
}

// 워크플로우 정의
export interface WorkflowStep {
    agentId: AgentId;
    action: string;
    dependsOn?: AgentId[];
}

export type WorkflowId = 'feature-development' | 'emergency-fix' | 'custom';

// Functions 인스턴스 (asia-northeast3 리전)
const functions = getFunctions(app, 'asia-northeast3');

/**
 * 사용 가능한 에이전트 목록 조회
 */
export async function fetchAgentList(): Promise<{
    agents: AgentInfo[];
    categories: Record<AgentCategory, AgentId[]>;
}> {
    const listAgentsFn = httpsCallable<void, {
        success: boolean;
        agents: AgentInfo[];
        categories: Record<AgentCategory, AgentId[]>;
    }>(functions, 'listAgents');

    const result = await listAgentsFn();
    return result.data;
}

/**
 * 단일 에이전트 실행
 */
export async function executeAgent(
    agentId: AgentId,
    task: string,
    context?: Record<string, unknown>
): Promise<AgentResult> {
    const runAgentFn = httpsCallable<
        { agentId: AgentId; task: string; context?: Record<string, unknown> },
        { success: boolean; result: AgentResult }
    >(functions, 'runAgent');

    const result = await runAgentFn({ agentId, task, context });
    return result.data.result;
}

/**
 * 여러 에이전트 순차 실행
 */
export async function executeAgentsSequential(
    agentIds: AgentId[],
    task: string,
    context?: Record<string, unknown>
): Promise<AgentResult[]> {
    const runAgentsSeqFn = httpsCallable<
        { agentIds: AgentId[]; task: string; context?: Record<string, unknown> },
        { success: boolean; results: AgentResult[] }
    >(functions, 'runAgentsSequential');

    const result = await runAgentsSeqFn({ agentIds, task, context });
    return result.data.results;
}

/**
 * 여러 에이전트 병렬 실행
 */
export async function executeAgentsParallel(
    agentIds: AgentId[],
    task: string,
    context?: Record<string, unknown>
): Promise<AgentResult[]> {
    const runAgentsParFn = httpsCallable<
        { agentIds: AgentId[]; task: string; context?: Record<string, unknown> },
        { success: boolean; results: AgentResult[] }
    >(functions, 'runAgentsParallel');

    const result = await runAgentsParFn({ agentIds, task, context });
    return result.data.results;
}

/**
 * 미리 정의된 워크플로우 실행
 */
export async function executeWorkflow(
    workflowId: WorkflowId,
    task: string,
    context?: Record<string, unknown>,
    customSteps?: WorkflowStep[]
): Promise<{
    workflowId: string;
    results: AgentResult[];
}> {
    const runWorkflowFn = httpsCallable<
        {
            workflowId: WorkflowId;
            task: string;
            context?: Record<string, unknown>;
            workflow?: { steps: WorkflowStep[] };
        },
        { success: boolean; workflowId: string; results: AgentResult[] }
    >(functions, 'runWorkflow');

    const payload: {
        workflowId: WorkflowId;
        task: string;
        context?: Record<string, unknown>;
        workflow?: { steps: WorkflowStep[] };
    } = {
        workflowId,
        task,
        context
    };

    if (workflowId === 'custom' && customSteps) {
        payload.workflow = { steps: customSteps };
    }

    const result = await runWorkflowFn(payload);
    return {
        workflowId: result.data.workflowId,
        results: result.data.results
    };
}

/**
 * 긴급 에러 분석 및 수정 (Debugger + Healer)
 */
export async function executeEmergencyFix(
    errorMessage: string,
    stackTrace?: string,
    codeSnippet?: string
): Promise<{
    analysis: AgentResult | undefined;
    fix: AgentResult | undefined;
}> {
    const emergencyFixFn = httpsCallable<
        { errorMessage: string; stackTrace?: string; codeSnippet?: string },
        {
            success: boolean;
            analysis: AgentResult | undefined;
            fix: AgentResult | undefined;
        }
    >(functions, 'emergencyFix');

    const result = await emergencyFixFn({ errorMessage, stackTrace, codeSnippet });
    return {
        analysis: result.data.analysis,
        fix: result.data.fix
    };
}

// 에이전트 카테고리별 정보
export const AGENT_CATEGORIES: Record<AgentCategory, { name: string; description: string }> = {
    core: {
        name: 'Core Development',
        description: '기본 개발 팀 (기획, 프론트엔드, 백엔드, QA, 테스터)'
    },
    specialist: {
        name: 'Specialist',
        description: '전문가 팀 (디자이너, DB 엔지니어, 보안, 리팩토링)'
    },
    emergency: {
        name: 'Emergency Response',
        description: '긴급 대응 팀 (추론, 디버깅, 수정)'
    }
};

// 에이전트 ID → 한글 이름 매핑
export const AGENT_NAMES: Record<AgentId, string> = {
    planner: '기획자',
    frontend: '프론트엔드',
    backend: '백엔드',
    qa: 'QA',
    tester: '테스터',
    designer: '디자이너',
    db_engineer: 'DB 엔지니어',
    security: '보안',
    refactor: '리팩토링',
    sequential: '순차 추론',
    debugger: '디버거',
    healer: '힐러'
};

// 워크플로우 정보
export const WORKFLOW_INFO: Record<WorkflowId, { name: string; description: string; agents: AgentId[] }> = {
    'feature-development': {
        name: '기능 개발',
        description: '새 기능 개발을 위한 전체 파이프라인',
        agents: ['planner', 'db_engineer', 'backend', 'frontend', 'qa', 'tester']
    },
    'emergency-fix': {
        name: '긴급 수정',
        description: '에러 분석 후 수정 적용',
        agents: ['debugger', 'healer', 'tester']
    },
    'custom': {
        name: '커스텀',
        description: '사용자 정의 워크플로우',
        agents: []
    }
};
