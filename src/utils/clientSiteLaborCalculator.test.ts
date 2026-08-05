import {
  calculateClientSiteLaborRow,
  calculateClientSiteLaborTotals,
} from './clientSiteLaborCalculator';

describe('clientSiteLaborCalculator', () => {
  it('calculates base pay, allowance, deductions, tax, and net pay for one labor row', () => {
    const result = calculateClientSiteLaborRow({
      manDay: 2.5,
      unitPrice: 150000,
      allowance: 20000,
      deduction: 10000,
    }, {
      incomeTaxRate: 0.03,
      residentTaxRate: 0.003,
    });

    expect(result.baseAmount).toBe(375000);
    expect(result.grossAmount).toBe(395000);
    expect(result.incomeTax).toBe(11850);
    expect(result.residentTax).toBe(1185);
    expect(result.totalDeduction).toBe(23035);
    expect(result.netAmount).toBe(371965);
  });

  it('sums rows and keeps a unique worker count when worker keys are provided', () => {
    const totals = calculateClientSiteLaborTotals([
      { workerKey: 'worker-a', manDay: 1, unitPrice: 200000, allowance: 0, deduction: 5000 },
      { workerKey: 'worker-a', manDay: 0.5, unitPrice: 200000, allowance: 10000, deduction: 0 },
      { workerKey: 'worker-b', manDay: 1, unitPrice: 180000, allowance: 0, deduction: 0 },
    ]);

    expect(totals.rowCount).toBe(3);
    expect(totals.workerCount).toBe(2);
    expect(totals.manDay).toBe(2.5);
    expect(totals.baseAmount).toBe(480000);
    expect(totals.allowance).toBe(10000);
    expect(totals.manualDeduction).toBe(5000);
    expect(totals.netAmount).toBe(468830);
  });
});
