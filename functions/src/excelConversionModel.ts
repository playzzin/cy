export const DEFAULT_EXCEL_MODEL = 'gemini-3.8-flash';
export const DEFAULT_EXCEL_THINKING = 'medium';
export type ExcelThinkingLevel = 'low' | 'medium' | 'high';

export function normalizeExcelModel(value: unknown): string {
    const model = String(value || DEFAULT_EXCEL_MODEL).trim().replace(/^models\//, '');
    if (!/^gemini-[a-zA-Z0-9._-]{1,90}$/.test(model)) throw new Error('Gemini 모델명을 확인해 주세요.');
    return model;
}
export function normalizeExcelThinking(value: unknown): ExcelThinkingLevel {
    const level = String(value || DEFAULT_EXCEL_THINKING);
    if (!['low', 'medium', 'high'].includes(level)) throw new Error('분석 강도는 빠르게·균형·꼼꼼하게 중 선택해 주세요.');
    return level as ExcelThinkingLevel;
}
export function excelGenerationOptions(model: string, thinking: unknown = DEFAULT_EXCEL_THINKING) {
    const level = normalizeExcelThinking(thinking);
    // Gemini 3 no longer accepts the sampling parameters used by 2.5.
    return /^gemini-3(?:[.-])/.test(model)
        ? { thinkingConfig: { thinkingLevel: level }, maxOutputTokens: 16000 }
        : { temperature: 0, maxOutputTokens: 16000 };
}
