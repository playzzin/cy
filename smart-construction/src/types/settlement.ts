export interface SettlementEntry {
    id: string; // workerId + month (e.g., "worker123_2025-08")
    workerId: string;
    workerName: string;
    teamId: string;
    role: string;

    // Site Info
    laborSite: string; // Actual Site (Where they worked)
    reportedSite: string; // Reported Site (For tax/admin)

    // Income
    daysWorked: number; // Total Gongsu (Actual) - from Daily Reports
    reportedDays: number; // Reported Gongsu (Capped/Split)
    remainingDays: number; // Excess Gongsu (Total - Reported)

    unitPrice: number;  // Daily Rate
    grossPay: number;   // Total Gross (Actual)
    reportedGrossPay: number; // Reported Gross (for Tax calc)

    // Deductions
    taxRate: number;    // e.g., 0.033 (3.3%)
    taxAmount: number;  // Tax (Calculated on Reported Gross)

    // 4-Major Insurance (Optional/Calculated)
    nationalPension: number; // 국민연금
    healthInsurance: number; // 건강보험
    careInsurance: number;   // 요양보험
    employmentInsurance: number; // 고용보험

    // Variable Deductions (Manual Input)
    advancePayment: number; // 가불금 합계
    accommodationFee: number; // 숙소비
    foodExpense: number; // 식대
    otherDeduction: number; // 기타 공제

    // Final
    netPay: number; // 실지급액
    status: 'pending' | 'completed' | 'paid';

    // Metadata
    month: string; // YYYY-MM
    updatedAt: string; // ISO Date
}

export interface SettlementFilter {
    teamId: string;
    month: string; // YYYY-MM
}
