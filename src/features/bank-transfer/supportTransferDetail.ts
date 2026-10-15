import type { SupportTransferDetail } from './types';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const nonnegative = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const strings = (item: Record<string, unknown>, keys: string[]): boolean => keys.every(key => typeof item[key] === 'string');

export const isSupportTransferDetail = (value: unknown): value is SupportTransferDetail => {
    const item = record(value);
    return typeof item.capturedAt === 'string' && Number.isFinite(Date.parse(item.capturedAt))
        && (item.restoredFromSource === undefined || typeof item.restoredFromSource === 'boolean')
        && ['originalAmount', 'billingAmount', 'additionalAmount', 'expenseAmount', 'totalManDay', 'siteCount'].every(key => nonnegative(item[key]))
        && Number.isInteger(item.siteCount) && ['team', 'merged'].includes(String(item.adjustmentScope))
        && Array.isArray(item.workEntries) && item.workEntries.length <= 10000 && item.workEntries.every(entry => {
            const line = record(entry);
            return strings(line, ['date', 'siteName', 'targetTeamName', 'workerName', 'rateSource'])
                && ['manDay', 'unitPrice', 'amount'].every(key => nonnegative(line[key]));
        })
        && Array.isArray(item.expenseEntries) && item.expenseEntries.length <= 2000 && item.expenseEntries.every(entry => {
            const line = record(entry);
            return strings(line, ['date', 'siteName', 'category', 'description']) && nonnegative(line.amount)
                && ['charged', 'settled'].includes(String(line.status));
        });
};
