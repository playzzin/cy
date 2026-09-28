import { aiSettingsService } from './aiSettingsService';
import { generateImage } from './geminiImageService';

jest.mock('../config/firebase', () => ({ storage: {}, db: {} }));
jest.mock('firebase/storage', () => ({}));
jest.mock('firebase/firestore', () => ({}));

describe('Gemini image model migration', () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        localStorage.clear();
        aiSettingsService.setApiKey('test-only-key');
        localStorage.setItem('cy_ai_settings_v1', JSON.stringify({ models: { imageModel: 'models/gemini-2.5-flash-image-preview' } }));
    });
    afterEach(() => { global.fetch = originalFetch; localStorage.clear(); });

    it('uses the stable image endpoint and returns the final image instead of a thought image', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [
            { thought: true, inlineData: { data: 'draft', mimeType: 'image/png' } },
            { inlineData: { data: 'final-image', mimeType: 'image/webp' } }
        ] } }] }) });
        expect(await generateImage('A blue circle', 'SQUARE')).toEqual({ success: true, imageBase64: 'final-image', mimeType: 'image/webp' });
        const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toContain('/gemini-3.1-flash-image:generateContent');
        expect(JSON.parse(init.body).generationConfig.responseModalities).toEqual(['TEXT', 'IMAGE']);
    });

    it('does not report a thought-only image as a successful generation', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [
            { thought: true, inlineData: { data: 'draft' } }, { text: 'No final image' }
        ] } }] }) });
        expect(await generateImage('A blue circle', 'custom')).toEqual({ success: false, error: '이미지 생성 실패: No final image' });
    });
});
