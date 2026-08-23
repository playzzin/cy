import { createHash } from 'crypto';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

const asText = (value: unknown): string => String(value ?? '').trim();

const normalizeIdentityText = (value: unknown): string => (
    asText(value)
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .toLowerCase()
);

const normalizeIdentityAmount = (value: unknown): number => {
    const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const sha256Text = (value: string): string => createHash('sha256').update(value).digest('hex');

export interface CardStatementIdentityTransaction {
    date?: unknown;
    merchant?: unknown;
    amount?: unknown;
    category?: unknown;
    memo?: unknown;
}

export interface CardStatementIdentityResult {
    cardLast4?: unknown;
    cardName?: unknown;
    holderName?: unknown;
    subtotalAmount?: unknown;
    transactions?: CardStatementIdentityTransaction[];
}

export const normalizeCardStatementSourceSha256 = (value: unknown): string => {
    const normalized = asText(value).toLowerCase();
    return SHA256_HEX_PATTERN.test(normalized) ? normalized : '';
};

export const hashCardStatementSource = (source: Buffer | Uint8Array): string => (
    createHash('sha256').update(source).digest('hex')
);

export const buildCardStatementSourceClaimDocumentId = (sourceSha256: unknown): string => {
    const normalized = normalizeCardStatementSourceSha256(sourceSha256);
    return normalized ? `card_statement_source_${normalized}` : '';
};

export const buildCardStatementTransactionFingerprint = (
    transaction: CardStatementIdentityTransaction,
): string => sha256Text(JSON.stringify([
    normalizeIdentityText(transaction.date),
    normalizeIdentityText(transaction.merchant),
    normalizeIdentityAmount(transaction.amount),
    normalizeIdentityText(transaction.category).toUpperCase(),
    normalizeIdentityText(transaction.memo),
]));

export const buildCardStatementBlockFingerprint = (
    result: CardStatementIdentityResult,
): string => {
    const transactionFingerprints = (Array.isArray(result.transactions) ? result.transactions : [])
        .map(buildCardStatementTransactionFingerprint)
        .sort();
    return sha256Text(JSON.stringify([
        normalizeIdentityText(result.cardLast4),
        normalizeIdentityText(result.cardName),
        normalizeIdentityText(result.holderName),
        normalizeIdentityAmount(result.subtotalAmount),
        transactionFingerprints,
    ]));
};

/**
 * Builds a stable transaction document id from the verified source bytes and
 * normalized statement contents. AI block/line ordering is intentionally not
 * part of the identity. Repeated identical rows receive a deterministic
 * occurrence suffix; their resulting id set remains unchanged after sorting.
 */
export const buildCardStatementTransactionDocumentId = (params: {
    yearMonth: string;
    cardId: string;
    sourceSha256: unknown;
    result: CardStatementIdentityResult;
    transactionIndex: number;
}): string => {
    const sourceSha256 = normalizeCardStatementSourceSha256(params.sourceSha256);
    const transactions = Array.isArray(params.result.transactions) ? params.result.transactions : [];
    const transaction = transactions[params.transactionIndex];
    if (!sourceSha256 || !transaction || !Number.isInteger(params.transactionIndex) || params.transactionIndex < 0) {
        return '';
    }

    const transactionFingerprint = buildCardStatementTransactionFingerprint(transaction);
    const occurrence = transactions
        .slice(0, params.transactionIndex)
        .reduce((count, candidate) => (
            buildCardStatementTransactionFingerprint(candidate) === transactionFingerprint ? count + 1 : count
        ), 0);
    const blockFingerprint = buildCardStatementBlockFingerprint(params.result);
    const identityDigest = sha256Text(JSON.stringify([
        asText(params.yearMonth),
        asText(params.cardId),
        sourceSha256,
        blockFingerprint,
        transactionFingerprint,
        occurrence,
    ])).slice(0, 40);

    return `card-statement__${asText(params.yearMonth)}__${asText(params.cardId)}__${identityDigest}`;
};
