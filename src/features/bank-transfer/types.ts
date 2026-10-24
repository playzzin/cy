import type { PayrollTransferDetail } from '../../pages/payroll/types/payroll';

export type TransferSource = 'account' | 'payroll' | 'rent' | 'support';
export type AccountCategory = 'worker' | 'team' | 'company' | 'purchase' | 'other';
export type AccountTeamAffiliation = 'cheongyeon' | 'external' | 'unassigned';
export type WorkerEmployment = 'active' | 'retired' | 'unknown';

export interface SupportTransferDetail {
    capturedAt: string;
    restoredFromSource?: boolean;
    originalAmount: number;
    billingAmount: number;
    additionalAmount: number;
    expenseAmount: number;
    totalManDay: number;
    siteCount: number;
    adjustmentScope: 'team' | 'merged';
    workEntries: {
        date: string;
        siteName: string;
        targetTeamName: string;
        workerName: string;
        manDay: number;
        unitPrice: number;
        amount: number;
        rateSource: string;
    }[];
    expenseEntries: {
        date: string;
        siteName: string;
        category: string;
        description: string;
        amount: number;
        status: 'charged' | 'settled';
    }[];
}

export interface TransferCandidate {
    id: string;
    source: TransferSource;
    sourceId: string;
    name: string;
    groupName: string;
    category: AccountCategory;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountHolder: string;
    amount: number;
    period: string;
    detail: string;
    receiverDisplay?: string;
    senderMemo?: string;
    warning?: string;
    accountTeamKey?: string;
    accountTeamLabel?: string;
    teamAffiliation?: AccountTeamAffiliation;
    payrollDetail?: PayrollTransferDetail;
    supportDetail?: SupportTransferDetail;
    /** Amount captured when a source item was added; manual accounts have no source amount. */
    originalAmount?: number;
    adjustmentReason?: string;
    rentDetail?: RentTransferDetail;
    retryContext?: { exportFileName: string; failureReason: string };
}

export interface RentTransferDetail {
    roomName: string;
    address: string;
    billingMonth: string;
    originalAmount: number;
    basis: string;
    paymentStatus: string;
}

export interface TransferRow extends TransferCandidate {
    rowId: string;
    receiverDisplay: string;
    senderMemo: string;
}

export interface TransferLoadResult {
    candidates: TransferCandidate[];
    warnings: string[];
    /** Current directory state, including workers without registered bank accounts. Not a payment snapshot. */
    workerEmployment?: Record<string, WorkerEmployment>;
}

export interface TransferDraft {
    version: 1;
    id: string;
    title: string;
    period: string;
    receiverDisplay: string;
    memoRule: string;
    rows: TransferRow[];
    updatedAt: string;
    exportHistory?: TransferExportRecord[];
    review?: { signature: string; reviewedAt: string };
}

export interface TransferExportRecord {
    id: string;
    createdAt: string;
    fileName: string;
    rowCount: number;
    totalAmount: number;
    /** Optional for legacy records. Frozen independently from the working list. */
    rows?: TransferRow[];
    results?: TransferResult[];
    resultsUpdatedAt?: string;
    resultFileName?: string;
}

export interface TransferResult {
    rowId: string;
    status: 'success' | 'failed';
    note: string;
}
