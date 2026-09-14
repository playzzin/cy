export type PayslipSalaryModel = 'monthly' | 'daily';
export type PayslipSalaryModelFilter = 'all' | PayslipSalaryModel;

type PayslipRowIdentity = { id?: string | null };

export const resolvePayslipSalaryModel = (row: PayslipRowIdentity): PayslipSalaryModel => (
    String(row.id ?? '').endsWith('__일급제') ? 'daily' : 'monthly'
);

export const filterPayslipRowsBySalaryModel = <T extends PayslipRowIdentity>(
    rows: T[],
    filter: PayslipSalaryModelFilter
): T[] => (
    filter === 'all'
        ? rows
        : rows.filter((row) => resolvePayslipSalaryModel(row) === filter)
);

export const resolvePayslipCalculationPolicy = (
    row: PayslipRowIdentity,
    options: {
        applyInsurance: boolean;
        applyBusinessIncome: boolean;
        applyDailyFee: boolean;
    }
): {
    applyInsurance: boolean;
    applyBusinessIncome: boolean;
    applyDailyFee: boolean;
} => {
    const salaryModel = resolvePayslipSalaryModel(row);
    return {
        // 현재 월급제는 사업소득세, 일급제는 일당 수수료가 기본이다.
        // 4대보험은 일급제에서 사용자가 메인 옵션을 켠 경우에만 반영한다.
        applyInsurance: salaryModel === 'daily' && options.applyInsurance,
        applyBusinessIncome: salaryModel === 'monthly' && options.applyBusinessIncome,
        applyDailyFee: salaryModel === 'daily' && options.applyDailyFee,
    };
};
