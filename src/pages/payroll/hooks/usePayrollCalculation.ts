import { useState, useCallback, useMemo } from 'react';
import { PayrollCalculations, WorkEntryTaxCalculationResult } from '../utils/payrollUtils';

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
    return PayrollCalculations.calculateWorkEntryTaxBreakdown({
      ...params,
      config
    });
  }, [config]);

  return {
    calculateResult
  };
};
