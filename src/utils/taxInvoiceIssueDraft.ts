import type { TaxInvoiceIssue } from '../types/taxInvoiceList';
import { normalizeTypedDateInput } from './typedDateInput';

export type IssueUpdate = { id: string; data: Partial<TaxInvoiceIssue> };

export interface IssueSaveConflict {
    id: string;
    current: TaxInvoiceIssue | null;
    fields: Array<keyof TaxInvoiceIssue>;
    operation?: 'save' | 'delete';
}

export class IssueSaveConflictError extends Error {
    constructor(public readonly conflicts: IssueSaveConflict[]) {
        super('다른 창에서 변경되거나 삭제된 항목이 있습니다. 내 입력과 최신 값을 확인해주세요.');
        this.name = 'IssueSaveConflictError';
    }
}

export class IssueDeleteConflictError extends Error {
    constructor(public readonly conflicts: IssueSaveConflict[]) {
        super('다른 창에서 변경된 항목의 삭제를 중단했습니다. 최신 내용을 확인해주세요.');
        this.name = 'IssueDeleteConflictError';
    }
}

export const sameIssueField = (field: keyof TaxInvoiceIssue, left: unknown, right: unknown): boolean =>
    field === 'recipientManuallyEdited' || field === 'scanCompleted'
        ? (left === true) === (right === true)
        : (left ?? '') === (right ?? '');

/** Only batches acknowledged by the server may advance the saved snapshot. */
export class IssueBatchWriteError extends Error {
    constructor(public readonly completedIds: string[], public readonly originalError: unknown) {
        super('일부 항목을 처리하지 못했습니다. 완료된 항목은 유지됩니다.');
        this.name = 'IssueBatchWriteError';
    }
}

export const parseIssueNumber = (value: string): number | null => {
    const raw = value.trim();
    if (raw === '') return 0; // Preserve the existing explicit clear-to-zero behavior.
    if (!/^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
    const number = Number(raw.replace(/,/g, ''));
    return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null;
};

export const assertValidIssueNumbers = (data: Partial<TaxInvoiceIssue>): void => {
    for (const field of ['supplyAmount', 'manDays'] as const) {
        if (Object.prototype.hasOwnProperty.call(data, field)
            && (typeof data[field] !== 'number' || !Number.isFinite(data[field]) || Math.abs(data[field]!) > Number.MAX_SAFE_INTEGER)) {
            throw new Error('공급가와 공수는 처리 가능한 범위의 올바른 숫자로 입력해주세요.');
        }
    }
};

const EDITABLE_FIELDS = [
    'isNew', 'issueDate', 'recipient', 'item', 'supplyAmount', 'note',
    'manDays', 'teamName', 'remark', 'siteType', 'paymentType',
    'issueStatus', 'scanCompleted', 'recipientManuallyEdited',
] as const;

/** A deletion removes the entire record, so compare all business values, not only an edited field. */
export const getDeleteConflictFields = (current: TaxInvoiceIssue, saved: TaxInvoiceIssue): Array<keyof TaxInvoiceIssue> => {
    const fields: Array<keyof TaxInvoiceIssue> = [...EDITABLE_FIELDS, 'yearMonth', 'siteId', 'siteName', 'carriedFromIssueId', 'carriedFromYearMonth'];
    return fields.filter(field => !sameIssueField(field, current[field], saved[field]));
};

/** Compare the current draft with the last successfully saved snapshot. */
export const getIssuePendingChanges = (
    issues: TaxInvoiceIssue[],
    savedIssues: TaxInvoiceIssue[]
): Record<string, Partial<TaxInvoiceIssue>> => {
    const savedById = new Map(savedIssues.map(issue => [issue.id, issue]));
    const pending: Record<string, Partial<TaxInvoiceIssue>> = {};
    for (const issue of issues) {
        const saved = savedById.get(issue.id);
        if (!issue.id || !saved) continue;
        const changes: Partial<TaxInvoiceIssue> = {};
        for (const field of EDITABLE_FIELDS) {
            const before = saved[field];
            const after = issue[field];
            // Missing legacy flags and false have the same meaning.
            if (field === 'recipientManuallyEdited') {
                if ((before === true) !== (after === true)) changes[field] = after === true;
            } else if ((before ?? '') !== (after ?? '')) {
                Object.assign(changes, { [field]: after });
            }
        }
        if (Object.keys(changes).length) pending[issue.id] = changes;
    }
    return pending;
};

/** A completed request acknowledges only its submitted fields, never later edits. */
export const applySavedIssueUpdates = (issues: TaxInvoiceIssue[], updates: IssueUpdate[]): TaxInvoiceIssue[] => {
    const byId = new Map(updates.map(update => [update.id, update.data]));
    return issues.map(issue => {
        const data = issue.id ? byId.get(issue.id) : undefined;
        return data ? { ...issue, ...data } : issue;
    });
};

export const assertValidIssueDate = (data: Partial<TaxInvoiceIssue>): void => {
    if (!Object.prototype.hasOwnProperty.call(data, 'issueDate')) return;
    const value = data.issueDate;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || normalizeTypedDateInput(value) !== value) {
        throw new Error('발행일을 실제 존재하는 날짜(YYYY-MM-DD)로 입력해주세요.');
    }
};

export const getNextIssueNo = (issues: TaxInvoiceIssue[]): number =>
    Math.max(0, ...issues.map(issue => Number.isFinite(Number(issue.no)) ? Number(issue.no) : 0)) + 1;
