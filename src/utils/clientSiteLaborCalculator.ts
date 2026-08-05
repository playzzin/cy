export interface ClientSiteLaborTaxConfig {
  incomeTaxRate: number;
  residentTaxRate: number;
}

export interface ClientSiteLaborCalculationInput {
  manDay: number;
  unitPrice: number;
  allowance?: number;
  deduction?: number;
}

export interface ClientSiteLaborCalculationResult {
  manDay: number;
  unitPrice: number;
  baseAmount: number;
  allowance: number;
  grossAmount: number;
  incomeTax: number;
  residentTax: number;
  taxTotal: number;
  manualDeduction: number;
  totalDeduction: number;
  netAmount: number;
}

export interface ClientSiteLaborTotals extends ClientSiteLaborCalculationResult {
  rowCount: number;
  workerCount: number;
}

export const DEFAULT_CLIENT_SITE_LABOR_TAX_CONFIG: ClientSiteLaborTaxConfig = {
  incomeTaxRate: 0.03,
  residentTaxRate: 0.003,
};

const toNonNegativeNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const roundWon = (value: number): number => Math.round(value);

export const calculateClientSiteLaborRow = (
  input: ClientSiteLaborCalculationInput,
  taxConfig: ClientSiteLaborTaxConfig = DEFAULT_CLIENT_SITE_LABOR_TAX_CONFIG
): ClientSiteLaborCalculationResult => {
  const manDay = toNonNegativeNumber(input.manDay);
  const unitPrice = toNonNegativeNumber(input.unitPrice);
  const allowance = roundWon(toNonNegativeNumber(input.allowance));
  const manualDeduction = roundWon(toNonNegativeNumber(input.deduction));
  const baseAmount = roundWon(manDay * unitPrice);
  const grossAmount = baseAmount + allowance;
  const incomeTaxRate = toNonNegativeNumber(taxConfig.incomeTaxRate);
  const residentTaxRate = toNonNegativeNumber(taxConfig.residentTaxRate);
  const incomeTax = Math.floor(grossAmount * incomeTaxRate);
  const residentTax = Math.floor(grossAmount * residentTaxRate);
  const taxTotal = incomeTax + residentTax;
  const totalDeduction = manualDeduction + taxTotal;

  return {
    manDay,
    unitPrice,
    baseAmount,
    allowance,
    grossAmount,
    incomeTax,
    residentTax,
    taxTotal,
    manualDeduction,
    totalDeduction,
    netAmount: grossAmount - totalDeduction,
  };
};

export const calculateClientSiteLaborTotals = <T extends ClientSiteLaborCalculationInput & { workerKey?: string }>(
  rows: T[],
  taxConfig: ClientSiteLaborTaxConfig = DEFAULT_CLIENT_SITE_LABOR_TAX_CONFIG
): ClientSiteLaborTotals => {
  const workerKeys = new Set<string>();
  const initial: ClientSiteLaborTotals = {
    rowCount: 0,
    workerCount: 0,
    manDay: 0,
    unitPrice: 0,
    baseAmount: 0,
    allowance: 0,
    grossAmount: 0,
    incomeTax: 0,
    residentTax: 0,
    taxTotal: 0,
    manualDeduction: 0,
    totalDeduction: 0,
    netAmount: 0,
  };

  const totals = rows.reduce<ClientSiteLaborTotals>((acc, row) => {
    const calculated = calculateClientSiteLaborRow(row, taxConfig);
    if (row.workerKey) workerKeys.add(row.workerKey);
    acc.rowCount += 1;
    acc.manDay += calculated.manDay;
    acc.baseAmount += calculated.baseAmount;
    acc.allowance += calculated.allowance;
    acc.grossAmount += calculated.grossAmount;
    acc.incomeTax += calculated.incomeTax;
    acc.residentTax += calculated.residentTax;
    acc.taxTotal += calculated.taxTotal;
    acc.manualDeduction += calculated.manualDeduction;
    acc.totalDeduction += calculated.totalDeduction;
    acc.netAmount += calculated.netAmount;
    return acc;
  }, initial);

  totals.workerCount = workerKeys.size || rows.length;
  totals.unitPrice = totals.manDay > 0 ? Math.round(totals.baseAmount / totals.manDay) : 0;
  return totals;
};
