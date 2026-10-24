import type { PayrollTransferDetail } from '../../pages/payroll/types/payroll';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const lines = (value: unknown): PayrollTransferDetail['deductions'] => {
    const breakdown = record(value);
    return [breakdown.standardLines, breakdown.additionalLines].flatMap(items => Array.isArray(items) ? items : [])
        .map(record).filter(line => text(line.label) && number(line.amount) !== undefined)
        .map(line => ({ label: text(line.label), amount: number(line.amount)!, ...(text(line.description) ? { description: text(line.description) } : {}) }));
};

/** Copies calculated values, without recalculating or retaining identity data. */
export const buildPayrollTransferDetail = (value: unknown, options: Pick<PayrollTransferDetail, 'salaryLabel' | 'amountBasis' | 'originalAmount' | 'isFinalized'>): PayrollTransferDetail => {
    const source = record(value);
    return {
        ...options, capturedAt: new Date().toISOString(),
        grossAmount: number(source.grossAmount), totalDeduction: number(source.totalDeduction), netAmount: number(source.totalAmount),
        totalManDay: number(source.totalManDay), unitPrice: number(source.unitPrice),
        deductions: lines(source.deductionBreakdown), taxes: lines(source.taxBreakdown),
        workEntries: (Array.isArray(source.workEntries) ? source.workEntries : []).map(record)
            .filter(entry => [entry.manDay, entry.unitPrice, entry.amount].every(value => number(value) !== undefined))
            .map(entry => ({ date: text(entry.date), siteName: text(entry.siteName), manDay: number(entry.manDay)!, unitPrice: number(entry.unitPrice)!, amount: number(entry.amount)! })),
    };
};

export const isPayrollTransferDetail = (value: unknown): value is PayrollTransferDetail => {
    const item = record(value);
    const validLines = (value: unknown) => Array.isArray(value) && value.length <= 500 && value.every(line => {
        const data = record(line);
        return typeof data.label === 'string' && number(data.amount) !== undefined && (data.description === undefined || typeof data.description === 'string');
    });
    return typeof item.salaryLabel === 'string' && typeof item.amountBasis === 'string' && number(item.originalAmount) !== undefined
        && (item.restoredFromSource === undefined || typeof item.restoredFromSource === 'boolean')
        && typeof item.capturedAt === 'string' && Number.isFinite(Date.parse(item.capturedAt)) && typeof item.isFinalized === 'boolean'
        && ['grossAmount', 'totalDeduction', 'netAmount', 'totalManDay', 'unitPrice'].every(key => item[key] === undefined || number(item[key]) !== undefined)
        && validLines(item.deductions) && validLines(item.taxes) && Array.isArray(item.workEntries) && item.workEntries.length <= 2000
        && item.workEntries.every(entry => {
            const data = record(entry);
            return typeof data.date === 'string' && typeof data.siteName === 'string' && [data.manDay, data.unitPrice, data.amount].every(value => number(value) !== undefined);
        });
};
