import { createHash } from 'crypto';
import * as functions from 'firebase-functions/v1';

/** Keep the authenticated statement endpoints inside the card attachment namespace. */
export const assertCardStatementStoragePath = (value: unknown): string => {
    const path = String(value ?? '').trim();
    if (!/^(card-billing-statements|card-ledger-statements|card-statement-imports)\/\d{4}-(0[1-9]|1[0-2])\/.+/.test(path)
        || path.includes('..') || /[\\\r\n?#]/.test(path) || path.split('/').some((part) => !part)) {
        throw new functions.https.HttpsError('invalid-argument', '카드 명세서 보관 경로만 조회하거나 분석할 수 있습니다.');
    }
    return path;
};

export const getCardStatementFileAnalysisId = (path: string): string =>
    createHash('sha256').update(assertCardStatementStoragePath(path)).digest('hex');

export const resolveCardStatementYearMonth = (path: string, requested?: unknown): string => {
    const month = assertCardStatementStoragePath(path).split('/')[1];
    if (requested && String(requested).trim() !== month) {
        throw new functions.https.HttpsError('invalid-argument', '선택한 월과 업로드 파일의 보관 월이 다릅니다.');
    }
    return month;
};

export const isActiveCardStatementProfile = (exists: boolean, profile: Record<string, unknown>): boolean =>
    exists && (profile.status === undefined || profile.status === 'active');

export const getCardStatementDetailAnalysisState = (analysis: Record<string, any>, now = Date.now()): {
    analysisStatus?: string; analysisError?: string;
} => {
    if (analysis.analysisStatus === 'completed' && analysis.activeRunId
        && analysis.file?.transactionCount !== undefined && Number(analysis.file.transactionCount) === 0) {
        return { analysisStatus: 'failed', analysisError: '이전 분석에서 사용 상세내역을 읽지 못했습니다. 거래내역이 포함된 PDF로 다시 분석해 주세요.' };
    }
    if (analysis.analysisStatus === 'analyzing'
        && (!Number.isFinite(Number(analysis.analysisStartedAtMillis))
            || Number(analysis.analysisStartedAtMillis) <= now - 600_000)) {
        return { analysisStatus: 'failed', analysisError: '분석 응답이 중단되었습니다. Gemini 분석을 다시 실행해 주세요.' };
    }
    return { analysisStatus: analysis.analysisStatus, analysisError: analysis.analysisError || undefined };
};

export interface CardStatementDetailChunk {
    resultIndex: number;
    chunkIndex: number;
    result: Record<string, unknown>;
}

/** Split long statements below Firestore's per-document limit without dropping rows. */
export const chunkCardStatementDetailResults = (
    results: Array<Record<string, unknown>>,
    maxBytes = 600_000,
): CardStatementDetailChunk[] => results.flatMap((result, resultIndex) => {
    const { transactions: rawTransactions, ...metadata } = result;
    const transactions = Array.isArray(rawTransactions) ? rawTransactions : [];
    const metadataBytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8') + 1024;
    if (metadataBytes > maxBytes) {
        throw new functions.https.HttpsError('failed-precondition', '분석된 카드 설명의 내용이 너무 큽니다.');
    }
    const chunks: CardStatementDetailChunk[] = [];
    let rows: unknown[] = [];
    let bytes = metadataBytes;
    const append = () => {
        chunks.push({ resultIndex, chunkIndex: chunks.length, result: { ...metadata, transactions: rows } });
        rows = [];
        bytes = metadataBytes;
    };
    for (const transaction of transactions) {
        const rowBytes = Buffer.byteLength(JSON.stringify(transaction), 'utf8') + 16;
        if (metadataBytes + rowBytes > maxBytes) {
            throw new functions.https.HttpsError('failed-precondition', '분석된 거래 한 건의 내용이 너무 큽니다.');
        }
        if (bytes + rowBytes > maxBytes && rows.length > 0) append();
        rows.push(transaction);
        bytes += rowBytes;
    }
    if (rows.length > 0 || chunks.length === 0) append();
    return chunks;
});

export const joinCardStatementDetailChunks = (chunks: CardStatementDetailChunk[]): Array<Record<string, unknown>> => {
    const results = new Map<number, Record<string, unknown>>();
    for (const chunk of [...chunks].sort((a, b) => a.resultIndex - b.resultIndex || a.chunkIndex - b.chunkIndex)) {
        const rows = Array.isArray(chunk.result.transactions) ? chunk.result.transactions : [];
        const existing = results.get(chunk.resultIndex);
        if (existing) (existing.transactions as unknown[]).push(...rows);
        else results.set(chunk.resultIndex, { ...chunk.result, transactions: [...rows] });
    }
    return Array.from(results.values());
};
