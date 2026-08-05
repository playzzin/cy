import { aiSettingsService, normalizeGeminiModelName } from './aiSettingsService';

export type TaxInvoiceTransactionType = '매입' | '매출' | '';

export interface TaxInvoiceExtractedCandidate {
    id: string;
    sourceFileName: string;
    sourceFileIndex: number;
    sourceRecordIndex: number;
    documentKind: string;
    transactionType: TaxInvoiceTransactionType;
    issueDate: string;
    approvalNumber: string;
    supplierName: string;
    supplierBusinessNumber: string;
    recipientName: string;
    recipientBusinessNumber: string;
    partnerName: string;
    siteName: string;
    description: string;
    supplyAmount: number;
    taxAmount: number;
    totalAmount: number;
    confidence: number;
    note: string;
    warnings: string[];
}

export interface TaxInvoiceAnalysisError {
    sourceFileName: string;
    sourceFileIndex: number;
    message: string;
}

export interface TaxInvoiceAnalysisBatch {
    candidates: TaxInvoiceExtractedCandidate[];
    errors: TaxInvoiceAnalysisError[];
}

export interface TaxInvoiceAnalysisProgress {
    completedFiles: number;
    totalFiles: number;
    currentFileName: string;
}

export interface TaxInvoiceCandidateValidation {
    blockingIssues: string[];
    reviewIssues: string[];
    duplicate: boolean;
    canApply: boolean;
}

export interface TaxInvoiceDuplicateSource {
    transactionType?: unknown;
    date?: unknown;
    issueDate?: unknown;
    partnerName?: unknown;
    totalAmount?: unknown;
}

interface AnalyzeTaxInvoiceFilesOptions {
    companyLabel: string;
    onProgress?: (progress: TaxInvoiceAnalysisProgress) => void;
    signal?: AbortSignal;
}

const SUPPORTED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
]);

export const TAX_INVOICE_MAX_FILE_COUNT = 30;
export const TAX_INVOICE_MAX_FILE_BYTES = 14 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 90_000;
const ANALYSIS_CONCURRENCY = 2;

const TAX_INVOICE_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        invoices: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    documentKind: { type: 'string' },
                    transactionType: { type: 'string', enum: ['매입', '매출', '미확인'] },
                    issueDate: { type: 'string' },
                    approvalNumber: { type: 'string' },
                    supplierName: { type: 'string' },
                    supplierBusinessNumber: { type: 'string' },
                    recipientName: { type: 'string' },
                    recipientBusinessNumber: { type: 'string' },
                    partnerName: { type: 'string' },
                    siteName: { type: 'string' },
                    description: { type: 'string' },
                    supplyAmount: { type: 'integer' },
                    taxAmount: { type: 'integer' },
                    totalAmount: { type: 'integer' },
                    confidence: { type: 'number' },
                    warnings: { type: 'array', items: { type: 'string' } },
                },
                required: [
                    'documentKind',
                    'transactionType',
                    'issueDate',
                    'approvalNumber',
                    'supplierName',
                    'supplierBusinessNumber',
                    'recipientName',
                    'recipientBusinessNumber',
                    'partnerName',
                    'siteName',
                    'description',
                    'supplyAmount',
                    'taxAmount',
                    'totalAmount',
                    'confidence',
                    'warnings',
                ],
            },
        },
    },
    required: ['invoices'],
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const normalizeAmount = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    const parsed = Number(normalizeText(value).replace(/,/g, '').replace(/[^0-9+.-]/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const normalizeConfidence = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), 1);
};

const normalizeIssueDate = (value: unknown): string => {
    const text = normalizeText(value);
    const match = text.match(/(19\d{2}|20\d{2}|2100)\D*(\d{1,2})\D*(\d{1,2})/);
    if (!match) return '';

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
    ) {
        return '';
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const normalizeTransactionType = (value: unknown): TaxInvoiceTransactionType => {
    const text = normalizeText(value);
    if (text === '매입' || text.includes('매입')) return '매입';
    if (text === '매출' || text.includes('매출')) return '매출';
    return '';
};

const normalizeWarnings = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map(normalizeText).filter(Boolean)));
};

const buildCandidateNote = (sourceFileName: string, approvalNumber: string): string => {
    const parts = ['Gemini 세금계산서 검수', sourceFileName];
    if (approvalNumber) parts.push(`승인번호 ${approvalNumber}`);
    return parts.join(' · ');
};

export const normalizeTaxInvoiceCandidate = (
    raw: Record<string, unknown>,
    sourceFileName: string,
    sourceFileIndex: number,
    sourceRecordIndex: number,
): TaxInvoiceExtractedCandidate => {
    const transactionType = normalizeTransactionType(raw.transactionType);
    const supplierName = normalizeText(raw.supplierName);
    const recipientName = normalizeText(raw.recipientName);
    const approvalNumber = normalizeText(raw.approvalNumber);
    const fallbackPartnerName = transactionType === '매입'
        ? supplierName
        : transactionType === '매출'
            ? recipientName
            : '';

    return {
        id: `${sourceFileIndex}-${sourceRecordIndex}-${sourceFileName}`,
        sourceFileName,
        sourceFileIndex,
        sourceRecordIndex,
        documentKind: normalizeText(raw.documentKind) || '세금계산서',
        transactionType,
        issueDate: normalizeIssueDate(raw.issueDate),
        approvalNumber,
        supplierName,
        supplierBusinessNumber: normalizeText(raw.supplierBusinessNumber),
        recipientName,
        recipientBusinessNumber: normalizeText(raw.recipientBusinessNumber),
        partnerName: normalizeText(raw.partnerName) || fallbackPartnerName,
        siteName: normalizeText(raw.siteName),
        description: normalizeText(raw.description) || '세금계산서',
        supplyAmount: normalizeAmount(raw.supplyAmount),
        taxAmount: normalizeAmount(raw.taxAmount),
        totalAmount: normalizeAmount(raw.totalAmount),
        confidence: normalizeConfidence(raw.confidence),
        note: buildCandidateNote(sourceFileName, approvalNumber),
        warnings: normalizeWarnings(raw.warnings),
    };
};

const normalizePartnerKey = (value: unknown): string => normalizeText(value)
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');

export const createTaxInvoiceDuplicateFingerprint = (source: TaxInvoiceDuplicateSource): string => {
    const transactionType = normalizeTransactionType(source.transactionType);
    const date = normalizeIssueDate(source.issueDate ?? source.date);
    const partnerName = normalizePartnerKey(source.partnerName);
    const totalAmount = normalizeAmount(source.totalAmount);
    if (!transactionType || !date || !partnerName || totalAmount <= 0) return '';
    return [transactionType, date, partnerName, totalAmount].join('|');
};

export const validateTaxInvoiceCandidate = (
    candidate: TaxInvoiceExtractedCandidate,
    knownFingerprints: ReadonlySet<string> = new Set(),
): TaxInvoiceCandidateValidation => {
    const blockingIssues: string[] = [];
    const reviewIssues = [...candidate.warnings];

    if (!candidate.transactionType) blockingIssues.push('매입/매출 구분을 선택하세요.');
    if (!normalizeIssueDate(candidate.issueDate)) blockingIssues.push('작성일자를 확인하세요.');
    if (!normalizeText(candidate.partnerName)) blockingIssues.push('거래처명을 확인하세요.');
    if (candidate.supplyAmount <= 0) blockingIssues.push('공급가액은 0보다 커야 합니다.');
    if (candidate.taxAmount < 0) blockingIssues.push('부가세는 0 이상이어야 합니다.');
    if (candidate.totalAmount <= 0) blockingIssues.push('합계는 0보다 커야 합니다.');

    if (candidate.totalAmount !== candidate.supplyAmount + candidate.taxAmount) {
        blockingIssues.push('합계가 공급가액 + 부가세와 일치하지 않습니다.');
    }

    const workbookTaxAmount = Math.round(candidate.supplyAmount * 0.1);
    if (candidate.supplyAmount > 0 && candidate.taxAmount !== workbookTaxAmount) {
        blockingIssues.push(`입력폼 자동 부가세(${workbookTaxAmount.toLocaleString()}원)와 다릅니다.`);
    }

    if (candidate.confidence < 0.8) {
        reviewIssues.push(`AI 신뢰도가 ${Math.round(candidate.confidence * 100)}%로 낮습니다.`);
    }
    if (!candidate.approvalNumber) reviewIssues.push('승인번호가 확인되지 않았습니다.');
    if (!candidate.siteName) reviewIssues.push('현장명이 비어 있습니다.');

    const fingerprint = createTaxInvoiceDuplicateFingerprint(candidate);
    const duplicate = Boolean(fingerprint && knownFingerprints.has(fingerprint));
    if (duplicate) reviewIssues.push('같은 구분·작성일자·거래처·합계의 기존 행이 있습니다.');

    return {
        blockingIssues: Array.from(new Set(blockingIssues)),
        reviewIssues: Array.from(new Set(reviewIssues.filter(Boolean))),
        duplicate,
        canApply: blockingIssues.length === 0,
    };
};

const getFileMimeType = (file: File): string => {
    const declared = normalizeText(file.type).toLowerCase();
    if (SUPPORTED_MIME_TYPES.has(declared)) return declared;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf')) return 'application/pdf';
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.webp')) return 'image/webp';
    if (lowerName.endsWith('.heic')) return 'image/heic';
    if (lowerName.endsWith('.heif')) return 'image/heif';
    return '';
};

export const validateTaxInvoiceFiles = (files: File[]): string[] => {
    const errors: string[] = [];
    if (files.length === 0) errors.push('분석할 파일을 선택하세요.');
    if (files.length > TAX_INVOICE_MAX_FILE_COUNT) {
        errors.push(`한 번에 최대 ${TAX_INVOICE_MAX_FILE_COUNT}개까지 분석할 수 있습니다.`);
    }

    files.forEach((file) => {
        if (!getFileMimeType(file)) {
            errors.push(`${file.name}: PDF, JPG, PNG, WEBP, HEIC 파일만 지원합니다.`);
        }
        if (file.size <= 0) errors.push(`${file.name}: 빈 파일입니다.`);
        if (file.size > TAX_INVOICE_MAX_FILE_BYTES) {
            errors.push(`${file.name}: 파일 크기가 14MB를 초과합니다. PDF를 나누거나 사진 해상도를 낮춰주세요.`);
        }
    });

    return Array.from(new Set(errors));
};

const readFileAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const result = String(reader.result || '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`));
    reader.readAsDataURL(file);
});

const buildPrompt = (companyLabel: string, fileName: string): string => `
당신은 대한민국 전자세금계산서 검수 담당자입니다.
첨부 파일 "${fileName}"에서 세금계산서 또는 수정세금계산서를 찾아 invoices 배열로 추출하세요.

장부 소유 회사 표기: "${companyLabel}"
- 소유 회사가 공급받는 자이면 transactionType은 "매입", partnerName은 공급자 상호입니다.
- 소유 회사가 공급자이면 transactionType은 "매출", partnerName은 공급받는 자 상호입니다.
- 소유 회사를 확실히 식별할 수 없으면 transactionType은 "미확인"입니다. 추측하지 마세요.
- siteName은 문서에 현장명/프로젝트명이 명시된 경우만 입력하고, 주소를 현장명으로 만들지 마세요.
- description은 품목명들을 짧게 합치되 문서에 없는 내용을 만들지 마세요.
- issueDate는 YYYY-MM-DD, 모든 금액은 원 단위 정수로 반환하세요.
- 공급가액, 세액, 합계를 각각 별도로 읽고 산술 일치 여부를 warnings에 기록하세요.
- confidence는 문서 판독 및 필드 확실성을 0~1로 표현하세요.
- 흐림, 회전, 잘림, 중복 페이지, 수정/취소, 영세율, 면세, 금액 불일치, 회사 식별 불가를 warnings에 기록하세요.
- 세금계산서가 없으면 invoices는 빈 배열로 반환하세요.
`;

const extractGeminiText = (payload: any): string => {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: any) => normalizeText(part?.text)).filter(Boolean).join('\n').trim();
};

const parseGeminiJson = (text: string): Record<string, unknown> => {
    const normalized = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    if (!normalized) throw new Error('Gemini가 분석 결과를 반환하지 않았습니다.');
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Gemini 분석 결과 형식이 올바르지 않습니다.');
    }
    return parsed as Record<string, unknown>;
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof DOMException && error.name === 'AbortError') return '분석 시간이 초과되었거나 취소되었습니다.';
    if (error instanceof Error) return error.message;
    return '세금계산서 분석에 실패했습니다.';
};

export const getTaxInvoiceGeminiApiErrorMessage = (
    apiError: unknown,
    responseStatus?: number,
    responseStatusText?: string,
): string => {
    const message = normalizeText(apiError);
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('api key not valid') || normalizedMessage.includes('api_key_invalid')) {
        return 'Gemini API Key가 유효하지 않습니다. Google AI Studio에서 새 Gemini API 키를 발급한 뒤 /settings/ai 상단의 “Gemini API Key”에 교체·저장하세요. 서버 Gemini API Key 입력란이 아닙니다.';
    }

    if (normalizedMessage.includes('reported as leaked')) {
        return 'Gemini API Key가 노출된 것으로 감지되어 차단되었습니다. Google AI Studio에서 새 Gemini API 키를 발급한 뒤 /settings/ai 상단의 “Gemini API Key”에 교체·저장하세요.';
    }

    if (normalizedMessage.includes('permission_denied') || normalizedMessage.includes('required permissions')) {
        return 'Gemini API Key 권한이 없습니다. Google AI Studio에서 이 키가 Gemini API용으로 발급·제한되었는지 확인한 뒤 다시 저장하세요.';
    }

    return `Gemini API 오류: ${message || `${responseStatus ?? ''} ${responseStatusText ?? ''}`.trim() || '알 수 없는 오류'}`;
};

const analyzeSingleFile = async (
    file: File,
    sourceFileIndex: number,
    companyLabel: string,
    apiKey: string,
    model: string,
    parentSignal?: AbortSignal,
): Promise<TaxInvoiceExtractedCandidate[]> => {
    const base64 = await readFileAsBase64(file);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const abortFromParent = () => controller.abort();
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: getFileMimeType(file), data: base64 } },
                            { text: buildPrompt(companyLabel, file.name) },
                        ],
                    }],
                    generationConfig: {
                        temperature: 0.05,
                        responseMimeType: 'application/json',
                        responseJsonSchema: TAX_INVOICE_RESPONSE_SCHEMA,
                    },
                }),
            },
        );

        const rawResponseText = await response.text();
        let payload: any = null;
        try {
            payload = rawResponseText ? JSON.parse(rawResponseText) : null;
        } catch {
            payload = null;
        }

        if (!response.ok || payload?.error) {
            const message = normalizeText(payload?.error?.message) || `${response.status} ${response.statusText}`;
            throw new Error(getTaxInvoiceGeminiApiErrorMessage(
                message,
                response.status,
                response.statusText,
            ));
        }

        const parsed = parseGeminiJson(extractGeminiText(payload));
        const invoices = Array.isArray(parsed.invoices) ? parsed.invoices : [];
        if (invoices.length === 0) throw new Error('파일에서 세금계산서를 찾지 못했습니다.');

        return invoices
            .filter((invoice): invoice is Record<string, unknown> => Boolean(invoice && typeof invoice === 'object' && !Array.isArray(invoice)))
            .map((invoice, sourceRecordIndex) => normalizeTaxInvoiceCandidate(
                invoice,
                file.name,
                sourceFileIndex,
                sourceRecordIndex,
            ));
    } finally {
        window.clearTimeout(timeoutId);
        parentSignal?.removeEventListener('abort', abortFromParent);
    }
};

export const analyzeTaxInvoiceFiles = async (
    files: File[],
    options: AnalyzeTaxInvoiceFilesOptions,
): Promise<TaxInvoiceAnalysisBatch> => {
    const fileErrors = validateTaxInvoiceFiles(files);
    if (fileErrors.length > 0) throw new Error(fileErrors.join('\n'));

    aiSettingsService.assertCurrentPageEnabled('세금계산서 AI 분석');
    const apiKey = aiSettingsService.getApiKey();
    if (!apiKey) {
        throw new Error('Gemini API 키가 없습니다. /settings/ai에서 Gemini API Key를 먼저 저장하세요.');
    }

    const model = normalizeGeminiModelName(aiSettingsService.getModels().textModel, 'gemini-2.5-flash');
    const batch: TaxInvoiceAnalysisBatch = { candidates: [], errors: [] };
    let nextFileIndex = 0;
    let completedFiles = 0;

    const worker = async () => {
        while (nextFileIndex < files.length) {
            if (options.signal?.aborted) return;
            const fileIndex = nextFileIndex;
            nextFileIndex += 1;
            const file = files[fileIndex];

            try {
                const candidates = await analyzeSingleFile(
                    file,
                    fileIndex,
                    options.companyLabel,
                    apiKey,
                    model,
                    options.signal,
                );
                batch.candidates.push(...candidates);
            } catch (error) {
                batch.errors.push({
                    sourceFileName: file.name,
                    sourceFileIndex: fileIndex,
                    message: getErrorMessage(error),
                });
            } finally {
                completedFiles += 1;
                options.onProgress?.({
                    completedFiles,
                    totalFiles: files.length,
                    currentFileName: file.name,
                });
            }
        }
    };

    await Promise.all(Array.from(
        { length: Math.min(ANALYSIS_CONCURRENCY, files.length) },
        () => worker(),
    ));

    batch.candidates.sort((left, right) => (
        left.sourceFileIndex - right.sourceFileIndex ||
        left.sourceRecordIndex - right.sourceRecordIndex
    ));
    batch.errors.sort((left, right) => left.sourceFileIndex - right.sourceFileIndex);
    return batch;
};
