import { aiSettingsService, AI_IMAGE_MODEL_OPTIONS, AI_TEXT_MODEL_OPTIONS } from './aiSettingsService';
import { normalizeGeminiModelName } from './geminiModelPolicy';

describe('Gemini model upgrades', () => {
    beforeEach(() => localStorage.clear());

    it('upgrades saved models while preserving page switches and unrelated choices', () => {
        localStorage.setItem('cy_ai_settings_v1', JSON.stringify({
            models: { textModel: 'models/gemini-2.0-flash', analyticsModel: 'gemini-2.5-flash-lite', imageModel: 'gemini-2.5-flash-image' },
            pageEnabledById: { 'gallery-ai-images': false },
            updatedAt: '2026-01-01T00:00:00Z'
        }));
        expect(aiSettingsService.getModels()).toEqual({
            textModel: 'gemini-3.8-flash', analyticsModel: 'gemini-3.5-flash-lite', imageModel: 'gemini-3.1-flash-image'
        });
        expect(aiSettingsService.isPageEnabled('gallery-ai-images')).toBe(false);
        expect(aiSettingsService.getSettings().updatedAt).toBe('2026-01-01T00:00:00Z');
        aiSettingsService.setModels({ textModel: 'gemini-3.7-flash' });
        expect(JSON.parse(localStorage.getItem('cy_ai_settings_v1')!).models.textModel).toBe('gemini-3.7-flash');
        expect(aiSettingsService.getModels().imageModel).toBe('gemini-3.1-flash-image');
    });

    it('uses current defaults for new or corrupt settings and keeps custom model choices', () => {
        expect(aiSettingsService.getModels().textModel).toBe('gemini-3.8-flash');
        expect(aiSettingsService.getModels().imageModel).toBe('gemini-3.1-flash-image');
        localStorage.setItem('cy_ai_settings_v1', '{bad-json');
        expect(aiSettingsService.getModels().analyticsModel).toBe('gemini-3.8-flash');
        expect(normalizeGeminiModelName('  models/gemini-custom  ')).toBe('gemini-custom');
        expect(normalizeGeminiModelName(' ', 'gemini-3.1-flash-image')).toBe('gemini-3.1-flash-image');
        expect([...AI_TEXT_MODEL_OPTIONS, ...AI_IMAGE_MODEL_OPTIONS].some(option => option.value.startsWith('gemini-2.'))).toBe(false);
    });
});
