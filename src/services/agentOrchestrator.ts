/**
 * 개선된 에이전트 오케스트레이터
 * 스마트 작업 분배, 진행 추적, 병렬 처리 지원
 */
import { agentDataTools } from './agentDataService';
import { menuServiceV11 } from './menuServiceV11';
import { SUB_AGENT_TEMPLATES } from '../types/agentTypes';
import { ProcessStep } from '../pages/developer/components/ProcessSteps';
import { analyticsAgent } from './analyticsAgent';
import { dataSearchAgent } from './dataSearchAgent';
import { aiSettingsService } from './aiSettingsService';

export type OrchestrationCallback = (step: ProcessStep) => void;

export interface OrchestrationOptions {
    onProgress?: OrchestrationCallback;
    onComplete?: (result: string) => void;
    onError?: (error: Error) => void;
}

// 작업 유형 정의
type TaskType = 'data_query' | 'statistics' | 'worker_info' | 'site_info' | 'general' | 'menu_sync' | 'salary' | 'manpower_analysis' | 'data_search';

// 오늘 날짜 구하기
function getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Gemini AI 호출
async function callGeminiSimple(prompt: string): Promise<string> {
    const apiKey = aiSettingsService.getApiKey();
    if (!apiKey) {
        return 'Gemini API Key가 설정되지 않아 일반 대화 응답을 생성할 수 없습니다.\n\n' +
            '- 데이터 조회형 질문(예: "오늘 일보 몇 건?")은 API Key 없이도 동작합니다.\n' +
            '- 일반 대화형 응답이 필요하면 /settings/ai 에서 API Key를 설정해 주세요.';
    }

    try {
        aiSettingsService.assertCurrentPageEnabled('AI 에이전트 대화');
        const model = aiSettingsService.getModels().textModel || 'gemini-2.5-flash';
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(
            endpoint,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }]
                })
            }
        );

        const data = await response.json();
        if (data?.error?.message) {
            const msg = String(data.error.message);
            if (msg.toLowerCase().includes('api key not valid')) {
                return 'Gemini API Key가 유효하지 않아 일반 대화 응답을 생성할 수 없습니다.\n\n' +
                    '- 현재 요청이 데이터 조회/검색이면 Gemini 없이도 처리됩니다.\n' +
                    '- 일반 대화형 응답이 필요하면 /settings/ai 에서 API Key를 올바르게 설정해 주세요.';
            }
            return `Gemini 호출 오류: ${msg}`;
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Gemini 응답을 생성할 수 없습니다.';
    } catch (error) {
        return `Gemini 호출 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
    }
}

export class EnhancedAgentOrchestrator {
    private mainAgentId: string;
    private onProgress?: OrchestrationCallback;

    constructor(mainAgentId: string, options?: OrchestrationOptions) {
        this.mainAgentId = mainAgentId;
        this.onProgress = options?.onProgress;
    }

    /**
     * 작업 유형 분석
     */
    private analyzeTaskType(userRequest: string): TaskType {
        const request = userRequest.toLowerCase();

        // 데이터 검색 (최우선 - 구체적인 정보 요청)
        if (request.includes('전화번호') || request.includes('주소') || request.includes('혈액형') ||
            request.includes('계좌') || request.includes('인원') || request.includes('담당자') ||
            request.includes('직영') || request.includes('도급') || request.includes('협력사')) {
            return 'data_search';
        }

        // 데이터 검색 (일반 표현)
        // 예: "데이터 검색", "찾아줘", "알려줘" 등은 키워드 기반 라우팅이 누락되기 쉬움
        if (request.includes('검색') || request.includes('찾아') || request.includes('알려줘') || request.includes('알려 줘')) {
            return 'data_search';
        }
        // 공수 분석 관련
        if (request.includes('공수') || request.includes('인력') || request.includes('투입')) {
            return 'manpower_analysis';
        }
        if (request.includes('메뉴') && (request.includes('동기화') || request.includes('sync'))) {
            return 'menu_sync';
        }
        if (request.includes('급여') || request.includes('월급') || request.includes('임금')) {
            return 'salary';
        }
        if (request.includes('통계') || request.includes('전체') || request.includes('요약')) {
            return 'statistics';
        }
        if (request.includes('일보')) {
            return 'data_query';
        }
        if (request.includes('작업자') || request.includes('근로자')) {
            return 'worker_info';
        }
        if (request.includes('현장') || request.includes('팀')) {
            return 'site_info';
        }

        return 'general';
    }

    /**
     * 필요한 에이전트 선택
     */
    private selectAgent(taskType: TaskType): string {
        switch (taskType) {
            case 'data_search':
                return SUB_AGENT_TEMPLATES.dataSearchAgent.name;
            case 'manpower_analysis':
                return SUB_AGENT_TEMPLATES.manpowerAnalyst.name;
            case 'data_query':
            case 'statistics':
            case 'salary':
            case 'worker_info':
            case 'site_info':
                return SUB_AGENT_TEMPLATES.dataAnalyst.name;
            case 'menu_sync':
                return '시스템 관리자';
            case 'general':
            default:
                return '일반 어시스턴트';
        }
    }

    /**
     * 진행 상황 알림
     */
    private notifyProgress(step: ProcessStep): void {
        this.onProgress?.(step);
    }

    /**
     * 데이터 조회 처리
     */
    private async processDataQuery(userRequest: string): Promise<string> {
        const request = userRequest.toLowerCase();

        try {
            // 데이터 검색 ("검색/찾아줘/알려줘" 포함)
            if (request.includes('검색') || request.includes('찾아') || request.includes('알려줘') || request.includes('알려 줘') ||
                request.includes('전화번호') || request.includes('주소') || request.includes('혈액형') ||
                request.includes('계좌') || request.includes('인원') || request.includes('담당자') ||
                request.includes('직영') || request.includes('도급') || request.includes('협력사')) {

                this.notifyProgress({
                    id: 'data-search',
                    label: '데이터 검색 실행',
                    status: 'processing',
                    startTime: new Date()
                });

                const searchResult = await dataSearchAgent.search({ query: userRequest });

                this.notifyProgress({
                    id: 'data-search',
                    label: '데이터 검색 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                return searchResult.markdown;
            }

            // 데이터 검색 (작업자/팀/현장/회사 상세 정보)
            if (request.includes('전화번호') || request.includes('주소') || request.includes('혈액형') ||
                request.includes('계좌') || request.includes('인원') || request.includes('담당자') ||
                request.includes('직영') || request.includes('도급') || request.includes('협력사')) {

                this.notifyProgress({
                    id: 'data-search',
                    label: '데이터 검색 실행',
                    status: 'processing',
                    startTime: new Date()
                });

                const searchResult = await dataSearchAgent.search({ query: userRequest });

                this.notifyProgress({
                    id: 'data-search',
                    label: '데이터 검색 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                return searchResult.markdown;
            }

            // 공수 분석
            if (request.includes('공수') || request.includes('인력') || request.includes('투입')) {
                this.notifyProgress({
                    id: 'analytics',
                    label: '공수 분석 실행',
                    status: 'processing',
                    startTime: new Date()
                });

                const analysisResult = await analyticsAgent.analyze({ userQuery: userRequest });

                this.notifyProgress({
                    id: 'analytics',
                    label: '공수 분석 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                return analysisResult.markdown;
            }

            // 메뉴 동기화
            if (request.includes('메뉴') && (request.includes('동기화') || request.includes('sync'))) {
                this.notifyProgress({
                    id: 'menu-sync',
                    label: '메뉴 동기화 실행',
                    status: 'processing',
                    startTime: new Date()
                });

                const shouldBroadcast = request.includes('브로드캐스트') || request.includes('broadcast');

                if (shouldBroadcast) {
                    menuServiceV11.announceMenuChange('agent');
                }

                const result = await menuServiceV11.refreshFromServer();

                this.notifyProgress({
                    id: 'menu-sync',
                    label: '메뉴 동기화 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                return `🧭 **메뉴 동기화 점검 결과**\n\n` +
                    `- changed: ${result.changed ? 'true' : 'false'}\n` +
                    `- activeDocId: ${result.activeDocId}\n` +
                    (shouldBroadcast ? `- broadcast: triggered\n` : `- broadcast: skipped\n`) +
                    `\n` +
                    `다른 탭에서 즉시 반영이 필요하면 "메뉴 동기화 브로드캐스트"라고 입력하세요.`;
            }

            // 통계 요청
            if (request.includes('통계') || request.includes('전체') || request.includes('요약')) {
                this.notifyProgress({
                    id: 'stats',
                    label: '전체 통계 조회 중',
                    status: 'processing',
                    startTime: new Date()
                });

                const stats = await agentDataTools.getStatistics({});

                this.notifyProgress({
                    id: 'stats',
                    label: '통계 조회 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                return `📊 **전체 통계**\n\n` +
                    `- 총 공수: ${stats.totalManDays} man-day\n` +
                    `- 재직 작업자: ${stats.totalWorkers}명\n` +
                    `- 운영 현장: ${stats.totalSites}개\n` +
                    `- 활동 팀: ${stats.totalTeams}개`;
            }

            // 일보 조회
            if (request.includes('일보')) {
                this.notifyProgress({
                    id: 'daily-report',
                    label: '일보 데이터 조회 중',
                    status: 'processing',
                    startTime: new Date()
                });

                const today = getTodayDate();
                const reports = await agentDataTools.queryDailyReports({
                    startDate: today,
                    endDate: today,
                    limitCount: 10
                });

                this.notifyProgress({
                    id: 'daily-report',
                    label: '일보 조회 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                if (reports.length === 0) {
                    return '오늘 등록된 일보가 없습니다.';
                }

                const totalManDays = reports.reduce((sum, r) => {
                    const workers = r.workers || [];
                    return sum + workers.reduce((s, w) => s + (w.manDay || 0), 0);
                }, 0);

                return `📋 **오늘 일보 현황**\n\n` +
                    `- 등록 건수: ${reports.length}건\n` +
                    `- 총 공수: ${totalManDays} man-day\n` +
                    `- 작업 현장: ${new Set(reports.map(r => r.siteName)).size}곳`;
            }

            // 급여 조회
            if (request.includes('급여') || request.includes('월급') || request.includes('임금')) {
                const salaryPattern = /(.+?)\s*(?:작업자|근로자)?\s*(\d{1,2})월\s*급여/;
                const match = userRequest.match(salaryPattern);

                if (match) {
                    const workerName = match[1].trim();
                    const month = match[2];
                    const year = new Date().getFullYear();
                    const monthStr = `${year}-${month.padStart(2, '0')}`;

                    this.notifyProgress({
                        id: 'salary',
                        label: `${workerName} 급여 계산 중`,
                        status: 'processing',
                        startTime: new Date()
                    });

                    const result = await agentDataTools.queryWorkerSalary({
                        workerName,
                        month: monthStr
                    });

                    this.notifyProgress({
                        id: 'salary',
                        label: '급여 계산 완료',
                        status: 'completed',
                        startTime: new Date(),
                        endTime: new Date()
                    });

                    const formatter = new Intl.NumberFormat('ko-KR');

                    return `💰 **${result.workerInfo.name} ${month}월 급여**\n\n` +
                        `**작업자 정보**\n` +
                        `- 팀: ${result.workerInfo.team}\n` +
                        `- 단가: ${formatter.format(result.workerInfo.unitPrice)}원\n\n` +
                        `**근무 현황**\n` +
                        `- 출근일: ${result.workDays.totalDays}일\n` +
                        `- 총 공수: ${result.workDays.totalManDays} man-day\n\n` +
                        `**급여 내역**\n` +
                        `┌─────────────────────────┐\n` +
                        `│ 총 급여: ${formatter.format(result.salary.grossPay)}원\n` +
                        `│ 가  불: -${formatter.format(result.salary.advances)}원\n` +
                        `│ 세  금: -${formatter.format(result.salary.tax)}원 (3.3%)\n` +
                        `├─────────────────────────┤\n` +
                        `│ 실수령액: ${formatter.format(result.salary.netPay)}원\n` +
                        `└─────────────────────────┘`;
                }

                return '급여를 조회하려면 "작업자명 O월 급여" 형식으로 요청하세요.\n' +
                    '예: "김철수 11월 급여"';
            }

            // 작업자 조회
            if (request.includes('작업자') || request.includes('근로자')) {
                this.notifyProgress({
                    id: 'worker',
                    label: '작업자 정보 조회 중',
                    status: 'processing',
                    startTime: new Date()
                });

                if (request.includes('미배정')) {
                    const workers = await agentDataTools.queryWorkers({
                        status: '미배정',
                        limitCount: 20
                    });

                    this.notifyProgress({
                        id: 'worker',
                        label: '작업자 조회 완료',
                        status: 'completed',
                        startTime: new Date(),
                        endTime: new Date()
                    });

                    if (workers.length === 0) {
                        return '현재 미배정 작업자가 없습니다.';
                    }

                    const workerList = workers.slice(0, 10).map((w, i) =>
                        `${i + 1}. ${w.name} (${w.role || '직책 미등록'})`
                    ).join('\n');

                    return `👷 **미배정 작업자** (총 ${workers.length}명)\n\n${workerList}` +
                        (workers.length > 10 ? `\n\n...(외 ${workers.length - 10}명)` : '');
                }

                const workers = await agentDataTools.queryWorkers({
                    status: '재직',
                    limitCount: 100
                });

                this.notifyProgress({
                    id: 'worker',
                    label: '작업자 조회 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                return `👷 **재직 중인 작업자**\n\n총 ${workers.length}명이 재직 중입니다.`;
            }

            // 현장 조회
            if (request.includes('현장')) {
                this.notifyProgress({
                    id: 'site',
                    label: '현장 정보 조회 중',
                    status: 'processing',
                    startTime: new Date()
                });

                const sites = await agentDataTools.querySites({ limitCount: 50 });

                this.notifyProgress({
                    id: 'site',
                    label: '현장 조회 완료',
                    status: 'completed',
                    startTime: new Date(),
                    endTime: new Date()
                });

                const siteList = sites.slice(0, 10).map((s, i) =>
                    `${i + 1}. ${s.name}${s.companyName ? ` (${s.companyName})` : ''}`
                ).join('\n');

                return `🏗️ **현장 목록** (총 ${sites.length}개)\n\n${siteList}` +
                    (sites.length > 10 ? `\n\n...(외 ${sites.length - 10}개)` : '');
            }

            // 팀 조회
            if (request.includes('팀')) {
                const teams = await agentDataTools.queryTeams({ limitCount: 50 });

                const teamList = teams.slice(0, 10).map((t, i) =>
                    `${i + 1}. ${t.name}${t.type ? ` (${t.type})` : ''}`
                ).join('\n');

                return `👥 **팀 목록** (총 ${teams.length}개)\n\n${teamList}` +
                    (teams.length > 10 ? `\n\n...(외 ${teams.length - 10}개)` : '');
            }

            return '죄송합니다. 요청을 이해하지 못했습니다.\n\n' +
                '다음과 같은 질문을 시도해보세요:\n' +
                '- "오늘 일보 몇 건 등록됐어?"\n' +
                '- "재직 중인 작업자 몇 명이야?"\n' +
                '- "미배정 작업자 목록"\n' +
                '- "전체 통계 보여줘"';

        } catch (error) {
            console.error('[Query Error]:', error);
            throw error;
        }
    }

    /**
     * 요청 처리 (메인 진입점)
     */
    async processRequest(userRequest: string): Promise<string> {
        try {
            console.log('[EnhancedOrchestrator] Processing request:', userRequest);

            // 1단계: 작업 분석
            this.notifyProgress({
                id: 'analyze',
                label: '요청 분석 중',
                status: 'processing',
                message: '작업 유형을 파악하고 있습니다...',
                startTime: new Date()
            });

            const taskType = this.analyzeTaskType(userRequest);
            const selectedAgent = this.selectAgent(taskType);

            this.notifyProgress({
                id: 'analyze',
                label: '요청 분석 완료',
                status: 'completed',
                message: `${selectedAgent} 에이전트 선택됨`,
                startTime: new Date(),
                endTime: new Date()
            });

            // 2단계: 에이전트 할당
            this.notifyProgress({
                id: 'assign',
                label: '에이전트 할당',
                status: 'processing',
                message: `${selectedAgent}가 작업을 시작합니다...`,
                startTime: new Date()
            });

            await new Promise(resolve => setTimeout(resolve, 300)); // 시각적 효과

            this.notifyProgress({
                id: 'assign',
                label: '에이전트 할당 완료',
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            });

            // 3단계: 작업 실행
            this.notifyProgress({
                id: 'execute',
                label: '작업 실행 중',
                status: 'processing',
                message: '데이터를 처리하고 있습니다...',
                startTime: new Date()
            });

            let result: string;

            // taskType 기반으로 데이터 조회/검색 여부 결정
            // (전화번호/주소/계좌 등은 키워드 매칭에서 누락되기 쉬워서 taskType을 신뢰)
            const needsData = taskType !== 'general';

            if (needsData) {
                result = await this.processDataQuery(userRequest);
            } else {
                // 일반 대화
                result = await callGeminiSimple(
                    `당신은 청연ENG ERP의 친절한 AI 어시스턴트입니다. 간단명료하게 답변하세요.\n\n사용자: ${userRequest}`
                );
            }

            this.notifyProgress({
                id: 'execute',
                label: '작업 실행 완료',
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            });

            // 4단계: 결과 통합
            this.notifyProgress({
                id: 'finalize',
                label: '결과 정리 중',
                status: 'processing',
                startTime: new Date()
            });

            await new Promise(resolve => setTimeout(resolve, 200)); // 시각적 효과

            this.notifyProgress({
                id: 'finalize',
                label: '모든 작업 완료',
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            });

            console.log('[EnhancedOrchestrator] Result:', result);
            return result;

        } catch (error) {
            console.error('[EnhancedOrchestrator] Error:', error);

            this.notifyProgress({
                id: 'error',
                label: '오류 발생',
                status: 'error',
                message: error instanceof Error ? error.message : '알 수 없는 오류',
                startTime: new Date()
            });

            return `❌ 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        }
    }
}

// 하위 호환성을 위한 레거시 클래스 유지
export class AgentOrchestrator {
    private enhanced: EnhancedAgentOrchestrator;

    constructor(mainAgentId: string) {
        this.enhanced = new EnhancedAgentOrchestrator(mainAgentId);
    }

    async processRequest(userRequest: string): Promise<string> {
        return this.enhanced.processRequest(userRequest);
    }
}
