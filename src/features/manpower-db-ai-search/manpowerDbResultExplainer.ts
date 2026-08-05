import { ManpowerDbSearchResult } from './manpowerDbSearchTypes';

export const createDeterministicManpowerDbExplanation = (result: ManpowerDbSearchResult): string => {
    const reasonSamples = result.rows
        .map((row) => row.matchReason)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
    const sourceSamples = Array.from(new Set(result.rows.map((row) => row.source).filter(Boolean))).join(', ');

    return [
        result.summary,
        `표시 ${result.counts.shown}건 / 전체 ${result.counts.total}건입니다.`,
        reasonSamples ? `주요 매칭 근거: ${reasonSamples}.` : undefined,
        sourceSamples ? `데이터 출처: ${sourceSamples}.` : undefined,
    ].filter(Boolean).join(' ');
};
export const explainManpowerDbResult = async (
    result: ManpowerDbSearchResult,
    options: { useLlm?: boolean } = {}
): Promise<{ explanation: string; source: 'deterministic' | 'llm' }> => {
    if (!options.useLlm) {
        return { explanation: createDeterministicManpowerDbExplanation(result), source: 'deterministic' };
    }

    // LLM explanation can be added here later. The fallback is intentionally deterministic
    // so the UI never depends on generated text to render core search results.
    return { explanation: createDeterministicManpowerDbExplanation(result), source: 'deterministic' };
};
