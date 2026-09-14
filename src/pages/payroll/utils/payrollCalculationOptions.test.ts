import type { MonthlyPayrollSettlement } from '../../../services/monthlyPayrollSettlementService';
import {
    makePayrollCalculationOptionsSignature,
    resolveSavedPayrollCalculationOptions,
} from './payrollCalculationOptions';

const makeSettlement = (
    teamId: string,
    businessIncomeApplied: boolean
): MonthlyPayrollSettlement => ({
    id: `2026-07__${teamId}`,
    year: 2026,
    yearMonth: '2026-07',
    teamId,
    teamName: `${teamId}팀`,
    reportingType: businessIncomeApplied ? 'business_income' : 'labor',
    calculationOptions: {
        insuranceApplied: !businessIncomeApplied,
        insuranceTeamSiteOnly: false,
        businessIncomeApplied,
        utilitiesApplied: true,
        dailyFeeApplied: false,
    },
    businessIncomeAppliedAmount: 0,
    businessIncomeTaxAmount: 0,
    rows: [],
    runStatus: 'draft',
});

describe('saved payroll calculation option restoration', () => {
    const monthSet = new Set(['2026-07']);

    it('restores the selected team draft options', () => {
        const restored = resolveSavedPayrollCalculationOptions([
            makeSettlement('team-a', true),
            makeSettlement('team-b', false),
        ], monthSet, 'team-a');

        expect(restored).toMatchObject({
            insuranceApplied: false,
            businessIncomeApplied: true,
        });
        expect(restored && makePayrollCalculationOptionsSignature(restored)).toBe('00110');
    });

    it('does not guess when all-team drafts contain different options', () => {
        const restored = resolveSavedPayrollCalculationOptions([
            makeSettlement('team-a', true),
            makeSettlement('team-b', false),
        ], monthSet);

        expect(restored).toBeNull();
    });

    it('restores one shared setting across multiple teams', () => {
        const restored = resolveSavedPayrollCalculationOptions([
            makeSettlement('team-a', true),
            makeSettlement('team-b', true),
        ], monthSet);

        expect(restored?.businessIncomeApplied).toBe(true);
    });
});
