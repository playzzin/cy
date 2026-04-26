/**
 * 급여 계산 유틸리티
 * 4대보험, 세금, 공제 계산을 중앙화하여 코드 중복 제거
 */

// 기본 4대보험 요율
export const DEFAULT_INSURANCE_CONFIG = {
    pensionRate: 0.045,       // 국민연금 4.5%
    healthRate: 0.03545,      // 건강보험 3.545%
    careRateOfHealth: 0.1295, // 장기요양 (건강보험의 12.95%)
    employmentRate: 0.009     // 고용보험 0.9%
};

// 기본 세금 요율
export const DEFAULT_TAX_RATE = 0.033; // 사업소득세 3.3%

export interface InsuranceConfig {
    pensionRate: number;
    healthRate: number;
    careRateOfHealth: number;
    employmentRate: number;
}

export interface PayrollDeductionResult {
    // 4대보험
    pension: number;        // 국민연금
    health: number;         // 건강보험
    care: number;           // 장기요양
    employment: number;     // 고용보험
    totalInsurance: number; // 4대보험 합계

    // 세금
    incomeTax: number;      // 사업소득세

    // 가불/공제
    advanceDeduction: number;

    // 합계
    totalDeduction: number; // 총 공제액
    netPay: number;         // 실지급액
}

export interface PayrollCalculationInput {
    grossPay: number;                           // 총 급여 (공수 * 단가)
    insuranceConfig?: InsuranceConfig | null;   // 4대보험 요율 (없으면 기본값)
    taxRate?: number | null;                    // 세금 요율 (없으면 기본값)
    advanceDeduction?: number;                  // 가불/공제 금액
}

/**
 * 급여 공제액 및 실지급액 계산
 * @param input 급여 계산 입력값
 * @returns 공제 내역 및 실지급액
 */
export const calculatePayrollDeductions = (input: PayrollCalculationInput): PayrollDeductionResult => {
    const { grossPay, advanceDeduction = 0 } = input;

    // 4대보험 요율 (저장된 값 또는 기본값)
    const insuranceConfig = input.insuranceConfig || DEFAULT_INSURANCE_CONFIG;
    const taxRate = input.taxRate ?? DEFAULT_TAX_RATE;

    // 4대보험 계산 (원 단위 반올림)
    const pension = Math.round(grossPay * insuranceConfig.pensionRate);
    const health = Math.round(grossPay * insuranceConfig.healthRate);
    const care = Math.round(health * insuranceConfig.careRateOfHealth); // 건강보험료 기준
    const employment = Math.round(grossPay * insuranceConfig.employmentRate);
    const totalInsurance = pension + health + care + employment;

    // 사업소득세 계산
    const incomeTax = Math.round(grossPay * taxRate);

    // 총 공제액
    const totalDeduction = totalInsurance + incomeTax + advanceDeduction;

    // 실지급액
    const netPay = grossPay - totalDeduction;

    return {
        pension,
        health,
        care,
        employment,
        totalInsurance,
        incomeTax,
        advanceDeduction,
        totalDeduction,
        netPay
    };
};

/**
 * 요율을 퍼센트 문자열로 변환
 * @param rate 요율 (0.045 형식)
 * @param decimals 소수점 자릿수
 * @returns 퍼센트 문자열 ("4.5%" 형식)
 */
export const formatRateAsPercent = (rate: number, decimals: number = 1): string => {
    return (rate * 100).toFixed(decimals) + '%';
};

/**
 * 금액을 천단위 구분자로 포맷
 * @param amount 금액
 * @returns 포맷된 문자열
 */
export const formatCurrency = (amount: number): string => {
    return amount.toLocaleString();
};

/**
 * 여러 작업자의 총 실지급액 계산
 * @param workers 작업자 목록
 * @param getGrossPay 작업자별 총 급여 반환 함수
 * @param getAdvanceDeduction 작업자별 가불 금액 반환 함수
 * @param insuranceConfig 4대보험 요율
 * @param taxRate 세금 요율
 * @returns 총 실지급액
 */
export const calculateTotalNetPay = <T>(
    workers: T[],
    getGrossPay: (worker: T) => number,
    getAdvanceDeduction: (worker: T) => number,
    insuranceConfig?: InsuranceConfig | null,
    taxRate?: number | null
): number => {
    return workers.reduce((sum, worker) => {
        const result = calculatePayrollDeductions({
            grossPay: getGrossPay(worker),
            insuranceConfig,
            taxRate,
            advanceDeduction: getAdvanceDeduction(worker)
        });
        return sum + result.netPay;
    }, 0);
};
