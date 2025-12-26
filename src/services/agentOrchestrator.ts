// 에이전트 오케스트레이터 - 간단한 키워드 기반 처리
import { Agent, Task, SUB_AGENT_TEMPLATES } from '../types/agentTypes';
import { agentService, taskService } from './agentService';
import { agentDataTools } from './agentDataService';

// 오늘 날짜 구하기
function getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// 사용자 요청 분석 및 처리
async function processDataQuery(userRequest: string): Promise<string> {
    const request = userRequest.toLowerCase();

    try {
        // 통계 요청
        if (request.includes('통계') || request.includes('전체') || request.includes('요약')) {
            console.log('[Query] Getting statistics');
            const stats = await agentDataTools.getStatistics({});
            return `📊 **전체 통계**\n\n` +
                `- 총 공수: ${stats.totalManDays} man-day\n` +
                `- 재직 작업자: ${stats.totalWorkers}명\n` +
                `- 운영 현장: ${stats.totalSites}개\n` +
                `- 활동 팀: ${stats.totalTeams}개`;
        }

        // 일보 조회
        if (request.includes('일보')) {
            console.log('[Query] Querying daily reports');
            const today = getTodayDate();
            const reports = await agentDataTools.queryDailyReports({
                startDate: today,
                endDate: today,
                limitCount: 10
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
        if (request.includes('급여') || request.includes('월급') || request.includes('임금') || request.includes('월급')) {
            console.log('[Query] Querying salary');

            // "김철수 11월 급여" 패턴 매칭
            const salaryPattern = /(.+?)\s*(?:작업자|근로자)?\s*(\d{1,2})월\s*급여/;
            const match = userRequest.match(salaryPattern);

            if (match) {
                const workerName = match[1].trim();
                const month = match[2];

                // 현재 연도 사용
                const year = new Date().getFullYear();
                const monthStr = `${year}-${month.padStart(2, '0')}`;

                console.log(`[Salary] Querying ${workerName} for ${monthStr}`);

                try {
                    const result = await agentDataTools.queryWorkerSalary({
                        workerName,
                        month: monthStr
                    });

                    // 포맷팅
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
                        `└─────────────────────────┘\n\n` +
                        `**상세 내역** (최근 5건)\n` +
                        result.breakdown.slice(0, 5).map(b =>
                            `- ${b.date}: ${b.siteName} ${b.manDay}공수 (${formatter.format(b.amount)}원)`
                        ).join('\n') +
                        (result.breakdown.length > 5 ? `\n...(외 ${result.breakdown.length - 5}건)` : '');

                } catch (error) {
                    return `❌ 급여 조회 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
                }
            }

            // 일반 급여 정보 요청
            return '급여를 조회하려면 "작업자명 O월 급여" 형식으로 요청하세요.\n' +
                '예: "김철수 11월 급여"';
        }

        // 작업자 조회
        if (request.includes('작업자') || request.includes('근로자')) {
            console.log('[Query] Querying workers');

            if (request.includes('미배정')) {
                const workers = await agentDataTools.queryWorkers({
                    status: '미배정',
                    limitCount: 20
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

            return `👷 **재직 중인 작업자**\n\n총 ${workers.length}명이 재직 중입니다.`;
        }

        // 현장 조회
        if (request.includes('현장')) {
            console.log('[Query] Querying sites');
            const sites = await agentDataTools.querySites({ limitCount: 50 });

            const siteList = sites.slice(0, 10).map((s, i) =>
                `${i + 1}. ${s.name}${s.companyName ? ` (${s.companyName})` : ''}`
            ).join('\n');

            return `🏗️ **현장 목록** (총 ${sites.length}개)\n\n${siteList}` +
                (sites.length > 10 ? `\n\n...(외 ${sites.length - 10}개)` : '');
        }

        // 팀 조회
        if (request.includes('팀')) {
            console.log('[Query] Querying teams');

            // 팀 간 공수 이동 분석
            const crossTeamPattern = /(.+?)팀(?:이|가)?\s*(.+?)팀.*(?:공수|일)/;
            const match = userRequest.match(crossTeamPattern);

            if (match) {
                const fromTeamName = match[1].trim();
                const toTeamName = match[2].trim();

                console.log(`[Cross Team] Analyzing: ${fromTeamName} → ${toTeamName}`);

                try {
                    // 이번 달 날짜 구하기
                    const now = new Date();
                    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const endDate = getTodayDate();

                    const result = await agentDataTools.analyzeCrossTeamManDays({
                        fromTeamName,
                        toTeamName,
                        startDate,
                        endDate
                    });

                    if (result.totalManDays === 0) {
                        return `📊 **팀 간 공수 이동 분석**\n\n` +
                            `${fromTeamName}팀 소속 작업자가 ${toTeamName}팀으로 일하러 간 공수가 없습니다.\n` +
                            `(기간: ${startDate} ~ ${endDate})`;
                    }

                    const workerList = result.workerDetails.map((w, i) =>
                        `${i + 1}. ${w.workerName}: ${w.manDays} man-day (${w.dates.length}일)`
                    ).join('\n');

                    return `📊 **팀 간 공수 이동 분석**\n\n` +
                        `**${fromTeamName}팀** → **${toTeamName}팀**\n` +
                        `**기간**: ${startDate} ~ ${endDate}\n` +
                        `**총 공수**: ${result.totalManDays} man-day\n\n` +
                        `**작업자별 상세:**\n${workerList}`;

                } catch (error) {
                    return `❌ 팀 간 공수 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
                }
            }

            // 일반 팀 목록 조회
            const teams = await agentDataTools.queryTeams({ limitCount: 50 });

            const teamList = teams.slice(0, 10).map((t, i) =>
                `${i + 1}. ${t.name}${t.type ? ` (${t.type})` : ''}`
            ).join('\n');

            return `👥 **팀 목록** (총 ${teams.length}개)\n\n${teamList}` +
                (teams.length > 10 ? `\n\n...(외 ${teams.length - 10}개)` : '');
        }

        // 기본 응답
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

// Gemini AI 호출 (일반 대화용)
async function callGeminiSimple(prompt: string): Promise<string> {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        throw new Error('Gemini API Key가 설정되지 않았습니다');
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
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
    if (data.error) throw new Error(data.error.message);

    return data.candidates[0].content.parts[0].text;
}

export class AgentOrchestrator {
    private mainAgentId: string;

    constructor(mainAgentId: string) {
        this.mainAgentId = mainAgentId;
    }

    async processRequest(userRequest: string): Promise<string> {
        try {
            console.log('[AgentOrchestrator] Processing request:', userRequest);

            // 데이터 조회가 필요한 요청인지 확인
            const dataKeywords = ['일보', '작업자', '근로자', '현장', '팀', '통계', '공수', '미배정', '재직'];
            const needsData = dataKeywords.some(keyword => userRequest.includes(keyword));

            if (needsData) {
                console.log('[AgentOrchestrator] Data query detected');
                const result = await processDataQuery(userRequest);
                console.log('[AgentOrchestrator] Result:', result);
                return result;
            }

            // 일반 대화
            console.log('[AgentOrchestrator] General conversation');
            const result = await callGeminiSimple(
                `당신은 청연ENG ERP의 친절한 AI 어시스턴트입니다. 간단명료하게 답변하세요.\n\n사용자: ${userRequest}`
            );
            console.log('[AgentOrchestrator] Result:', result);
            return result;

        } catch (error) {
            console.error('[AgentOrchestrator] Error:', error);
            return `❌ 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
        }
    }
}
