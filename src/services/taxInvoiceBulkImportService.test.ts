import {
    analyzeTaxInvoiceFiles,
    createTaxInvoiceDuplicateFingerprint,
    getTaxInvoiceGeminiApiErrorMessage,
    normalizeTaxInvoiceCandidate,
    validateTaxInvoiceCandidate,
    validateTaxInvoiceFiles,
} from './taxInvoiceBulkImportService';
import { GeminiBillingError } from './geminiGatewayClient';
import { trackedGeminiFetch } from './geminiUsageFetch';

jest.mock('./geminiUsageFetch', () => ({ trackedGeminiFetch: jest.fn() }));
jest.mock('./aiSettingsService', () => ({
    aiSettingsService: { assertCurrentPageEnabled: jest.fn(), getModels: () => ({ textModel: 'synthetic-model' }) },
    normalizeGeminiModelName: (value: string, fallback: string) => value || fallback,
}));

describe('taxInvoiceBulkImportService', () => {
    const sampleRaw = {
        documentKind: '전자세금계산서',
        transactionType: '매입',
        issueDate: '2026년 06월 30일',
        approvalNumber: '20260630-10260707-941149171',
        supplierName: '씨에스시스템(주)',
        supplierBusinessNumber: '786-88-02283',
        recipientName: '주식회사 청연이엔지',
        recipientBusinessNumber: '660-88-01871',
        partnerName: '씨에스시스템(주)',
        siteName: '',
        description: '단관파이프 외',
        supplyAmount: 296800,
        taxAmount: 29680,
        totalAmount: 326480,
        confidence: 0.97,
        warnings: [],
    };

    test('첨부 샘플과 같은 세금계산서 값을 장부 후보로 정규화한다', () => {
        const candidate = normalizeTaxInvoiceCandidate(sampleRaw, 'sample.jpg', 0, 0);

        expect(candidate).toMatchObject({
            transactionType: '매입',
            issueDate: '2026-06-30',
            partnerName: '씨에스시스템(주)',
            description: '단관파이프 외',
            supplyAmount: 296800,
            taxAmount: 29680,
            totalAmount: 326480,
            confidence: 0.97,
        });
        expect(candidate.note).toBe('');
        expect(candidate.sourceFileName).toBe('sample.jpg');
        expect(candidate.approvalNumber).toBe(sampleRaw.approvalNumber);
    });

    test('쉼표와 원 표기가 포함된 Gemini 금액도 원 단위 정수로 정규화한다', () => {
        const candidate = normalizeTaxInvoiceCandidate({
            ...sampleRaw,
            supplyAmount: '296,800원',
            taxAmount: '29,680',
            totalAmount: '326,480 원',
        }, 'formatted.jpg', 0, 0);

        expect(candidate.supplyAmount).toBe(296800);
        expect(candidate.taxAmount).toBe(29680);
        expect(candidate.totalAmount).toBe(326480);
    });

    test('정상 10% 세금계산서는 입력 가능하고 현장명 누락만 검토 항목으로 둔다', () => {
        const candidate = normalizeTaxInvoiceCandidate(sampleRaw, 'sample.jpg', 0, 0);
        const validation = validateTaxInvoiceCandidate(candidate);

        expect(validation.canApply).toBe(true);
        expect(validation.blockingIssues).toEqual([]);
        expect(validation.reviewIssues).toContain('현장명이 비어 있습니다.');
    });

    test('합계 및 입력폼 자동 부가세가 맞지 않으면 반영을 차단한다', () => {
        const candidate = normalizeTaxInvoiceCandidate({
            ...sampleRaw,
            taxAmount: 100,
            totalAmount: 300000,
        }, 'invalid.jpg', 0, 0);
        const validation = validateTaxInvoiceCandidate(candidate);

        expect(validation.canApply).toBe(false);
        expect(validation.blockingIssues).toEqual(expect.arrayContaining([
            '합계가 공급가액 + 부가세와 일치하지 않습니다.',
            '입력폼 자동 부가세(29,680원)와 다릅니다.',
        ]));
    });

    test('법인 표기 차이를 제거해 같은 거래를 중복으로 감지한다', () => {
        const candidate = normalizeTaxInvoiceCandidate(sampleRaw, 'sample.jpg', 0, 0);
        const fingerprint = createTaxInvoiceDuplicateFingerprint({
            transactionType: '매입',
            date: '2026-06-30',
            partnerName: '주식회사 씨에스시스템',
            totalAmount: 326480,
        });
        const validation = validateTaxInvoiceCandidate(candidate, new Set([fingerprint]));

        expect(validation.duplicate).toBe(true);
        expect(validation.canApply).toBe(true);
        expect(validation.reviewIssues.some((issue) => issue.includes('기존 행'))).toBe(true);
    });

    test('지원 형식과 파일 수·크기를 사전에 검증한다', () => {
        const validFile = new File(['invoice'], 'invoice.jpg', { type: 'image/jpeg' });
        const invalidFile = new File(['text'], 'invoice.txt', { type: 'text/plain' });

        expect(validateTaxInvoiceFiles([validFile])).toEqual([]);
        expect(validateTaxInvoiceFiles([invalidFile])).toContain(
            'invoice.txt: PDF, JPG, PNG, WEBP, HEIC 파일만 지원합니다.',
        );
    });

    test('유효하지 않은 Gemini 키 오류는 설정 화면의 올바른 입력란으로 안내한다', () => {
        const message = getTaxInvoiceGeminiApiErrorMessage('API key not valid. Please pass a valid API key.');

        expect(message).toContain('Gemini API Key가 유효하지 않습니다.');
        expect(message).toContain('/settings/ai 상단');
        expect(message).toContain('서버 Gemini API Key 입력란이 아닙니다.');
    });
});

describe('tax invoice batch stops dispatching after a billing failure', () => {
    const files = () => Array.from({ length: 5 }, (_, index) => new File(['synthetic'], `synthetic-${index}.png`, { type: 'image/png' }));
    const successResponse = () => ({
        ok: true,
        text: async () => JSON.stringify({ candidates: [{ content: { parts: [{
            text: JSON.stringify({ invoices: [{ supplierName: 'synthetic', totalAmount: 110, supplyAmount: 100, taxAmount: 10 }] }),
        }] } }] }),
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
            Object.defineProperty(this, 'result', { configurable: true, value: 'data:image/png;base64,c3ludGhldGlj' });
            this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
        });
    });
    afterEach(() => jest.restoreAllMocks());

    test('allows only the two in-flight requests and explicitly marks remaining files as unrequested', async () => {
        const invoke = jest.fn().mockRejectedValue(new GeminiBillingError());
        (trackedGeminiFetch as jest.Mock).mockReturnValue(invoke);
        const progress = jest.fn();
        const batch = await analyzeTaxInvoiceFiles(files(), { companyLabel: 'synthetic', onProgress: progress });

        expect(invoke).toHaveBeenCalledTimes(2);
        expect(batch.candidates).toHaveLength(0);
        expect(batch.errors).toHaveLength(5);
        expect(batch.errors.filter(error => error.skipped)).toHaveLength(3);
        expect(batch.errors.filter(error => error.skipped).every(error => error.message.includes('요청하지 않았습니다'))).toBe(true);
        expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ completedFiles: 2, totalFiles: 5 }));
    });

    test('preserves a successful response that was already in flight when billing rejected another file', async () => {
        const invoke = jest.fn().mockRejectedValueOnce(new GeminiBillingError()).mockResolvedValueOnce(successResponse());
        (trackedGeminiFetch as jest.Mock).mockReturnValue(invoke);
        const batch = await analyzeTaxInvoiceFiles(files(), { companyLabel: 'synthetic' });

        expect(invoke).toHaveBeenCalledTimes(2);
        expect(batch.candidates).toHaveLength(1);
        expect(batch.candidates[0].sourceFileIndex).toBe(1);
        expect(batch.errors.map(error => error.sourceFileIndex)).toEqual([0, 2, 3, 4]);
    });

    test('continues to subsequent files after an ordinary per-file analysis error', async () => {
        const invoke = jest.fn().mockRejectedValue(new Error('Synthetic unreadable document'));
        (trackedGeminiFetch as jest.Mock).mockReturnValue(invoke);
        const batch = await analyzeTaxInvoiceFiles(files(), { companyLabel: 'synthetic' });

        expect(invoke).toHaveBeenCalledTimes(5);
        expect(batch.errors).toHaveLength(5);
        expect(batch.errors.some(error => error.skipped)).toBe(false);
    });

    test('keeps pre-existing cancellation behavior without dispatching any file', async () => {
        const invoke = jest.fn();
        (trackedGeminiFetch as jest.Mock).mockReturnValue(invoke);
        const controller = new AbortController();
        controller.abort();
        const batch = await analyzeTaxInvoiceFiles(files(), { companyLabel: 'synthetic', signal: controller.signal });

        expect(invoke).not.toHaveBeenCalled();
        expect(batch).toEqual({ candidates: [], errors: [] });
    });
});
