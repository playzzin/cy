import { Timestamp } from 'firebase/firestore';

export interface DeductionLine {
    label: string;
    amount: number;
    description?: string;
    isTemporary?: boolean;
    prefix?: string;
}

export interface DeductionBreakdown {
    standardLines: DeductionLine[];
    additionalLines: DeductionLine[];
    pension: number;
    health: number;
    longterm: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    businessIncomeTax: number;
    businessResidentTax: number;
    total: number;
    hasData: boolean;
}

export interface WorkerWorkEntry {
    date: string;
    siteId: string;
    siteName: string;
    clientCompanyId?: string;
    isLaborSite?: boolean;
    assignmentType?: 'corporate' | 'labor';
    paymentMethod?: string;
    manDay: number;
    unitPrice: number;
    amount: number;
}

export interface InsuranceAppliedReason {
    type: 'threshold' | 'manual' | 'all-labor';
    description: string;
}

export interface InsuranceAppliedSummary {
    appliedManDay: number;
    appliedAmount: number;
    reasons: InsuranceAppliedReason[];
}

export interface WithholdingAppliedSummary {
    grossAmount: number;
    appliedAmount: number;
    thresholdDays: number;
}

export interface BusinessIncomeAppliedSummary {
    appliedAmount: number;
    rate: number;
}

export interface InsuranceAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
}

export interface WithholdingAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
}

export interface BusinessIncomeAppliedSiteSummary {
    siteId: string;
    siteName: string;
    manDay: number;
    amount: number;
}

export interface TaxRateSnapshot {
    pensionRate: number;
    healthRate: number;
    longtermRate: number;
    employmentRate: number;
    incomeTaxRate: number;
    residentTaxRate: number;
    thresholdDays?: number;
    withholdingBaseDeduction?: number;
    withholdingIncomeBaseMultiplier?: number;
    withholdingIncomeTaxRate?: number;
    withholdingResidentTaxRate?: number;
    withholdingApplyAllLabor?: boolean;
    employmentApplyBelowThreshold?: boolean;
}

export interface PaymentData {
    id: string;
    workerId: string;
    workerName: string;
    idNumber?: string;
    teamId?: string;
    teamName?: string;
    companyId?: string;
    companyName?: string;
    month: string;
    unitPrice: number;
    totalManDay: number;
    grossAmount: number;
    totalDeduction: number;
    totalAmount: number;
    
    // 계산서 vs 노무 분리용
    invoiceManDay: number;
    invoiceGrossAmount: number;
    invoiceNetAmount: number;
    laborManDay: number;
    laborGrossAmount: number;
    laborNetAmount: number;

    // 상세 내역
    workEntries: WorkerWorkEntry[];
    deductionBreakdown: DeductionBreakdown;
    taxBreakdown: {
        standardLines: DeductionLine[];
        additionalLines: DeductionLine[];
    };
    
    // 보험/세금 적용 요약
    insuranceAppliedSummary?: InsuranceAppliedSummary;
    withholdingAppliedSummary?: WithholdingAppliedSummary;
    businessIncomeAppliedSummary?: BusinessIncomeAppliedSummary;
    
    // 현장별 요약 (보험/세금 기준)
    insuranceAppliedSites?: InsuranceAppliedSiteSummary[];
    withholdingAppliedSites?: WithholdingAppliedSiteSummary[];
    businessIncomeAppliedSites?: BusinessIncomeAppliedSiteSummary[];
    
    // 기타
    taxRateSnapshot: TaxRateSnapshot;
    displayContent: string;
    bankCode?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    isValid: boolean;
    errors: Record<string, boolean>;
}

export interface LedgerSideInput {
    carry: number;
    carrySecond: number;
    currentAdvance: number;
    currentAdvanceSecond: number;
    lodging: number;
    electricity: number;
    gas: number;
    water: number;
    internet: number;
    management: number;
    fine: number;
    other: number;
}

export interface LedgerManualInput {
    invoice: LedgerSideInput;
    labor: LedgerSideInput;
    personalMemo: string;
    assignmentType?: 'corporate' | 'labor';
    itemAssignments?: Record<string, 'corporate' | 'labor'>;
}

export interface MonthlyAdvanceLedgerWorkEntry {
    date?: string;
    siteId?: string;
    siteName?: string;
    clientCompanyId?: string;
    isLaborSite?: boolean;
    paymentMethod?: string;
    manDay: number;
    unitPrice: number;
    amount?: number;
}

export interface MonthlyAdvanceLedgerTaxAmounts {
    pension: number;
    health: number;
    care: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    businessIncomeTax: number;
    businessResidentTax: number;
    isWithholdingTarget: boolean;
}

export interface MonthlyAdvanceLedgerRow {
    rowKey: string;
    id: string;
    month: string;
    date: string;
    teamId: string;
    teamName: string;
    workerId: string;
    workerName: string;
    salaryModel?: string;
    invoiceManDay: number;
    laborManDay: number;
    unitPrice: number;
    invoiceGrossAmount: number;
    laborGrossAmount: number;
    amount: number;
    type: string;
    description?: string;
    workEntries?: MonthlyAdvanceLedgerWorkEntry[];
    statementTaxAmounts?: MonthlyAdvanceLedgerTaxAmounts;
    assignmentType?: 'corporate' | 'labor';
    manual?: LedgerManualInput;
}

export type LedgerUtilityInputLike = LedgerManualInput;

export type LedgerUtilitySideInputLike = LedgerSideInput;

export interface PayrollConfig {
    // 4대보험 요율
    pensionRate: number;
    healthRate: number;
    longtermRate: number;
    employmentRate: number;
    
    // 원천세 관련 기준
    thresholdDays: number;
    withholdingBaseDeduction: number;
    withholdingIncomeBaseMultiplier: number;
    withholdingIncomeTaxRate: number;
    withholdingResidentTaxRate: number;
    
    // 정책 설정
    withholdingApplyAllLabor: boolean;
    employmentApplyBelowThreshold: boolean;
    
    // 기타 소득세
    incomeTaxRate: number;
    residentTaxRate: number;
}
