import type {
    MonthlyPayrollCalculationOptions,
    MonthlyPayrollSettlement,
} from '../../../services/monthlyPayrollSettlementService';

const optionKeys: Array<keyof MonthlyPayrollCalculationOptions> = [
    'insuranceApplied',
    'insuranceTeamSiteOnly',
    'businessIncomeApplied',
    'utilitiesApplied',
    'dailyFeeApplied',
];

const normalizeOptions = (
    options: MonthlyPayrollCalculationOptions
): MonthlyPayrollCalculationOptions => ({
    insuranceApplied: Boolean(options?.insuranceApplied),
    insuranceTeamSiteOnly: Boolean(options?.insuranceTeamSiteOnly),
    businessIncomeApplied: Boolean(options?.businessIncomeApplied),
    utilitiesApplied: Boolean(options?.utilitiesApplied),
    dailyFeeApplied: Boolean(options?.dailyFeeApplied),
});

const haveSameOptions = (
    left: MonthlyPayrollCalculationOptions,
    right: MonthlyPayrollCalculationOptions
): boolean => optionKeys.every((key) => left[key] === right[key]);

/**
 * 현재 월/팀 범위에 저장된 자동공제 설정이 하나로 일치할 때만 복원한다.
 * 여러 팀의 저장값이 다르면 임의로 한 팀 값을 선택하지 않는다.
 */
export const resolveSavedPayrollCalculationOptions = (
    settlements: MonthlyPayrollSettlement[],
    monthSet: ReadonlySet<string>,
    selectedTeamId?: string
): MonthlyPayrollCalculationOptions | null => {
    const scoped = settlements.filter((settlement) => (
        monthSet.has(String(settlement.yearMonth ?? '').trim())
        && (!selectedTeamId || String(settlement.teamId ?? '').trim() === selectedTeamId)
    ));
    if (scoped.length === 0) return null;

    const first = normalizeOptions(scoped[0].calculationOptions);
    return scoped.every((settlement) => (
        haveSameOptions(first, normalizeOptions(settlement.calculationOptions))
    )) ? first : null;
};

export const makePayrollCalculationOptionsSignature = (
    options: MonthlyPayrollCalculationOptions
): string => optionKeys.map((key) => (options[key] ? '1' : '0')).join('');
