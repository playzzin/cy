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
        // 급여 형태는 공제 대상 여부가 아니다. 선택한 공제를 전달하고,
        // 실제 대상 금액과 중복 과세 제외는 근무 내역 계산에서 결정한다.
        applyInsurance: options.applyInsurance,
        applyBusinessIncome: options.applyBusinessIncome,
        applyDailyFee: salaryModel === 'daily' && options.applyDailyFee,
    };
};
