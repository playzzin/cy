/**
 * Gemini Analytics Service v3 — Production-Grade
 * 
 * 핵심 개선사항:
 *  1. Few-shot 예제 포함 Gemini 프롬프트 -> 다양한 패턴 정확히 파싱
 *  2. 쿼리 검증 + 자동 보정 레이어 -> 잘못된 날짜/타입 자동 수정
 *  3. 강화된 한국어 fuzzyMatch -> 건설업 용어, 접미사 제거, 부분매칭
 *  4. 디버그 메타데이터 -> 파싱 결과, 원본 건수, 필터 후 건수
 *  5. 에러 회복 + 친절한 안내 -> 백엔드 실패 시 명확한 메시지
 *  6. 복합 필터 조합 지원 -> "12월 1팀 일급제 현장별 공수"
 *  7. 모든 집계를 항상 생성 -> analysisType에 따라 UI가 선택 표시
 */

import { dailyReportService, DailyReport } from './dailyReportService';
import { aiSettingsService, normalizeGeminiModelName } from './aiSettingsService';
import { manpowerAnalyticsService, SUPPORT_DIRECTIONS, type SupportDirection } from './manpowerAnalyticsService';

// ===========================
// Types
// ===========================

export interface AnalyticsQuery {
    startDate: string;
    endDate: string;
    siteName?: string;
    teamName?: string;
    workerName?: string;
    companyName?: string;
    salaryModel?: string;
    workerTeamName?: string;
    supportDirection?: SupportDirection;
    // 비교분석용 이전 기간
    compareStartDate?: string;
    compareEndDate?: string;
    analysisType: AnalysisType;
}

export type AnalysisType =
    | 'worker_detail'
    | 'site_summary'
    | 'team_summary'
    | 'worker_ranking'
    | 'daily_summary'
    | 'support_analysis'
    | 'salary_model_analysis'
    | 'comparison'
    | 'general';

const VALID_ANALYSIS_TYPES: AnalysisType[] = [
    'worker_detail', 'site_summary', 'team_summary', 'worker_ranking',
    'daily_summary', 'support_analysis', 'salary_model_analysis', 'comparison', 'general'
];

const VALID_SUPPORT_DIRECTIONS: SupportDirection[] = SUPPORT_DIRECTIONS;

// --- Aggregated Summary Types ---

export interface TeamAggRow {
    teamName: string;
    totalManDay: number;
    totalAmount: number;
    workerCount: number;
    days: number;
    avgDailyManDay: number;
}

export interface SiteAggRow {
    siteName: string;
    totalManDay: number;
    totalAmount: number;
    workerCount: number;
    teamCount: number;
    days: number;
}

export interface WorkerAggRow {
    name: string;
    totalManDay: number;
    totalAmount: number;
    workDays: number;
    avgManDay: number;
    sites: string[];
    teams: string[];
    salaryModel: string;
}

export interface DailyAggRow {
    date: string;
    totalManDay: number;
    totalAmount: number;
    workerCount: number;
    teamCount: number;
    siteCount: number;
}

export interface SalaryModelAggRow {
    salaryModel: string;
    totalManDay: number;
    totalAmount: number;
    workerCount: number;
    workDays: number;
}

// --- Detail Row (raw) ---

export interface AnalyticsResultWorker {
    name: string;
    role: string;
    manDay: number;
    unitPrice: number;
    amount: number;
    payType?: string;
    salaryModel?: string;
    teamName?: string;
    siteName?: string;
}

export interface AnalyticsDetailRow {
    date: string;
    siteName: string;
    teamName: string;
    companyName?: string;
    workers: AnalyticsResultWorker[];
    totalManDay: number;
    totalAmount: number;
    workerCount: number;
}

// --- Debug Metadata ---

export interface AnalyticsDebug {
    rawReportCount: number;
    filteredReportCount: number;
    appliedFilters: string[];
    geminiRawResponse?: string;
    queryValidation: string[];
    timings: { parse: number; fetch: number; aggregate: number; insight: number };
}

// --- Main Result ---

export interface AnalyticsResult {
    success: boolean;
    query: AnalyticsQuery;
    parsedQuestion: string;

    teamAgg: TeamAggRow[];
    siteAgg: SiteAggRow[];
    workerAgg: WorkerAggRow[];
    dailyAgg: DailyAggRow[];
    salaryModelAgg: SalaryModelAggRow[];

    detailRows: AnalyticsDetailRow[];

    summary: {
        totalManDay: number;
        totalAmount: number;
        totalWorkers: number;
        totalReports: number;
        uniqueSites: string[];
        uniqueTeams: string[];
        dateRange: string;
    };
    aiInsight?: string;
    error?: string;
    debug?: AnalyticsDebug;
    // 비교분석용 이전 기간 데이터
    comparison?: {
        prevSummary: AnalyticsResult['summary'];
        prevTeamAgg: TeamAggRow[];
        prevSiteAgg: SiteAggRow[];
        prevWorkerAgg: WorkerAggRow[];
        prevPeriod: string;
    };
    // 애매한 팀 필터 시 대안 결과 (현장담당팀 vs 작업자소속팀)
    alternativeResult?: {
        label: string;  // e.g. "작업자 소속팀 기준"
        summary: AnalyticsResult['summary'];
        teamAgg: TeamAggRow[];
        siteAgg: SiteAggRow[];
        workerAgg: WorkerAggRow[];
    };
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    result?: AnalyticsResult;
    timestamp: number;
}

// ===========================
// Constants
// ===========================

const GEMINI_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_ANALYTICS_REQUEST_TIMEOUT_MS = 30_000;
const GEMINI_ANALYTICS_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const getAnalyticsModelCandidates = (): string[] => {
    const selectedModel = normalizeGeminiModelName(aiSettingsService.getModels().analyticsModel, 'gemini-2.5-flash');
    return Array.from(new Set([selectedModel, ...GEMINI_ANALYTICS_FALLBACK_MODELS].filter(Boolean)));
};

const shouldRetryWithFallbackModel = (status: number, message: string): boolean => {
    if (status && ![400, 403, 404, 429].includes(status)) return false;
    return /denied|permission|quota|resource_exhausted|not found|not supported|model|access|timeout|timed out/i.test(message);
};

const formatGeminiAnalyticsError = (error: unknown, attemptedModels: string[]): string => {
    const message = error instanceof Error ? error.message : String(error);

    if (/abort|timeout|timed out|시간.*초과/i.test(message)) {
        return `Gemini 통계 분석 응답이 ${GEMINI_ANALYTICS_REQUEST_TIMEOUT_MS / 1000}초 안에 오지 않았습니다. 네트워크 상태를 확인하거나 /settings/ai에서 통계 모델을 gemini-2.5-flash-lite로 바꾼 뒤 다시 시도해 주세요.`;
    }

    if (/project has been denied access|denied access|permission/i.test(message)) {
        return '현재 API 키의 Google Cloud 프로젝트가 Gemini 통계 분석 모델 접근을 거부했습니다. Billing 연결, Generative Language API 사용 설정, 모델 권한을 확인해 주세요.';
    }

    if (/api[_ -]?key[_ -]?invalid|invalid api key|key not valid/i.test(message)) {
        return '저장된 Gemini API 키가 유효하지 않습니다. /settings/ai 또는 localStorage의 gemini_api_key 값을 확인해 주세요.';
    }

    if (/quota|resource_exhausted|429/i.test(message)) {
        return 'Gemini API 사용량 한도 또는 분당 제한에 걸렸습니다. 잠시 후 다시 시도하거나 Google AI Studio/Cloud 콘솔에서 할당량을 확인해 주세요.';
    }

    return `${message}\n시도한 모델: ${attemptedModels.join(', ')}`;
};

// ===========================
// Enhanced System Prompt with Few-Shot Examples
// ===========================

function buildSystemPrompt(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const lastMonth = month === 1 ? 12 : month - 1;
    const lastMonthYear = month === 1 ? year - 1 : year;
    const lastMonthDays = new Date(lastMonthYear, lastMonth, 0).getDate();

    const mm = String(month).padStart(2, '0');
    const lm = String(lastMonth).padStart(2, '0');
    const lmDays = String(lastMonthDays);

    return `당신은 건설업 ERP 일보 데이터 분석용 JSON 파서입니다.
오늘: ${todayStr}

## 데이터 구조
- 일보: date(YYYY-MM-DD), teamName, siteName, companyName, workers[]
- 작업자: name, manDay(0~1.5), unitPrice, role, salaryModel(일급제/월급제/지원팀/용역팀)

## 출력: 유효한 JSON만 (텍스트/마크다운 금지)
{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"supportDirection":null,"compareStartDate":null,"compareEndDate":null,"analysisType":"...","parsedQuestion":"..."}

## compareStartDate / compareEndDate
- comparison 분석에서만 사용. 비교 대상 이전 기간.
- "이번달 vs 지난달" -> compareStartDate/compareEndDate = 지난달
- "12월 vs 11월" -> compareStartDate="YYYY-11-01", compareEndDate="YYYY-11-30"
- 비교 아닌 경우 null

## teamName vs workerTeamName (중요!)
- teamName: 현장 담당팀 (일보를 작성한 팀). "1팀 현장" "1팀 담당" "1팀이 담당하는"
- workerTeamName: 작업자 소속팀 (작업자가 소속된 팀). "1팀 소속 작업자" "1팀 인원" "1팀 사람들" "1팀 작업자"
- "1팀 공수" 같이 애매한 경우 → teamName 사용 (시스템이 자동으로 소속팀 결과도 대안으로 제공)
- 명확히 "소속" "인원" "작업자" 키워드가 있으면 → workerTeamName 사용

## 지원팀 분석 규칙
- supportDirection은 null 또는 다음 4개 중 하나만 사용: 외부지원간곳, 외부지원온곳, 내부지원간곳, 내부지원온곳
- 외부 + 온곳/들어온/받은/지원받은 => 외부지원온곳
- 외부 + 간곳/나간/보낸/지원간 => 외부지원간곳
- 내부 + 온곳/들어온/받은/지원받은 => 내부지원온곳
- 내부 + 간곳/나간/보낸/지원간 => 내부지원간곳
- 지원 질문에서 teamName은 현장담당팀/받은 팀, workerTeamName은 작업자 소속팀/보낸 팀으로 해석
- "지원", "지원팀", "용역", "외부지원", "내부지원", "온곳", "간곳" 질문은 analysisType=support_analysis

## analysisType
team_summary: 팀별/팀순위/팀공수/각팀
site_summary: 현장별/사이트별/현장순위
worker_detail: 누가출력/출력인원/출근/특정현장+인원
worker_ranking: 공수순위/TOP/랭킹/많이일한
daily_summary: 일별/추이/변화/날짜별
support_analysis: 지원팀/용역팀/지원분석
salary_model_analysis: 급여방식/일급제/월급제/급여별
comparison: 비교/vs/대비/증감/변화비교 (두 기간 비교)
general: 해당없음

## 날짜 규칙
- "N월"/"N월달" -> 해당월 1일~말일
- "N월 D일" -> 단일날짜(start=end)
- "지난달" -> ${lastMonthYear}-${lm}-01 ~ ${lastMonthYear}-${lm}-${lmDays}
- "이번달"/"이번 달" -> ${year}-${mm}-01 ~ ${todayStr}
- "올해" -> ${year}-01-01 ~ ${todayStr}
- "어제" -> 어제날짜(start=end)
- "오늘" -> ${todayStr}(start=end)
- 날짜미지정 -> 이번달 전체

## 예제

질문: "12월달 팀별 공수 순위 알려줘"
{"startDate":"${year}-12-01","endDate":"${year}-12-31","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"analysisType":"team_summary","parsedQuestion":"12월 팀별 공수 순위"}

질문: "12월 1일날 성남 탑엔지니어링에 출력한 인원들과 공수를 알려줘"
{"startDate":"${year}-12-01","endDate":"${year}-12-01","siteName":"탑엔지니어링","teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"analysisType":"worker_detail","parsedQuestion":"12월 1일 탑엔지니어링 현장 출력 인원과 공수"}

질문: "이번 달 1팀 담당 현장별 공수"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":"1팀","workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":"일급제","analysisType":"site_summary","parsedQuestion":"이번 달 1팀 담당 현장별 공수"}

질문: "1팀 소속 작업자 이번 달 공수"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":"1팀","workerName":null,"companyName":null,"salaryModel":null,"analysisType":"worker_detail","parsedQuestion":"이번 달 1팀 소속 작업자 공수"}

질문: "지난달 급여방식별 공수 분석해줘"
{"startDate":"${lastMonthYear}-${lm}-01","endDate":"${lastMonthYear}-${lm}-${lmDays}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"analysisType":"salary_model_analysis","parsedQuestion":"지난달 급여방식별 공수 분석"}

질문: "김철수 이번 달 공수"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":"김철수","companyName":null,"salaryModel":null,"analysisType":"worker_detail","parsedQuestion":"이번 달 김철수 공수 조회"}

질문: "지원팀 작업자들 이번 달 공수"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":"지원팀","analysisType":"support_analysis","parsedQuestion":"이번 달 지원팀 작업자 공수"}

질문: "올해 공수 TOP 10"
{"startDate":"${year}-01-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"analysisType":"worker_ranking","parsedQuestion":"올해 공수 상위 10명"}

질문: "이번 달 일별 추이"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"analysisType":"daily_summary","parsedQuestion":"이번 달 일별 공수 추이"}

질문: "이번 달 전체 현황"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"analysisType":"general","parsedQuestion":"이번 달 전체 현황 요약"}

질문: "이번 달 vs 지난달 팀별 공수 비교"
{"startDate":"${year}-${mm}-01","endDate":"${todayStr}","siteName":null,"teamName":null,"workerTeamName":null,"workerName":null,"companyName":null,"salaryModel":null,"compareStartDate":"${lastMonthYear}-${lm}-01","compareEndDate":"${lastMonthYear}-${lm}-${lmDays}","analysisType":"comparison","parsedQuestion":"이번 달 vs 지난달 팀별 공수 비교"}`;
}

const INSIGHT_PROMPT = `당신은 건설업 인력 데이터 분석 전문가입니다. 집계 데이터를 바탕으로 상세한 한국어 인사이트를 제공하세요.

## 필수 포함 항목 (해당되는 것만)
1. **핵심 요약**: 전체 규모 (총 공수, 인원, 금액)
2. **순위 분석**: 1위~3위 구체적 수치와 전체 대비 비율(%)
3. **편차 분석**: 최대/최소 차이, 평균 대비 특이값
4. **비율 분석**: 상위 3개가 전체에서 차지하는 비율
5. **주의 사항**: 데이터에서 발견되는 특이점 (공수 0인 팀, 편차가 큰 경우 등)

## 작성 규칙
- 모든 수치는 원본 데이터와 정확히 일치
- 비율은 소수점 1자리까지 (예: 45.3%)
- 4~6문장으로 구체적이고 실용적으로
- "~입니다"로 단정, 모호한 표현 금지
- 데이터에 없는 내용은 절대 추측 금지
- 이모지 사용 금지`;

// ===========================
// Gemini API Call
// ===========================

async function callGeminiText(prompt: string, systemInstruction?: string): Promise<string> {
    aiSettingsService.assertCurrentPageEnabled('AI 통계 분석');

    const geminiApiKey = aiSettingsService.getApiKey() || process.env.REACT_APP_GOOGLE_API_KEY || '';
    const modelCandidates = getAnalyticsModelCandidates();
    if (!geminiApiKey) {
        throw new Error('Google API 키가 설정되지 않았습니다. (/settings/ai)');
    }

    const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.05,
            maxOutputTokens: 4096,
            topP: 0.8,
        }
    };
    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    let lastError: Error | null = null;
    for (let index = 0; index < modelCandidates.length; index += 1) {
        const geminiModel = modelCandidates[index];
        const hasFallback = index < modelCandidates.length - 1;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_ANALYTICS_REQUEST_TIMEOUT_MS);

        try {
            const endpoint = `${GEMINI_API_URL_BASE}/${geminiModel}:generateContent?key=${geminiApiKey}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errText = await response.text();
                const error = new Error(`Gemini API 오류 (${response.status}, ${geminiModel}): ${errText.substring(0, 500)}`);
                if (hasFallback && shouldRetryWithFallbackModel(response.status, errText)) {
                    lastError = error;
                    continue;
                }
                throw error;
            }

            const data = await response.json();
            return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        } catch (error) {
            const isAbort = error instanceof Error && error.name === 'AbortError';
            const normalizedError = isAbort
                ? new Error(`Gemini API 응답 시간이 초과되었습니다 (${geminiModel}).`)
                : (error instanceof Error ? error : new Error(String(error)));
            lastError = normalizedError;

            if (hasFallback && (isAbort || shouldRetryWithFallbackModel(0, normalizedError.message))) {
                continue;
            }

            throw new Error(formatGeminiAnalyticsError(normalizedError, modelCandidates.slice(0, index + 1)));
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw new Error(formatGeminiAnalyticsError(lastError || 'Gemini API 호출에 실패했습니다.', modelCandidates));
}

// ===========================
// JSON Extraction (robust)
// ===========================

function extractJSON(text: string): Record<string, unknown> | null {
    try { return JSON.parse(text); } catch { /* continue */ }
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch { /* continue */ }
        // Fix common issues
        const fixed = jsonMatch[0]
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/:\s*None\b/g, ': null')
            .replace(/:\s*True\b/g, ': true')
            .replace(/:\s*False\b/g, ': false');
        try { return JSON.parse(fixed); } catch { /* give up */ }
    }
    return null;
}

// ===========================
// Query Validation & Auto-Correction
// ===========================

function parseSupportDirectionValue(value: unknown): SupportDirection | undefined {
    const normalized = String(value ?? '').replace(/\s+/g, '');
    if (!normalized || normalized === 'null' || normalized === 'undefined') return undefined;
    return VALID_SUPPORT_DIRECTIONS.find(direction => direction === normalized);
}

function detectSupportDirectionFromText(text: string): SupportDirection | undefined {
    const normalized = text.replace(/\s+/g, '');
    const explicitMatches = VALID_SUPPORT_DIRECTIONS.filter(direction => normalized.includes(direction));
    if (explicitMatches.length === 1) return explicitMatches[0];
    if (explicitMatches.length > 1) return undefined;

    const hasExternal = /외부|타사|협력사|용역/.test(normalized);
    const hasInternal = /내부|청연/.test(normalized);
    const hasIncoming = /온곳|들어온|받은|받는|지원받|온지원|들어오는/.test(normalized);
    const hasOutgoing = /간곳|나간|보낸|보내는|지원간|간지원|나가는/.test(normalized);

    const candidates: SupportDirection[] = [];
    if (hasExternal && hasIncoming) candidates.push('외부지원온곳');
    if (hasExternal && hasOutgoing) candidates.push('외부지원간곳');
    if (hasInternal && hasIncoming) candidates.push('내부지원온곳');
    if (hasInternal && hasOutgoing) candidates.push('내부지원간곳');
    if (candidates.length === 1) return candidates[0];
    return parseSupportDirectionValue(normalized);
}

function validateAndCorrectQuery(
    parsed: Record<string, unknown>,
    originalQuestion: string
): { query: AnalyticsQuery; parsedQuestion: string; validationLogs: string[] } {
    const logs: string[] = [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    let startDate = String(parsed.startDate || '').trim();
    let endDate = String(parsed.endDate || '').trim();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!startDate || startDate === 'null' || !dateRegex.test(startDate)) {
        logs.push(`시작일 보정: "${startDate}" -> "${thisMonthStart}"`);
        startDate = thisMonthStart;
    }
    if (!endDate || endDate === 'null' || !dateRegex.test(endDate)) {
        logs.push(`종료일 보정: "${endDate}" -> "${todayStr}"`);
        endDate = todayStr;
    }
    if (startDate > endDate) {
        logs.push(`날짜 순서 보정: 스왑`);
        [startDate, endDate] = [endDate, startDate];
    }

    // analysisType validation
    let analysisType = String(parsed.analysisType || 'general').trim() as AnalysisType;
    if (!VALID_ANALYSIS_TYPES.includes(analysisType)) {
        logs.push(`분석유형 보정: "${analysisType}" -> "general"`);
        analysisType = 'general';
    }

    // Keyword-based auto-detection if 'general'
    if (analysisType === 'general') {
        const q = originalQuestion.toLowerCase();
        if (/팀별|팀\s*순위|팀\s*공수|각\s*팀/.test(q)) {
            analysisType = 'team_summary';
            logs.push('분석유형 자동감지: team_summary');
        } else if (/현장별|사이트별|현장\s*순위/.test(q)) {
            analysisType = 'site_summary';
            logs.push('분석유형 자동감지: site_summary');
        } else if (/순위|top|랭킹|공수\s*높|많이\s*일한/i.test(q)) {
            analysisType = 'worker_ranking';
            logs.push('분석유형 자동감지: worker_ranking');
        } else if (/일별|추이|변화|날짜별/.test(q)) {
            analysisType = 'daily_summary';
            logs.push('분석유형 자동감지: daily_summary');
        } else if (/급여방식|일급제|월급제/.test(q)) {
            analysisType = 'salary_model_analysis';
            logs.push('분석유형 자동감지: salary_model_analysis');
        } else if (/지원팀|용역팀|지원\s*분석/.test(q)) {
            analysisType = 'support_analysis';
            logs.push('분석유형 자동감지: support_analysis');
        } else if (/비교|vs|대비|증감|변화\s*비교/.test(q)) {
            analysisType = 'comparison';
            logs.push('분석유형 자동감지: comparison');
        }
    }

    const detectedSupportDirection = detectSupportDirectionFromText(originalQuestion);
    const isSupportQuestion = /지원|용역|온곳|간곳|지원받|지원간|외부지원|내부지원/.test(originalQuestion);
    if (analysisType === 'general' && (detectedSupportDirection || isSupportQuestion)) {
        analysisType = 'support_analysis';
        logs.push('분석유형 자동감지: support_analysis');
    }

    // salaryModel auto-detection
    let salaryModel = parsed.salaryModel ? String(parsed.salaryModel).trim() : undefined;
    if (salaryModel === 'null' || salaryModel === '') salaryModel = undefined;
    if (!salaryModel) {
        const q = originalQuestion;
        if (/일급제/.test(q)) { salaryModel = '일급제'; logs.push('급여방식 자동감지: 일급제'); }
        else if (/월급제/.test(q)) { salaryModel = '월급제'; logs.push('급여방식 자동감지: 월급제'); }
        else if (/지원팀/.test(q) && analysisType !== 'support_analysis') {
            salaryModel = '지원팀'; logs.push('급여방식 자동감지: 지원팀');
        }
        else if (/용역팀|용역/.test(q)) { salaryModel = '용역팀'; logs.push('급여방식 자동감지: 용역팀'); }
    }

    const cleanStr = (v: unknown): string | undefined => {
        if (!v) return undefined;
        const s = String(v).trim();
        if (s === 'null' || s === 'undefined' || s === '') return undefined;
        return s;
    };

    // compareStartDate / compareEndDate 처리
    let compareStartDate = cleanStr(parsed.compareStartDate);
    let compareEndDate = cleanStr(parsed.compareEndDate);
    if (compareStartDate && !dateRegex.test(compareStartDate)) {
        logs.push(`비교 시작일 무효: "${compareStartDate}" -> 제거`);
        compareStartDate = undefined;
    }
    if (compareEndDate && !dateRegex.test(compareEndDate)) {
        logs.push(`비교 종료일 무효: "${compareEndDate}" -> 제거`);
        compareEndDate = undefined;
    }
    if (compareStartDate && compareEndDate && compareStartDate > compareEndDate) {
        logs.push(`비교 날짜 순서 보정: 스왑`);
        [compareStartDate, compareEndDate] = [compareEndDate, compareStartDate];
    }

    let supportDirection = parseSupportDirectionValue(parsed.supportDirection);
    if (!supportDirection && detectedSupportDirection) {
        supportDirection = detectedSupportDirection;
        logs.push(`지원방향 자동감지: ${supportDirection}`);
    }
    if (supportDirection && analysisType !== 'support_analysis') {
        analysisType = 'support_analysis';
        logs.push('지원방향 기준으로 분석유형 보정: support_analysis');
    }

    const query: AnalyticsQuery = {
        startDate,
        endDate,
        siteName: cleanStr(parsed.siteName),
        teamName: cleanStr(parsed.teamName),
        workerTeamName: cleanStr(parsed.workerTeamName),
        workerName: cleanStr(parsed.workerName),
        companyName: cleanStr(parsed.companyName),
        salaryModel,
        supportDirection,
        compareStartDate,
        compareEndDate,
        analysisType,
    };

    return { query, parsedQuestion: cleanStr(parsed.parsedQuestion) || originalQuestion, validationLogs: logs };
}

// ===========================
// Date Formatting Helper
// ===========================

function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===========================
// Enhanced Fuzzy Matching (Korean-aware)
// ===========================

const SUFFIX_PATTERNS = [
    /현장$/, /공사$/, /건설$/, /프로젝트$/, /사이트$/, /PJ$/i,
    /[()]+/g, /㈜/g, /\s*(주식회사|유한회사)\s*/g,
];

function normalizeForMatch(text: string): string {
    let s = text.toLowerCase().replace(/\s+/g, '');
    for (const pattern of SUFFIX_PATTERNS) {
        s = s.replace(pattern, '');
    }
    return s;
}

function fuzzyMatch(target: string, keyword: string): boolean {
    if (!target || !keyword) return false;

    const t = normalizeForMatch(target);
    const k = normalizeForMatch(keyword);

    if (t === k) return true;
    if (t.includes(k) || k.includes(t)) return true;

    // Token match
    const tTokens = target.toLowerCase().split(/[\s_\-·.]/);
    const kTokens = keyword.toLowerCase().split(/[\s_\-·.]/);
    if (kTokens.length > 1 && kTokens.every(kt => tTokens.some(tt => tt.includes(kt)))) return true;

    // Levenshtein for short strings
    if (t.length >= 2 && k.length >= 2 && t.length <= 10 && k.length <= 10) {
        const dist = levenshtein(t, k);
        if (dist <= 1 && Math.max(t.length, k.length) >= 3) return true;
    }

    return false;
}

function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

// ===========================
// Natural Language -> Query Params
// ===========================

async function parseNaturalLanguageQuery(question: string): Promise<{
    query: AnalyticsQuery;
    parsedQuestion: string;
    validationLogs: string[];
    geminiRaw?: string;
}> {
    const systemPrompt = buildSystemPrompt();
    const rawResponse = await callGeminiText(question, systemPrompt);
    const parsed = extractJSON(rawResponse);

    if (!parsed) {
        const retryPrompt = `다음 질문을 JSON으로 변환하세요. 반드시 유효한 JSON만 출력: "${question}"`;
        const retryResponse = await callGeminiText(retryPrompt, systemPrompt);
        const retryParsed = extractJSON(retryResponse);

        if (!retryParsed) {
            throw new Error(`AI가 질문을 이해하지 못했습니다.\n\n입력: "${question}"\n\n팁: "12월 팀별 공수 순위", "이번 달 김철수 공수" 같이 구체적으로 질문해보세요.`);
        }

        const result = validateAndCorrectQuery(retryParsed, question);
        return { ...result, geminiRaw: retryResponse };
    }

    const result = validateAndCorrectQuery(parsed, question);
    return { ...result, geminiRaw: rawResponse };
}

// ===========================
// Data Query + Aggregation Engine
// ===========================

interface RawQueryResult {
    detailRows: AnalyticsDetailRow[];
    teamAgg: TeamAggRow[];
    siteAgg: SiteAggRow[];
    workerAgg: WorkerAggRow[];
    dailyAgg: DailyAggRow[];
    salaryModelAgg: SalaryModelAggRow[];
    rawReportCount: number;
    filteredReportCount: number;
    appliedFilters: string[];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

async function executeSupportAggregate(query: AnalyticsQuery, rawReportCount: number): Promise<RawQueryResult> {
    const supportData = await manpowerAnalyticsService.getSupportAnalysis(query.startDate, query.endDate, {
        supportDirection: query.supportDirection,
        teamName: query.teamName,
        workerTeamName: query.workerTeamName,
        siteName: query.siteName,
        workerName: query.workerName,
    });

    const appliedFilters: string[] = ['지원팀 분석: 외부/내부 + 온곳/간곳 방향 기준'];
    if (query.supportDirection) appliedFilters.push(`지원방향: "${query.supportDirection}"`);
    if (query.siteName) appliedFilters.push(`현장: "${query.siteName}"`);
    if (query.teamName) appliedFilters.push(`팀: "${query.teamName}"`);
    if (query.workerTeamName) appliedFilters.push(`작업자 소속팀: "${query.workerTeamName}"`);
    if (query.workerName) appliedFilters.push(`작업자: "${query.workerName}"`);

    const detailRows: AnalyticsDetailRow[] = supportData.flows.map(flow => ({
        date: flow.dates[0] || query.startDate,
        siteName: flow.toSiteName || '',
        teamName: flow.supportInTeamName || flow.fromTeamName || '',
        companyName: flow.counterpartyName,
        workers: [{
            name: flow.workerName,
            role: flow.direction || '지원',
            manDay: flow.totalManDay,
            unitPrice: flow.totalManDay > 0 ? Math.round(flow.totalAmount / flow.totalManDay) : 0,
            amount: flow.totalAmount,
            salaryModel: flow.direction || '지원',
            teamName: flow.supportOutTeamName || flow.fromTeamName,
            siteName: flow.toSiteName,
        }],
        totalManDay: flow.totalManDay,
        totalAmount: flow.totalAmount,
        workerCount: 1,
    }));

    const siteMap = new Map<string, { manDay: number; amount: number; workerIds: Set<string>; teamIds: Set<string>; dates: Set<string> }>();
    supportData.flows.forEach(flow => {
        const siteName = flow.toSiteName || '미지정';
        if (!siteMap.has(siteName)) {
            siteMap.set(siteName, { manDay: 0, amount: 0, workerIds: new Set(), teamIds: new Set(), dates: new Set() });
        }
        const site = siteMap.get(siteName)!;
        site.manDay += flow.totalManDay;
        site.amount += flow.totalAmount;
        if (flow.workerId) site.workerIds.add(flow.workerId);
        if (flow.supportInTeamName || flow.fromTeamName) site.teamIds.add(flow.supportInTeamName || flow.fromTeamName);
        flow.dates.forEach(date => site.dates.add(date));
    });

    const teamAgg: TeamAggRow[] = supportData.teamSummaries.map(team => {
        const totalTeamManDay = team.sentManDay + team.receivedManDay;
        const totalTeamAmount = team.sentAmount + team.receivedAmount;
        return {
            teamName: team.teamName,
            totalManDay: round1(totalTeamManDay),
            totalAmount: Math.round(totalTeamAmount),
            workerCount: Math.max(team.sentWorkerCount, team.receivedWorkerCount),
            days: 0,
            avgDailyManDay: 0,
        };
    }).sort((a, b) => b.totalManDay - a.totalManDay);

    const siteAgg: SiteAggRow[] = Array.from(siteMap.entries()).map(([siteName, site]) => ({
        siteName,
        totalManDay: round1(site.manDay),
        totalAmount: Math.round(site.amount),
        workerCount: site.workerIds.size,
        teamCount: site.teamIds.size,
        days: site.dates.size,
    })).sort((a, b) => b.totalManDay - a.totalManDay);

    const workerAgg: WorkerAggRow[] = supportData.supportWorkers.map(worker => ({
        name: worker.workerName,
        totalManDay: worker.totalManDay,
        totalAmount: worker.totalAmount,
        workDays: worker.workDays,
        avgManDay: worker.workDays > 0 ? round1(worker.totalManDay / worker.workDays) : 0,
        sites: worker.sites,
        teams: worker.supportOutTeams?.length ? worker.supportOutTeams : worker.teams,
        salaryModel: worker.directions?.join(', ') || worker.salaryModel,
    })).sort((a, b) => b.totalManDay - a.totalManDay);

    const dailyAgg: DailyAggRow[] = supportData.dailyTrend.map(day => ({
        date: day.date,
        totalManDay: day.supportManDay,
        totalAmount: day.supportAmount,
        workerCount: 0,
        teamCount: 0,
        siteCount: 0,
    }));

    const salaryModelAgg: SalaryModelAggRow[] = (supportData.supportByDirection ?? []).map(direction => ({
        salaryModel: direction.direction,
        totalManDay: direction.totalManDay,
        totalAmount: direction.totalAmount,
        workerCount: direction.workerCount,
        workDays: direction.flowCount,
    })).sort((a, b) => b.totalManDay - a.totalManDay);

    return {
        detailRows,
        teamAgg,
        siteAgg,
        workerAgg,
        dailyAgg,
        salaryModelAgg,
        rawReportCount,
        filteredReportCount: detailRows.length,
        appliedFilters,
    };
}

async function executeAndAggregate(query: AnalyticsQuery): Promise<RawQueryResult> {
    let reports: DailyReport[];
    try {
        reports = await dailyReportService.getReportsByRange(query.startDate, query.endDate);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('Failed to fetch') || msg.includes('fetch') || msg.includes('network')) {
            throw new Error(`데이터베이스 연결 오류: 서버에 접속할 수 없습니다.\n원인: ${msg.substring(0, 100)}\n해결: 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.`);
        }
        throw error;
    }

    const rawReportCount = reports.length;
    if (query.analysisType === 'support_analysis') {
        return executeSupportAggregate(query, rawReportCount);
    }

    const appliedFilters: string[] = [];
    let filtered = reports;

    // --- Build teamId→teamName map from all reports ---
    const teamIdToNameMap = new Map<string, string>();
    for (const r of reports) {
        if (r.teamId && r.teamName) {
            teamIdToNameMap.set(r.teamId, r.teamName);
        }
    }

    // Helper: resolve worker's team name from teamId
    const resolveWorkerTeamName = (worker: DailyReport['workers'][0], report: DailyReport): string => {
        // 작업자의 teamId가 있으면 그것으로 팀명 resolve
        if (worker.teamId) {
            const resolved = teamIdToNameMap.get(worker.teamId);
            if (resolved) return resolved;
        }
        // fallback: 일보의 담당팀
        return report.teamName || '';
    };

    if (query.siteName) {
        const kw = query.siteName;
        const before = filtered.length;
        filtered = filtered.filter(r => fuzzyMatch(r.siteName || '', kw));
        appliedFilters.push(`현장: "${kw}" (${before}->${filtered.length}건)`);

        if (filtered.length === 0) {
            // Broader search: character-level containment
            filtered = reports.filter(r => {
                const sn = (r.siteName || '').toLowerCase();
                const kl = kw.toLowerCase();
                return sn.includes(kl) || kl.split('').every(c => sn.includes(c));
            });
            if (filtered.length > 0) {
                appliedFilters.push(`현장 넓은검색: ${filtered.length}건 발견`);
            }
        }
    }

    if (query.teamName) {
        const kw = query.teamName;
        const before = filtered.length;
        // 담당팀 OR 책임팀 매칭
        filtered = filtered.filter(r =>
            fuzzyMatch(r.teamName || '', kw) ||
            fuzzyMatch(r.responsibleTeamName || '', kw)
        );
        appliedFilters.push(`현장담당팀: "${kw}" (${before}->${filtered.length}건)`);
    }

    if (query.companyName) {
        const kw = query.companyName;
        const before = filtered.length;
        filtered = filtered.filter(r =>
            fuzzyMatch(r.companyName || '', kw) ||
            fuzzyMatch(r.constructorCompanyName || '', kw) ||
            fuzzyMatch(r.partnerName || '', kw)
        );
        appliedFilters.push(`발주사: "${kw}" (${before}->${filtered.length}건)`);
    }

    const filteredReportCount = filtered.length;

    // --- Build detail rows + aggregate ---
    const detailRows: AnalyticsDetailRow[] = [];
    const teamMap = new Map<string, { manDay: number; amount: number; workerIds: Set<string>; dates: Set<string> }>();
    const siteMap = new Map<string, { manDay: number; amount: number; workerIds: Set<string>; teamIds: Set<string>; dates: Set<string> }>();
    const workerMap = new Map<string, { name: string; manDay: number; amount: number; days: Set<string>; sites: Set<string>; teams: Set<string>; salaryModel: string }>();
    const dailyMap = new Map<string, { manDay: number; amount: number; workerIds: Set<string>; teamIds: Set<string>; siteIds: Set<string> }>();
    const salaryMap = new Map<string, { manDay: number; amount: number; workerIds: Set<string>; days: Set<string> }>();

    for (const report of filtered) {
        let workers = report.workers || [];

        if (query.workerName) {
            workers = workers.filter(w => fuzzyMatch(w.name || '', query.workerName!));
        }
        // 작업자 소속팀 필터: worker.teamId를 팀명으로 resolve하여 비교
        if (query.workerTeamName) {
            const kw = query.workerTeamName;
            workers = workers.filter(w => {
                const workerTeam = resolveWorkerTeamName(w, report);
                return fuzzyMatch(workerTeam, kw);
            });
            // 소속팀 필터 후 남은 작업자가 없으면 이 일보 스킵
            if (workers.length === 0) continue;
        }
        if (query.salaryModel) {
            const kw = query.salaryModel;
            workers = workers.filter(w => {
                const model = (w.salaryModel || w.payType || '').trim();
                return fuzzyMatch(model, kw);
            });
        }

        if (workers.length === 0 && (query.workerName || query.salaryModel)) continue;

        const workerResults: AnalyticsResultWorker[] = workers.map(w => {
            const manDay = typeof w.manDay === 'number' ? w.manDay : 0;
            const unitPrice = typeof w.unitPrice === 'number' ? w.unitPrice : 0;
            const workerTeam = resolveWorkerTeamName(w, report);
            return {
                name: w.name || '미상',
                role: w.role || '',
                manDay,
                unitPrice,
                amount: manDay * unitPrice,
                payType: w.payType,
                salaryModel: w.salaryModel,
                teamName: workerTeam || report.teamName,
                siteName: report.siteName,
            };
        });

        const rowManDay = workerResults.reduce((s, w) => s + w.manDay, 0);
        const rowAmount = workerResults.reduce((s, w) => s + w.amount, 0);

        detailRows.push({
            date: report.date,
            siteName: report.siteName || '',
            teamName: report.teamName || '',
            companyName: report.companyName || report.constructorCompanyName || '',
            workers: workerResults,
            totalManDay: rowManDay,
            totalAmount: rowAmount,
            workerCount: workerResults.length,
        });

        // Team agg
        const tKey = report.teamName || '미지정';
        if (!teamMap.has(tKey)) teamMap.set(tKey, { manDay: 0, amount: 0, workerIds: new Set(), dates: new Set() });
        const tm = teamMap.get(tKey)!;
        tm.manDay += rowManDay; tm.amount += rowAmount; tm.dates.add(report.date);
        workerResults.forEach(w => { if (w.name !== '미상') tm.workerIds.add(w.name); });

        // Site agg
        const sKey = report.siteName || '미지정';
        if (!siteMap.has(sKey)) siteMap.set(sKey, { manDay: 0, amount: 0, workerIds: new Set(), teamIds: new Set(), dates: new Set() });
        const sm = siteMap.get(sKey)!;
        sm.manDay += rowManDay; sm.amount += rowAmount; sm.dates.add(report.date);
        if (report.teamName) sm.teamIds.add(report.teamName);
        workerResults.forEach(w => { if (w.name !== '미상') sm.workerIds.add(w.name); });

        // Worker agg
        for (const w of workerResults) {
            if (w.name === '미상') continue;
            if (!workerMap.has(w.name)) workerMap.set(w.name, { name: w.name, manDay: 0, amount: 0, days: new Set(), sites: new Set(), teams: new Set(), salaryModel: w.salaryModel || w.payType || '' });
            const wm = workerMap.get(w.name)!;
            wm.manDay += w.manDay; wm.amount += w.amount;
            if (w.manDay > 0) wm.days.add(report.date);
            if (report.siteName) wm.sites.add(report.siteName);
            if (report.teamName) wm.teams.add(report.teamName);
        }

        // Daily agg
        const dKey = report.date;
        if (!dailyMap.has(dKey)) dailyMap.set(dKey, { manDay: 0, amount: 0, workerIds: new Set(), teamIds: new Set(), siteIds: new Set() });
        const dm = dailyMap.get(dKey)!;
        dm.manDay += rowManDay; dm.amount += rowAmount;
        if (report.teamName) dm.teamIds.add(report.teamName);
        if (report.siteName) dm.siteIds.add(report.siteName);
        workerResults.forEach(w => { if (w.name !== '미상') dm.workerIds.add(w.name); });

        // Salary agg
        for (const w of workerResults) {
            const smKey = (w.salaryModel || w.payType || '미지정').trim() || '미지정';
            if (!salaryMap.has(smKey)) salaryMap.set(smKey, { manDay: 0, amount: 0, workerIds: new Set(), days: new Set() });
            const slm = salaryMap.get(smKey)!;
            slm.manDay += w.manDay; slm.amount += w.amount;
            if (w.name !== '미상') slm.workerIds.add(w.name);
            if (w.manDay > 0) slm.days.add(report.date);
        }
    }

    if (query.workerTeamName) appliedFilters.push(`작업자소속팀: "${query.workerTeamName}" (worker.teamId→팀명 resolve)`);
    if (query.workerName) appliedFilters.push(`작업자: "${query.workerName}"`);
    if (query.salaryModel) appliedFilters.push(`급여방식: "${query.salaryModel}"`);

    const round1 = (n: number) => Math.round(n * 10) / 10;

    const teamAgg: TeamAggRow[] = Array.from(teamMap.entries())
        .map(([name, d]) => ({
            teamName: name, totalManDay: round1(d.manDay), totalAmount: Math.round(d.amount),
            workerCount: d.workerIds.size, days: d.dates.size,
            avgDailyManDay: d.dates.size > 0 ? round1(d.manDay / d.dates.size) : 0,
        })).sort((a, b) => b.totalManDay - a.totalManDay);

    const siteAgg: SiteAggRow[] = Array.from(siteMap.entries())
        .map(([name, d]) => ({
            siteName: name, totalManDay: round1(d.manDay), totalAmount: Math.round(d.amount),
            workerCount: d.workerIds.size, teamCount: d.teamIds.size, days: d.dates.size,
        })).sort((a, b) => b.totalManDay - a.totalManDay);

    const workerAgg: WorkerAggRow[] = Array.from(workerMap.values())
        .map(w => ({
            name: w.name, totalManDay: round1(w.manDay), totalAmount: Math.round(w.amount),
            workDays: w.days.size, avgManDay: w.days.size > 0 ? round1(w.manDay / w.days.size) : 0,
            sites: Array.from(w.sites), teams: Array.from(w.teams), salaryModel: w.salaryModel,
        })).sort((a, b) => b.totalManDay - a.totalManDay);

    const dailyAgg: DailyAggRow[] = Array.from(dailyMap.entries())
        .map(([date, d]) => ({
            date, totalManDay: round1(d.manDay), totalAmount: Math.round(d.amount),
            workerCount: d.workerIds.size, teamCount: d.teamIds.size, siteCount: d.siteIds.size,
        })).sort((a, b) => a.date.localeCompare(b.date));

    const salaryModelAgg: SalaryModelAggRow[] = Array.from(salaryMap.entries())
        .map(([model, d]) => ({
            salaryModel: model, totalManDay: round1(d.manDay), totalAmount: Math.round(d.amount),
            workerCount: d.workerIds.size, workDays: d.days.size,
        })).sort((a, b) => b.totalManDay - a.totalManDay);

    return { detailRows, teamAgg, siteAgg, workerAgg, dailyAgg, salaryModelAgg, rawReportCount, filteredReportCount, appliedFilters };
}

// ===========================
// Summary Builder
// ===========================

function buildSummary(data: RawQueryResult, query: AnalyticsQuery): AnalyticsResult['summary'] {
    const allWorkerNames = new Set<string>();
    let totalManDay = 0;
    let totalAmount = 0;
    const uniqueSites = new Set<string>();
    const uniqueTeams = new Set<string>();

    data.detailRows.forEach(row => {
        if (row.siteName) uniqueSites.add(row.siteName);
        if (row.teamName) uniqueTeams.add(row.teamName);
        totalManDay += row.totalManDay;
        totalAmount += row.totalAmount;
        row.workers.forEach(w => { if (w.name !== '미상') allWorkerNames.add(w.name); });
    });

    return {
        totalManDay: Math.round(totalManDay * 10) / 10,
        totalAmount: Math.round(totalAmount),
        totalWorkers: allWorkerNames.size,
        totalReports: data.detailRows.length,
        uniqueSites: Array.from(uniqueSites),
        uniqueTeams: Array.from(uniqueTeams),
        dateRange: query.startDate === query.endDate ? query.startDate : `${query.startDate} ~ ${query.endDate}`,
    };
}

// ===========================
// AI Insight
// ===========================

async function generateInsight(
    data: RawQueryResult,
    summary: AnalyticsResult['summary'],
    query: AnalyticsQuery,
    question: string,
    comparison?: AnalyticsResult['comparison']
): Promise<string> {
    if (data.detailRows.length === 0) return '';

    const lines: string[] = [];
    lines.push(`[질문] ${question}`);
    lines.push(`[기간] ${summary.dateRange}`);
    lines.push(`[요약] 총 공수: ${summary.totalManDay}, 총 금액: ${summary.totalAmount.toLocaleString()}원, 인원: ${summary.totalWorkers}명, 일보: ${summary.totalReports}건`);

    const type = query.analysisType;

    if (type === 'team_summary' || type === 'general') {
        lines.push('\n[팀별 공수 순위]');
        data.teamAgg.forEach((t, i) =>
            lines.push(`${i + 1}. ${t.teamName}: ${t.totalManDay}공수, ${t.workerCount}명, ${t.days}일, 일평균 ${t.avgDailyManDay}공수`)
        );
    }
    if (type === 'site_summary') {
        lines.push('\n[현장별 현황]');
        data.siteAgg.forEach((s, i) =>
            lines.push(`${i + 1}. ${s.siteName}: ${s.totalManDay}공수, ${s.workerCount}명, ${s.teamCount}팀, ${s.days}일`)
        );
    }
    if (type === 'worker_ranking' || type === 'worker_detail') {
        lines.push('\n[작업자 순위]');
        data.workerAgg.slice(0, 20).forEach((w, i) =>
            lines.push(`${i + 1}. ${w.name}: ${w.totalManDay}공수, ${w.workDays}일, ${w.salaryModel || '-'}, ${w.teams.join('/')}`)
        );
    }
    if (type === 'support_analysis') {
        lines.push('\n[지원 방향별]');
        data.salaryModelAgg.forEach(s =>
            lines.push(`${s.salaryModel}: ${s.totalManDay}공수, ${s.workerCount}명, ${s.workDays}개 흐름`)
        );
    }
    if (type === 'salary_model_analysis') {
        lines.push('\n[급여방식별]');
        data.salaryModelAgg.forEach(s =>
            lines.push(`${s.salaryModel}: ${s.totalManDay}공수, ${s.workerCount}명, ${s.workDays}일`)
        );
    }
    if (type === 'daily_summary') {
        lines.push('\n[일별 추이]');
        data.dailyAgg.forEach(d =>
            lines.push(`${d.date}: ${d.totalManDay}공수, ${d.workerCount}명, ${d.teamCount}팀, ${d.siteCount}현장`)
        );
    }

    // 비교분석 데이터 추가
    if (comparison) {
        lines.push(`\n[이전 기간] ${comparison.prevPeriod}`);
        lines.push(`[이전 요약] 총 공수: ${comparison.prevSummary.totalManDay}, 총 금액: ${comparison.prevSummary.totalAmount.toLocaleString()}원, 인원: ${comparison.prevSummary.totalWorkers}명`);

        const curManDay = summary.totalManDay;
        const prevManDay = comparison.prevSummary.totalManDay;
        const diffManDay = curManDay - prevManDay;
        const diffPct = prevManDay > 0 ? ((diffManDay / prevManDay) * 100).toFixed(1) : 'N/A';
        lines.push(`[증감] 공수: ${diffManDay > 0 ? '+' : ''}${diffManDay.toFixed(1)} (${diffPct}%)`);

        if (comparison.prevTeamAgg.length > 0) {
            lines.push('\n[이전 기간 팀별]');
            comparison.prevTeamAgg.forEach((t, i) =>
                lines.push(`${i + 1}. ${t.teamName}: ${t.totalManDay}공수, ${t.workerCount}명`)
            );
        }
    }

    try {
        return await callGeminiText(lines.join('\n'), INSIGHT_PROMPT);
    } catch {
        return '';
    }
}

// ===========================
// Main Entry Point
// ===========================

export async function analyzeWithAI(question: string): Promise<AnalyticsResult> {
    const timings = { parse: 0, fetch: 0, aggregate: 0, insight: 0 };

    try {
        const t0 = Date.now();
        const { query, parsedQuestion, validationLogs, geminiRaw } = await parseNaturalLanguageQuery(question);
        timings.parse = Date.now() - t0;

        const t1 = Date.now();
        const data = await executeAndAggregate(query);
        timings.fetch = Date.now() - t1;

        const t2 = Date.now();
        const summary = buildSummary(data, query);

        // --- Comparison: 이전 기간 데이터 조회 ---
        let comparison: AnalyticsResult['comparison'] | undefined;
        if (query.analysisType === 'comparison') {
            let prevStart = query.compareStartDate;
            let prevEnd = query.compareEndDate;

            // 이전 기간이 없으면 자동 계산: 현재 기간과 동일 길이의 직전 기간
            if (!prevStart || !prevEnd) {
                const curStart = new Date(query.startDate);
                const curEnd = new Date(query.endDate);
                const diffMs = curEnd.getTime() - curStart.getTime();
                const prevEndDate = new Date(curStart.getTime() - 1); // 현재 시작일 하루 전
                const prevStartDate = new Date(prevEndDate.getTime() - diffMs);
                prevStart = formatDateStr(prevStartDate);
                prevEnd = formatDateStr(prevEndDate);
                validationLogs.push(`비교기간 자동계산: ${prevStart} ~ ${prevEnd}`);
            }

            const prevQuery: AnalyticsQuery = {
                ...query,
                startDate: prevStart,
                endDate: prevEnd,
                analysisType: 'general', // 이전 기간은 일반 조회
            };
            const prevData = await executeAndAggregate(prevQuery);
            const prevSummary = buildSummary(prevData, prevQuery);

            comparison = {
                prevSummary,
                prevTeamAgg: prevData.teamAgg,
                prevSiteAgg: prevData.siteAgg,
                prevWorkerAgg: prevData.workerAgg,
                prevPeriod: `${prevStart} ~ ${prevEnd}`,
            };
            validationLogs.push(`비교 이전기간: ${comparison.prevPeriod} (일보 ${prevData.filteredReportCount}건)`);
        }

        // --- 애매한 팀 필터: teamName만 설정 + workerTeamName 미설정 → 양쪽 결과 비교 ---
        let alternativeResult: AnalyticsResult['alternativeResult'] | undefined;
        if (query.teamName && !query.workerTeamName && query.analysisType !== 'support_analysis') {
            // 작업자 소속팀 기준으로도 조회
            const altQuery: AnalyticsQuery = {
                ...query,
                teamName: undefined,  // 현장담당팀 필터 해제
                workerTeamName: query.teamName,  // 대신 소속팀으로
            };
            try {
                const altData = await executeAndAggregate(altQuery);
                const altSummary = buildSummary(altData, altQuery);
                // 결과가 다르면 (공수 차이 있으면) alternative로 추가
                if (altData.detailRows.length > 0 && Math.abs(altSummary.totalManDay - summary.totalManDay) > 0.01) {
                    alternativeResult = {
                        label: `작업자 소속팀 "${query.teamName}" 기준`,
                        summary: altSummary,
                        teamAgg: altData.teamAgg,
                        siteAgg: altData.siteAgg,
                        workerAgg: altData.workerAgg,
                    };
                    validationLogs.push(`대안결과: 소속팀 기준 ${altSummary.totalManDay}공수 (현장담당팀 ${summary.totalManDay}공수와 다름)`);
                }
            } catch {
                // 대안 조회 실패 시 무시
            }
        }
        timings.aggregate = Date.now() - t2;

        const t3 = Date.now();
        let aiInsight = '';
        if (data.detailRows.length > 0 && data.detailRows.length <= 2000) {
            aiInsight = await generateInsight(data, summary, query, question, comparison);
        } else if (data.detailRows.length > 2000) {
            aiInsight = `데이터가 ${data.detailRows.length}건으로 매우 많습니다. 요약 테이블을 확인해주세요.`;
        }
        timings.insight = Date.now() - t3;

        const debug: AnalyticsDebug = {
            rawReportCount: data.rawReportCount,
            filteredReportCount: data.filteredReportCount,
            appliedFilters: data.appliedFilters,
            geminiRawResponse: geminiRaw,
            queryValidation: validationLogs,
            timings,
        };

        let error: string | undefined;
        if (data.detailRows.length === 0) {
            const suggestions: string[] = [];
            if (data.rawReportCount === 0) {
                suggestions.push(`${query.startDate} ~ ${query.endDate} 기간에 일보 데이터가 없습니다.`);
                suggestions.push('날짜 범위를 확인해주세요. (예: "이번 달", "12월")');
            } else {
                suggestions.push(`${data.rawReportCount}건의 일보 중 필터 조건에 맞는 데이터가 없습니다.`);
                if (query.siteName) suggestions.push(`현장명 "${query.siteName}"를 확인해주세요.`);
                if (query.teamName) suggestions.push(`팀명 "${query.teamName}"를 확인해주세요.`);
                if (query.workerName) suggestions.push(`작업자명 "${query.workerName}"를 확인해주세요.`);
                if (query.salaryModel) suggestions.push(`급여방식 "${query.salaryModel}"를 확인해주세요.`);
            }
            error = suggestions.join('\n');
        }

        return {
            success: data.detailRows.length > 0,
            query, parsedQuestion,
            teamAgg: data.teamAgg, siteAgg: data.siteAgg, workerAgg: data.workerAgg,
            dailyAgg: data.dailyAgg, salaryModelAgg: data.salaryModelAgg,
            detailRows: data.detailRows, summary, aiInsight, error, debug,
            comparison,
            alternativeResult,
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'AI 분석 중 오류가 발생했습니다.';
        return {
            success: false,
            query: { startDate: '', endDate: '', analysisType: 'general' },
            parsedQuestion: question,
            teamAgg: [], siteAgg: [], workerAgg: [], dailyAgg: [], salaryModelAgg: [],
            detailRows: [],
            summary: { totalManDay: 0, totalAmount: 0, totalWorkers: 0, totalReports: 0, uniqueSites: [], uniqueTeams: [], dateRange: '' },
            error: msg,
            debug: { rawReportCount: 0, filteredReportCount: 0, appliedFilters: [], queryValidation: [], timings },
        };
    }
}

// ===========================
// Example Questions
// ===========================

export const EXAMPLE_QUESTIONS: Array<{ text: string; category: string }> = [
    { text: '이번 달 팀별 공수 순위를 보여줘', category: '팀별 순위' },
    { text: '이번 달 현장별 총 공수와 인원수를 알려줘', category: '현장별 분석' },
    { text: '이번 달 공수 TOP 10 작업자를 알려줘', category: '작업자 순위' },
    { text: '어제 출력한 전체 인원과 공수를 알려줘', category: '일일 현황' },
    { text: '이번 달 급여방식별 공수와 금액 분석', category: '급여방식별' },
    { text: '이번 달 지원팀 작업자들 현장별 공수', category: '지원팀 분석' },
    { text: '이번 달 일별 공수 추이를 보여줘', category: '일별 추이' },
    { text: '이번 달 vs 지난달 팀별 공수 비교', category: '비교 분석' },
    { text: '이번 달 전체 현황 요약해줘', category: '종합 현황' },
    { text: '이번 달 일급제 작업자 공수 순위', category: '일급제 분석' },
];
