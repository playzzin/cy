import {
    filterPayslipRowsBySalaryModel,
    resolvePayslipCalculationPolicy,
    resolvePayslipSalaryModel,
} from './payslipSalaryModel';

const rows = [
    { id: 'worker-a__2026-08__월급제' },
    { id: 'worker-b__2026-08__일급제' },
];

describe('payslip salary-model behavior', () => {
    it('filters preview and batch output into all, monthly, and daily groups', () => {
        expect(filterPayslipRowsBySalaryModel(rows, 'all')).toEqual(rows);
        expect(filterPayslipRowsBySalaryModel(rows, 'monthly')).toEqual([rows[0]]);
        expect(filterPayslipRowsBySalaryModel(rows, 'daily')).toEqual([rows[1]]);
        expect(resolvePayslipSalaryModel(rows[0])).toBe('monthly');
        expect(resolvePayslipSalaryModel(rows[1])).toBe('daily');
    });

    it('keeps monthly business-income tax separate from daily fee and insurance', () => {
        const options = {
            applyInsurance: true,
            applyBusinessIncome: true,
            applyDailyFee: true,
        };

        expect(resolvePayslipCalculationPolicy(rows[0], options)).toEqual({
            applyInsurance: false,
            applyBusinessIncome: true,
            applyDailyFee: false,
        });
        expect(resolvePayslipCalculationPolicy(rows[1], options)).toEqual({
            applyInsurance: true,
            applyBusinessIncome: false,
            applyDailyFee: true,
        });
    });
});
