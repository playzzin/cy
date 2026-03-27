import { useCallback } from 'react';

export const usePayrollCalculation = (config: any) => {
  /**
   * 특정 작업자의 총액과 공수에 따른 세금/보험료를 계산합니다.
   */
  const calculateResult = useCallback((params: {
    totalAmount: number;
    manDay: number;
    isLabor: boolean;
    applyInsurance: boolean;
    applyBusinessIncome: boolean;
  }) => {
    const amount = Number(params.totalAmount) || 0;
    const safeAmount = Math.max(0, Math.floor(amount));

    const pensionRate = Number(config?.insuranceConfig?.pensionRate ?? 0.045) || 0;
    const healthRate = Number(config?.insuranceConfig?.healthRate ?? 0.03545) || 0;
    const careRateOfHealth = Number(config?.insuranceConfig?.careRateOfHealth ?? 0.1295) || 0;
    const employmentRate = Number(config?.insuranceConfig?.employmentRate ?? 0.009) || 0;
    const businessIncomeTaxRate = Number(config?.businessIncomeTaxRate ?? 0.03) || 0;
    const businessResidentTaxRate = Number(config?.businessResidentTaxRate ?? 0.003) || 0;

    const insuranceAmount = params.applyInsurance
      ? Math.floor(safeAmount * (pensionRate + healthRate + (healthRate * careRateOfHealth) + employmentRate))
      : 0;
    const businessIncomeTax = params.applyBusinessIncome
      ? Math.floor(safeAmount * (businessIncomeTaxRate + businessResidentTaxRate))
      : 0;

    const totalDeduction = insuranceAmount + businessIncomeTax;
    const netAmount = safeAmount - totalDeduction;

    return {
      insuranceAmount,
      businessIncomeTax,
      totalDeduction,
      netAmount,
    };
  }, [config]);

  return {
    calculateResult
  };
};
