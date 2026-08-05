import { parseManpowerDbQuestion } from './manpowerDbQueryParser';
import { ManpowerDbSearchQuery } from './manpowerDbSearchTypes';
import { sanitizeForAiPrompt } from './manpowerDbSchemaCatalog';

export interface ManpowerDbLlmParserOptions {
    apiKey?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}

const extractJson = (value: string): string => {
    const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) return fenced[1];
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start >= 0 && end > start) return value.slice(start, end + 1);
    return value;
};

const isValidQuery = (value: any): value is ManpowerDbSearchQuery =>
    value?.domain === 'manpower_db' &&
    typeof value.entity === 'string' &&
    typeof value.intent === 'string' &&
    value.filters &&
    typeof value.filters === 'object';

export const parseManpowerDbQuestionHybrid = async (
    question: string,
    today = new Date(),
    options: ManpowerDbLlmParserOptions = {}
): Promise<{ query: ManpowerDbSearchQuery; source: 'llm' | 'rule'; warning?: string }> => {
    const fallback = () => ({ query: parseManpowerDbQuestion(question, today), source: 'rule' as const });
    if (!options.apiKey || !options.fetchImpl) return fallback();

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = controller ? setTimeout(() => controller.abort(), options.timeoutMs ?? 8000) : undefined;

    try {
        const safeSchemaHint = sanitizeForAiPrompt('worker', {
            name: '홍길동',
            teamName: '1팀',
            contact: '01012345678',
            accountNumber: '123456789',
            idNumber: '900101-1234567',
        });
        const response = await options.fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${options.apiKey}`, {
            method: 'POST',
            signal: controller?.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{
                        text: [
                            '건설 ERP 인력 DB 자연어 질문을 JSON query로만 변환하세요.',
                            '원본 민감정보는 프롬프트에 포함하지 않습니다.',
                            `표시 가능한 예시 스키마: ${JSON.stringify(safeSchemaHint)}`,
                            '출력 schema: { "domain":"manpower_db", "entity":"worker|team|site|company|account|integrity|support|mixed", "intent":"lookup|list|relation|missing_field|status|recent_activity|duplicate|data_quality|trend|comparison", "filters":{"supportDirection":"외부지원간곳|외부지원온곳|내부지원간곳|내부지원온곳","supportScope":"외부|내부","supportFlowType":"간곳|온곳"}, "joins":[], "sort":{}, "limit":50, "confidence":0.8, "clarificationNeeded":false }',
                            '지원온곳/지원간곳/외부팀/내부팀/용역팀 질문은 entity=support, intent=relation으로 변환하세요.',
                            `질문: ${question}`,
                        ].join('\n'),
                    }],
                }],
            }),
        });

        if (!response.ok) {
            return { ...fallback(), warning: `LLM parser failed: ${response.status}` };
        }
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(extractJson(text));
        if (!isValidQuery(parsed)) {
            return { ...fallback(), warning: 'LLM parser returned invalid schema' };
        }
        return { query: parsed, source: 'llm' };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ...fallback(), warning: `LLM parser fallback: ${message}` };
    } finally {
        if (timeout) clearTimeout(timeout);
    }
};
