// Keep the browser and Functions copies in sync (checked by geminiModelPolicy.test).
// Model lifecycle: https://ai.google.dev/gemini-api/docs/deprecations
export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_LITE_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

// This is an application upgrade policy; not every legacy model is retired.
const LEGACY_MODEL_REPLACEMENTS: Record<string, string> = {
    'gemini-2.0-flash': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.0-flash-001': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.0-flash-lite': DEFAULT_GEMINI_LITE_MODEL,
    'gemini-2.0-flash-lite-001': DEFAULT_GEMINI_LITE_MODEL,
    'gemini-2.0-flash-lite-preview': DEFAULT_GEMINI_LITE_MODEL,
    'gemini-2.0-flash-lite-preview-02-05': DEFAULT_GEMINI_LITE_MODEL,
    'gemini-2.0-flash-preview-image-generation': DEFAULT_GEMINI_IMAGE_MODEL,
    'gemini-2.5-flash': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-flash-preview-05-20': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-flash-preview-09-25': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-flash-lite': DEFAULT_GEMINI_LITE_MODEL,
    'gemini-2.5-flash-lite-preview-09-2025': DEFAULT_GEMINI_LITE_MODEL,
    'gemini-2.5-pro': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-pro-preview-03-25': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-pro-preview-05-06': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-pro-preview-06-05': DEFAULT_GEMINI_TEXT_MODEL,
    'gemini-2.5-flash-image': DEFAULT_GEMINI_IMAGE_MODEL,
    'gemini-2.5-flash-image-preview': DEFAULT_GEMINI_IMAGE_MODEL,
    'gemini-3.1-flash-image-preview': DEFAULT_GEMINI_IMAGE_MODEL,
};

export const normalizeGeminiModelName = (value: unknown, fallback = DEFAULT_GEMINI_TEXT_MODEL): string => {
    const model = String(value || '').trim().replace(/^models\//, '')
        || String(fallback).trim().replace(/^models\//, '') || DEFAULT_GEMINI_TEXT_MODEL;
    return LEGACY_MODEL_REPLACEMENTS[model] || model;
};

// Gemini 3 drops sampling controls. Low thinking keeps interactive extraction responsive.
// https://ai.google.dev/gemini-api/docs/latest-model#migration-checklist
export const geminiTextGenerationOptions = (model: string, temperature = 0.1) => (
    /^gemini-3(?:[.-])/.test(model.replace(/^models\//, ''))
        ? { thinkingConfig: { thinkingLevel: 'low' } }
        : { temperature }
);
