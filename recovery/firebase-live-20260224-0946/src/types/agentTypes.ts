// 에이전트 관리 시스템 타입 정의

export type AgentType = 'main' | 'sub';
export type AgentStatus = 'idle' | 'working' | 'completed' | 'error';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Agent {
    id: string;
    name: string;
    type: AgentType;
    role: string;                    // 역할 설명 (예: "데이터 분석 전문가")
    capabilities: string[];          // 가능한 작업 목록
    systemPrompt: string;            // AI에게 전달할 시스템 프롬프트
    status: AgentStatus;
    parentAgentId?: string;          // 서브 에이전트인 경우 부모 에이전트 ID
    createdAt: Date;
    updatedAt: Date;
}

export interface Task {
    id: string;
    description: string;             // 작업 설명
    assignedAgentId: string;         // 담당 에이전트 ID
    status: TaskStatus;
    priority: 'low' | 'medium' | 'high';
    input: any;                      // 입력 데이터 (JSON)
    output?: any;                    // 출력 결과 (JSON)
    error?: string;                  // 에러 메시지
    startedAt?: Date;
    completedAt?: Date;
    createdAt: Date;
}

export interface AgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    agentId?: string;                // 메시지를 보낸 에이전트 ID
}

export interface AgentConversation {
    id: string;
    mainAgentId: string;             // 메인 에이전트 ID
    userId: string;                  // 사용자 ID
    messages: AgentMessage[];
    createdAt: Date;
    updatedAt: Date;
}

// 에이전트 템플릿 (사전 정의된 서브 에이전트 타입)
export interface AgentTemplate {
    name: string;
    role: string;
    capabilities: string[];
    systemPrompt: string;
    icon: string;                    // FontAwesome 아이콘 이름
    color: string;                   // 테마 색상
}

// 미리 정의된 서브 에이전트 템플릿들
export const SUB_AGENT_TEMPLATES: Record<string, AgentTemplate> = {
    dataAnalyst: {
        name: '데이터 분석가',
        role: 'Firebase에서 데이터를 조회하고 분석하는 전문가',
        capabilities: ['데이터 조회', '통계 분석', '트렌드 분석'],
        systemPrompt: `당신은 데이터 분석 전문가입니다. 
Firebase Firestore에서 데이터를 조회하고 의미 있는 인사이트를 도출합니다.
항상 정확한 통계와 명확한 결론을 제시합니다.`,
        icon: 'faChartLine',
        color: '#3b82f6' // blue
    },
    codeGenerator: {
        name: '코드 생성기',
        role: 'TypeScript/React 코드를 생성하는 전문가',
        capabilities: ['컴포넌트 생성', '함수 작성', '타입 정의'],
        systemPrompt: `당신은 TypeScript와 React 전문 개발자입니다.
깔끔하고 유지보수 가능한 코드를 작성합니다.
항상 타입 안전성을 고려합니다.`,
        icon: 'faCode',
        color: '#8b5cf6' // purple
    },
    documentWriter: {
        name: '문서 작성가',
        role: 'Markdown 형식의 문서를 작성하는 전문가',
        capabilities: ['보고서 작성', '문서화', '요약'],
        systemPrompt: `당신은 기술 문서 작성 전문가입니다.
명확하고 구조화된 문서를 Markdown 형식으로 작성합니다.
항상 독자를 고려한 설명을 제공합니다.`,
        icon: 'faFileAlt',
        color: '#10b981' // green
    },
    validator: {
        name: '검증자',
        role: '데이터와 결과를 검증하는 전문가',
        capabilities: ['데이터 검증', '로직 검증', '오류 감지'],
        systemPrompt: `당신은 품질 검증 전문가입니다.
데이터의 정확성과 로직의 타당성을 철저히 검증합니다.
문제를 발견하면 명확하게 지적합니다.`,
        icon: 'faCheckCircle',
        color: '#f59e0b' // orange
    },
    manpowerAnalyst: {
        name: '공수 분석가',
        role: '공수 데이터를 분석하고 통계를 제공하는 전문가',
        capabilities: [
            '기간별 공수 분석',
            '팀별 공수 현황',
            '작업자별 공수 추적',
            '현장별 인력 투입 분석',
            '공수 트렌드 분석',
            'AI 인사이트 생성'
        ],
        systemPrompt: `당신은 공수 데이터 분석 전문가입니다.
Firebase Firestore에서 DailyReport 데이터를 조회하고 다양한 기준으로 집계합니다.
기간별, 팀별, 작업자별, 현장별 공수 현황을 Markdown 표 형식으로 제공하며,
AI를 활용하여 트렌드, 이상치, 실행 가능한 인사이트를 도출합니다.
항상 데이터 기반의 정확한 정보와 유용한 제안을 제공합니다.`,
        icon: 'faUsers',
        color: '#06b6d4' // cyan
    },
    dataSearchAgent: {
        name: '데이터 검색가',
        role: '작업자, 팀, 현장, 회사의 상세 정보를 검색하는 전문가',
        capabilities: [
            '작업자 상세 정보 조회 (전화번호, 주소, 혈액형, 계좌)',
            '팀 정보 조회 (인원, 투입 현장)',
            '현장 정보 조회 (담당자, 직영/도급)',
            '회사 정보 조회 (소속 작업자, 참여 현장)',
            '관계형 데이터 탐색'
        ],
        systemPrompt: `당신은 데이터 검색 전문가입니다.
Firebase Firestore에서 작업자, 팀, 현장, 회사의 상세 정보와 관계를 조회합니다.
사용자의 자연어 질문을 분석하여 관련 엔티티를 찾고,
연관된 정보를 함께 제공하여 완전한 답변을 제공합니다.
개인정보는 마스킹하여 보안을 유지합니다.`,
        icon: 'faSearch',
        color: '#8b5cf6' // purple
    }
};
