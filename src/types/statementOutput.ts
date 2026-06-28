export type StatementOutputKind = 'labor' | 'transaction' | 'rental';
export type StatementOutputStatus = 'beforeIssue' | 'afterIssue';
export type StatementOutputSource = 'progress-claims' | 'support-client-site' | 'support-team-payment' | 'monthly-wage';

export interface StatementOutputAmountSummary {
    manDay?: number;
    supplyAmount?: number;
    vatAmount?: number;
    totalAmount?: number;
}

export interface StatementOutputRecord {
    id?: string;
    source: StatementOutputSource;
    statementKey: string;
    kind: StatementOutputKind;
    status: StatementOutputStatus;
    yearMonth: string;
    targetTitle: string;
    targetSubtitle?: string;
    siteId?: string;
    siteName?: string;
    clientCompanyName?: string;
    teamName?: string;
    documentId?: string;
    documentNo?: string;
    documentTitle?: string;
    amountSummary?: StatementOutputAmountSummary;
    optionPreset?: StatementOutputStatus;
    optionSnapshot?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
    issuedAt?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
}

export const STATEMENT_OUTPUT_KIND_LABELS: Record<StatementOutputKind, string> = {
    labor: '노임명세서',
    transaction: '거래명세서',
    rental: '임대명세서',
};

export const STATEMENT_OUTPUT_STATUS_LABELS: Record<StatementOutputStatus, string> = {
    beforeIssue: '발행전',
    afterIssue: '발행후',
};

export const STATEMENT_OUTPUT_SOURCE_LABELS: Record<StatementOutputSource, string> = {
    'progress-claims': '기성관리',
    'support-client-site': '발주처/현장',
    'support-team-payment': '지원 정산',
    'monthly-wage': '월급제 급여',
};
