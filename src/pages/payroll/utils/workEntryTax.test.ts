import { calculateWorkEntryTaxBreakdown } from './workEntryTax';
import { resolvePayslipCalculationPolicy } from './payslipSalaryModel';
import type { WorkerWorkEntry } from '../types/payroll';

const config = {
    incomeTaxRate: 0.03,
    residentTaxRate: 0.003,
    insuranceConfig: {
        thresholdDays: 8,
        pensionRate: 0.045,
        healthRate: 0.03545,
        careRateOfHealth: 0.1295,
        employmentRate: 0.009,
        withholdingIncomeTaxRate: 0.06,
        withholdingResidentTaxRate: 0.1,
    },
};

const entry = (amount: number, manDay = 10, siteId = 'site-a'): WorkerWorkEntry => ({
    date: '2026-08-01', siteId, siteName: siteId,
    isLaborSite: true, paymentMethod: '노무', manDay,
    unitPrice: amount / manDay, amount,
});

const calculate = (
    salary: string,
    workEntries: WorkerWorkEntry[],
    applyInsurance = false,
    applyBusinessIncome = true,
    payrollConfig = config,
) => calculateWorkEntryTaxBreakdown({
    workEntries, payrollConfig,
    ...resolvePayslipCalculationPolicy({ id: `2026-08__worker__team__${salary}` }, {
        applyInsurance, applyBusinessIncome, applyDailyFee: false,
    }),
    normalizeSiteName: (name) => (name ?? '').trim(),
    withholdingThreshold: 7,
});

describe('monthly wage selected deductions', () => {
    it.each(['월급제', '일급제', '용역팀'])('applies business tax to %s, including the reported missing amounts', (salary) => {
        const cases = [
            [3622500, 108675, 10867], [1105000, 33150, 3315],
            [340000, 10200, 1020], [3840000, 115200, 11520],
            [2867500, 86025, 8602], [170000, 5100, 510],
        ];
        cases.forEach(([gross, income, resident]) => {
            const result = calculate(salary, [entry(gross)]);
            expect(result.statementTaxAmounts).toMatchObject({ businessIncomeTax: income, businessResidentTax: resident });
            expect(result.taxAdditionalLines.reduce((sum, line) => sum + line.amount, 0)).toBe(income + resident);
        });
    });

    it.each(['월급제', '일급제', '용역팀'])('applies insurance to eligible labor entries for %s', (salary) => {
        const result = calculate(salary, [entry(2400000)], true, false);
        expect(result.statementTaxAmounts).toMatchObject({ pension: 108000, health: 85080, care: 11017, employment: 21600 });
        expect(result.insuranceAppliedSummary?.appliedAmount).toBe(2400000);
    });

    it('does not add business tax to labor amounts already covered by insurance/withholding', () => {
        const result = calculate('월급제', [entry(2400000), {
            ...entry(1000000, 5, 'invoice-site'), isLaborSite: false, paymentMethod: '계산서',
        }], true, true);
        expect(result.businessIncomeAppliedSummary?.appliedAmount).toBe(1000000);
        expect(result.statementTaxAmounts.businessIncomeTax).toBe(30000);
        expect(result.insuranceAppliedSummary?.appliedAmount).toBe(2400000);
    });

    it('keeps the site threshold and below-threshold employment rule', () => {
        const result = calculate('월급제', [entry(600000, 3)], true, false);
        expect(result.statementTaxAmounts).toMatchObject({ pension: 0, health: 0, care: 0, employment: 5400 });
    });

    it('respects the team-site restriction for pension and health', () => {
        const result = calculateWorkEntryTaxBreakdown({
            workEntries: [entry(2400000)], payrollConfig: config,
            applyInsurance: true, applyBusinessIncome: false,
            normalizeSiteName: (name) => name ?? '', withholdingThreshold: 7,
            isInsuranceEligibleEntry: () => false,
        });
        expect(result.statementTaxAmounts).toMatchObject({ pension: 0, health: 0, care: 0 });
    });

    it('calculates separate row amounts and changed settings without reusing another result', () => {
        expect(calculate('일급제', [entry(1000000)]).statementTaxAmounts.businessIncomeTax).toBe(30000);
        expect(calculate('일급제', [entry(2000000)]).statementTaxAmounts.businessIncomeTax).toBe(60000);
        const changed = { ...config, insuranceConfig: { ...config.insuranceConfig, pensionRate: 0.05 } };
        expect(calculate('월급제', [entry(2400000)], true, false, changed).statementTaxAmounts.pension).toBe(120000);
    });

    it('does not apply either deduction when both options are off', () => {
        expect(calculate('월급제', [entry(2400000)], false, false).taxAdditionalLines).toEqual([]);
    });
});
