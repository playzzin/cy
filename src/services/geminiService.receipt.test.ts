import { aiSettingsService } from './aiSettingsService';
import { geminiService } from './geminiService';

describe('geminiService.analyzeReceiptImage', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.spyOn(aiSettingsService, 'assertCurrentPageEnabled').mockImplementation(() => undefined);
        jest.spyOn(aiSettingsService, 'getApiKey').mockReturnValue('test-api-key');
        jest.spyOn(aiSettingsService, 'getModels').mockReturnValue({
            textModel: 'gemini-2.5-flash',
            analyticsModel: 'gemini-2.5-flash',
            imageModel: 'gemini-2.5-flash-image'
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
    });

    it('extracts and normalizes the final paid amount from a receipt image', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify({
                                isReceipt: true,
                                totalAmount: 12345.4,
                                merchantName: ' 테스트상점 ',
                                purchaseDate: '2026-08-02',
                                confidence: 1.4,
                                warning: ''
                            })
                        }]
                    }
                }]
            })
        } as Response);

        const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });
        const result = await geminiService.analyzeReceiptImage(file);

        expect(result).toEqual({
            isReceipt: true,
            totalAmount: 12345,
            merchantName: '테스트상점',
            purchaseDate: '2026-08-02',
            confidence: 1,
            warning: ''
        });

        const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
        const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        expect(request.generationConfig.responseMimeType).toBe('application/json');
        expect(request.generationConfig.responseJsonSchema.properties.totalAmount.type).toBe('number');
        expect(request.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    });

    it('does not apply an amount when the image is not a receipt', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify({
                                isReceipt: false,
                                totalAmount: 999999,
                                merchantName: '',
                                purchaseDate: '',
                                confidence: -0.2,
                                warning: '영수증이 아닙니다.'
                            })
                        }]
                    }
                }]
            })
        } as Response);

        const file = new File(['photo'], 'site.jpg', { type: 'image/jpeg' });
        const result = await geminiService.analyzeReceiptImage(file);

        expect(result.totalAmount).toBe(0);
        expect(result.confidence).toBe(0);
        expect(result.warning).toBe('영수증이 아닙니다.');
    });
});
