export type MonthlyAdvanceAllocationSide = 'corporate' | 'labor';
export type MonthlyAdvanceAllocationMode = 'split' | MonthlyAdvanceAllocationSide;

export interface MonthlyAdvanceAllocationSource {
    invoiceManDay: number;
    laborManDay: number;
    invoiceGrossAmount: number;
    laborGrossAmount: number;
    assignmentType?: MonthlyAdvanceAllocationSide;
}

export interface MonthlyAdvanceAllocationResult {
    invoiceManDay: number;
    laborManDay: number;
    invoiceGrossAmount: number;
    laborGrossAmount: number;
}

const safePositiveNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const resolveDefaultMonthlyAdvanceAssignment = (
    row: MonthlyAdvanceAllocationSource
): MonthlyAdvanceAllocationSide => {
    if (row.assignmentType === 'corporate' || row.assignmentType === 'labor') {
        return row.assignmentType;
    }

    return safePositiveNumber(row.laborManDay) > safePositiveNumber(row.invoiceManDay)
        ? 'labor'
        : 'corporate';
};

export const allocateMonthlyAdvanceTotals = (
    row: MonthlyAdvanceAllocationSource,
    allocationMode: MonthlyAdvanceAllocationMode
): MonthlyAdvanceAllocationResult => {
    if (allocationMode === 'split') {
        return {
            invoiceManDay: safePositiveNumber(row.invoiceManDay),
            laborManDay: safePositiveNumber(row.laborManDay),
            invoiceGrossAmount: safePositiveNumber(row.invoiceGrossAmount),
            laborGrossAmount: safePositiveNumber(row.laborGrossAmount),
        };
    }

    const totalManDay = safePositiveNumber(row.invoiceManDay) + safePositiveNumber(row.laborManDay);
    const totalGrossAmount = safePositiveNumber(row.invoiceGrossAmount) + safePositiveNumber(row.laborGrossAmount);

    if (allocationMode === 'labor') {
        return {
            invoiceManDay: 0,
            laborManDay: totalManDay,
            invoiceGrossAmount: 0,
            laborGrossAmount: totalGrossAmount,
        };
    }

    return {
        invoiceManDay: totalManDay,
        laborManDay: 0,
        invoiceGrossAmount: totalGrossAmount,
        laborGrossAmount: 0,
    };
};
