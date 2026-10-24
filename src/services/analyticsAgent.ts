import { trackedGeminiFetch } from './geminiUsageFetch';
import { DEFAULT_GEMINI_TEXT_MODEL } from './geminiModelPolicy';
/**
 * AI 분석 에이전트
 * 
 * Gemini AI를 사용하여 사용자 질의를 분석하고
 * 공수 데이터를 조회하여 Markdown 표 형식으로 응답 생성
 */

import { manpowerAnalyticsService } from './manpowerAnalyticsService';
import { aiSettingsService } from './aiSettingsService';
import { getKoreanDateKey, shiftDateKey } from '../utils/koreanBusinessDate';

// ===========================
// Types
// ===========================

interface AnalysisRequest {
    userQuery: string;
    userId?: string;
}

interface AnalysisResponse {
    markdown: string;
    rawData?: any;
    insights?: string[];
}

// ===========================
// Helper Functions
// ===========================

/**
 * 현재 날짜 기준으로 기간 계산
 */
export function calculatePeriod(periodType: string, now: Date = new Date()): { startDate: string; endDate: string } {
    const today = getKoreanDateKey(now);
    const monthStart = `${today.slice(0, 7)}-01`;
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();

    switch (periodType) {
        case 'today':
            return { startDate: today, endDate: today };

        case 'yesterday':
            const yesterday = shiftDateKey(today, -1);
            return { startDate: yesterday, endDate: yesterday };

        case 'this_week':
            return { startDate: shiftDateKey(today, -weekday), endDate: today };

        case 'last_week':
            return {
                startDate: shiftDateKey(today, -weekday - 7),
                endDate: shiftDateKey(today, -weekday - 1)
            };

        case 'this_month':
            return { startDate: monthStart, endDate: today };

        case 'last_month':
            const lastMonthEnd = shiftDateKey(monthStart, -1);
            return {
                startDate: `${lastMonthEnd.slice(0, 7)}-01`,
                endDate: lastMonthEnd
            };

        case 'this_year':
            return { startDate: `${today.slice(0, 4)}-01-01`, endDate: today };

        default:
            // 기존 범위 유지: 오늘-7일부터 오늘까지 (양 끝 포함)
            return { startDate: shiftDateKey(today, -7), endDate: today };
    }
}

/**
 * 숫자를 한국 통화 형식으로 포맷
 */
function formatCurrency(amount: number): string {
    return `₩${amount.toLocaleString('ko-KR')}`;
}

/**
 * Gemini AI 호출
 */
async function callGemini(prompt: string): Promise<string> {
    aiSettingsService.assertCurrentPageEnabled('AI 에이전트 분석');
    
    

    const model = aiSettingsService.getModels().textModel || DEFAULT_GEMINI_TEXT_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await trackedGeminiFetch('analytics-agent')(
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
    if (data.error) throw new Error(data.error.message);

    return data.candidates[0].content.parts[0].text;
}

// ===========================
// Main Analytics Agent
// ===========================

export class AnalyticsAgent {
    /**
     * 사용자 질의 분석 및 처리
     */
    async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
        const { userQuery } = request;

        // 1. AI로 질의 의도 파악
        const intent = await this.parseIntent(userQuery);

        // 2. 데이터 조회
        let data: any;
        let markdown = '';

        try {
            switch (intent.type) {
                case 'team_manpower':
                    data = await manpowerAnalyticsService.getTeamManpower(
                        intent.startDate!,
                        intent.endDate!
                    );
                    markdown = this.formatTeamManpowerTable(data, intent);
                    break;

                case 'worker_manpower':
                    data = await manpowerAnalyticsService.getWorkerManpower(
                        intent.startDate!,
                        intent.endDate!,
                        intent.workerName
                    );
                    markdown = this.formatWorkerManpowerTable(data, intent);
                    break;

                case 'site_manpower':
                    data = await manpowerAnalyticsService.getSiteManpower(
                        intent.startDate!,
                        intent.endDate!
                    );
                    markdown = this.formatSiteManpowerTable(data, intent);
                    break;

                case 'statistics':
                    data = await manpowerAnalyticsService.getManpowerStatistics(
                        intent.startDate!,
                        intent.endDate!
                    );
                    markdown = this.formatStatisticsTable(data, intent);
                    break;

                default:
                    markdown = '죄송합니다. 해당 질문을 이해하지 못했습니다.';
            }

            // 3. AI 인사이트 생성
            const insights = await this.generateInsights(userQuery, data);

            return {
                markdown: markdown + '\n\n' + insights,
                rawData: data
            };

        } catch (error: any) {
            return {
                markdown: `⚠️ **오류 발생**\n\n${error.message}`
            };
        }
    }

    /**
     * 사용자 질의 의도 파악
     */
    private async parseIntent(userQuery: string): Promise<{
        type: 'team_manpower' | 'worker_manpower' | 'site_manpower' | 'statistics';
        startDate?: string;
        endDate?: string;
        workerName?: string;
        siteName?: string;
        periodType?: string;
    }> {
        const query = userQuery.toLowerCase();

        // 기간 파악
        let periodType = 'this_month';
        if (query.includes('오늘') || query.includes('today')) {
            periodType = 'today';
        } else if (query.includes('어제') || query.includes('yesterday')) {
            periodType = 'yesterday';
        } else if (query.includes('이번 주') || query.includes('this week')) {
            periodType = 'this_week';
        } else if (query.includes('지난 주') || query.includes('last week')) {
            periodType = 'last_week';
        } else if (query.includes('이번 달') || query.includes('this month')) {
            periodType = 'this_month';
        } else if (query.includes('지난 달') || query.includes('last month')) {
            periodType = 'last_month';
        } else if (query.includes('올해') || query.includes('this year')) {
            periodType = 'this_year';
        }

        const { startDate, endDate } = calculatePeriod(periodType);

        // 질의 타입 파악
        if (query.includes('팀별') || (query.includes('팀') && query.includes('공수'))) {
            return { type: 'team_manpower', startDate, endDate, periodType };
        }

        if (query.includes('작업자') || query.includes('근로자') || query.includes('이름')) {
            // 작업자 이름 추출 시도
            const nameMatch = userQuery.match(/([가-힣]{2,4})\s*(작업자|님|씨)?/);
            const workerName = nameMatch ? nameMatch[1] : undefined;
            return { type: 'worker_manpower', startDate, endDate, workerName, periodType };
        }

        if (query.includes('현장별') || (query.includes('현장') && query.includes('공수'))) {
            return { type: 'site_manpower', startDate, endDate, periodType };
        }

        if (query.includes('통계') || query.includes('전체') || query.includes('요약')) {
            return { type: 'statistics', startDate, endDate, periodType };
        }

        // 기본값: 전체 통계
        return { type: 'statistics', startDate, endDate, periodType };
    }

    /**
     * 팀별 공수 표 포맷
     */
    private formatTeamManpowerTable(data: any[], intent: any): string {
        const periodText = this.getPeriodText(intent.periodType, intent.startDate, intent.endDate);

        let markdown = `## 📊 팀별 공수 현황\n\n**${periodText}**\n\n`;

        if (data.length === 0) {
            return markdown + '*데이터가 없습니다.*';
        }

        markdown += '| 순위 | 팀명 | 총 공수 | 투입 인원 | 작업일 | 평균 일일 공수 | 총 금액 |\n';
        markdown += '|------|------|---------|-----------|--------|----------------|----------|\n';

        data.forEach((team, idx) => {
            markdown += `| ${idx + 1} | ${team.teamName} | ${team.totalManDay.toFixed(1)} | ${team.workerCount}명 | ${team.days}일 | ${team.avgDailyManDay.toFixed(1)} | ${formatCurrency(team.totalAmount)} |\n`;
        });

        return markdown;
    }

    /**
     * 작업자별 공수 표 포맷
     */
    private formatWorkerManpowerTable(data: any[], intent: any): string {
        const periodText = this.getPeriodText(intent.periodType, intent.startDate, intent.endDate);
        const titleSuffix = intent.workerName ? ` - ${intent.workerName}` : '';

        let markdown = `## 👤 작업자별 공수 현황${titleSuffix}\n\n**${periodText}**\n\n`;

        if (data.length === 0) {
            return markdown + '*데이터가 없습니다.*';
        }

        markdown += '| 순위 | 이름 | 총 공수 | 출근일 | 평균 공수 | 투입 현장 | 총 금액 |\n';
        markdown += '|------|------|---------|--------|-----------|-----------|----------|\n';

        data.slice(0, 50).forEach((worker, idx) => {
            markdown += `| ${idx + 1} | ${worker.workerName} | ${worker.totalManDay.toFixed(1)} | ${worker.workDays}일 | ${worker.avgManDay.toFixed(2)} | ${worker.sites.join(', ')} | ${formatCurrency(worker.totalAmount)} |\n`;
        });

        if (data.length > 50) {
            markdown += `\n*상위 50명만 표시 (전체 ${data.length}명)*\n`;
        }

        return markdown;
    }

    /**
     * 현장별 공수 표 포맷
     */
    private formatSiteManpowerTable(data: any[], intent: any): string {
        const periodText = this.getPeriodText(intent.periodType, intent.startDate, intent.endDate);

        let markdown = `## 🏗️ 현장별 공수 현황\n\n**${periodText}**\n\n`;

        if (data.length === 0) {
            return markdown + '*데이터가 없습니다.*';
        }

        markdown += '| 순위 | 현장명 | 총 공수 | 투입 인원 | 투입 팀 | 작업일 | 총 금액 |\n';
        markdown += '|------|--------|---------|-----------|---------|--------|----------|\n';

        data.forEach((site, idx) => {
            markdown += `| ${idx + 1} | ${site.siteName} | ${site.totalManDay.toFixed(1)} | ${site.workerCount}명 | ${site.teamCount}개 | ${site.days}일 | ${formatCurrency(site.totalAmount)} |\n`;
        });

        return markdown;
    }

    /**
     * 전체 통계 표 포맷
     */
    private formatStatisticsTable(data: any, intent: any): string {
        const periodText = this.getPeriodText(intent.periodType, intent.startDate, intent.endDate);

        let markdown = `## 📈 전체 공수 통계\n\n**${periodText}**\n\n`;

        markdown += '| 항목 | 값 |\n';
        markdown += '|------|----|\n';
        markdown += `| 총 공수 | ${data.totalManDay.toFixed(1)} |\n`;
        markdown += `| 투입 인원 | ${data.totalWorkers}명 |\n`;
        markdown += `| 평균 일일 공수 | ${data.avgManDay.toFixed(1)} |\n`;
        markdown += `| 최대 일일 공수 | ${data.maxManDay.toFixed(1)} |\n`;
        markdown += `| 최소 일일 공수 | ${data.minManDay.toFixed(1)} |\n`;
        markdown += `| 총 금액 | ${formatCurrency(data.totalAmount)} |\n`;

        return markdown;
    }

    /**
     * 기간 텍스트 생성
     */
    private getPeriodText(periodType: string, startDate: string, endDate: string): string {
        const periodNames: Record<string, string> = {
            'today': '오늘',
            'yesterday': '어제',
            'this_week': '이번 주',
            'last_week': '지난 주',
            'this_month': '이번 달',
            'last_month': '지난 달',
            'this_year': '올해'
        };

        const periodName = periodNames[periodType] || '';
        return `${periodName} (${startDate} ~ ${endDate})`;
    }

    /**
     * AI 인사이트 생성
     */
    private async generateInsights(userQuery: string, data: any): Promise<string> {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            return '';
        }

        try {
            const prompt = `다음은 공수 데이터 분석 결과입니다:

사용자 질문: ${userQuery}

데이터:
${JSON.stringify(data, null, 2)}

위 데이터를 바탕으로 3가지 핵심 인사이트를 제공해주세요:
1. 가장 주목할 만한 통계
2. 트렌드나 패턴
3. 실행 가능한 제안

응답 형식:
💡 **인사이트:**
- [인사이트 1]
- [인사이트 2]
- [인사이트 3]

각 인사이트는 한 줄로 간결하게 작성해주세요.`;

            const insights = await callGemini(prompt);
            return insights;

        } catch (error) {
            return '';
        }
    }
}

// Singleton instance
export const analyticsAgent = new AnalyticsAgent();
