import {
    calculatePayrollDeductions,
    formatRateAsPercent,
    formatCurrency,
    calculateTotalNetPay,
    DEFAULT_INSURANCE_CONFIG,
    DEFAULT_TAX_RATE
} from './payrollCalculator';

describe('payrollCalculator', () => {
    describe('calculatePayrollDeductions', () => {
        it('기본 요율로 급여 공제를 정확히 계산한다', () => {
            const result = calculatePayrollDeductions({
                grossPay: 3000000, // 300만원
                advanceDeduction: 0
            });

            // 국민연금: 3,000,000 * 0.045 = 135,000
            expect(result.pension).toBe(135000);
            // 건강보험: 3,000,000 * 0.03545 = 106,350
            expect(result.health).toBe(106350);
            // 장기요양: 106,350 * 0.1295 = 13,772.325 → Math.round = 13,772
            expect(result.care).toBe(13772);
            // 고용보험: 3,000,000 * 0.009 = 27,000
            expect(result.employment).toBe(27000);
            // 4대보험 합계
            expect(result.totalInsurance).toBe(135000 + 106350 + 13772 + 27000);
            // 사업소득세: 3,000,000 * 0.033 = 99,000
            expect(result.incomeTax).toBe(99000);
            // 총 공제
            expect(result.totalDeduction).toBe(result.totalInsurance + result.incomeTax);
            // 실지급액
            expect(result.netPay).toBe(3000000 - result.totalDeduction);
        });

        it('가불/공제 금액을 포함하여 계산한다', () => {
            const result = calculatePayrollDeductions({
                grossPay: 4000000,
                advanceDeduction: 500000 // 50만원 가불
            });

            expect(result.advanceDeduction).toBe(500000);
            expect(result.totalDeduction).toBe(result.totalInsurance + result.incomeTax + 500000);
            expect(result.netPay).toBe(4000000 - result.totalDeduction);
        });

        it('사용자 정의 요율을 적용한다', () => {
            const customConfig = {
                pensionRate: 0.05,      // 5%
                healthRate: 0.04,       // 4%
                careRateOfHealth: 0.15, // 15%
                employmentRate: 0.01    // 1%
            };

            const result = calculatePayrollDeductions({
                grossPay: 2000000,
                insuranceConfig: customConfig,
                taxRate: 0.04, // 4%
                advanceDeduction: 0
            });

            expect(result.pension).toBe(100000);  // 2,000,000 * 0.05
            expect(result.health).toBe(80000);    // 2,000,000 * 0.04
            expect(result.care).toBe(12000);      // 80,000 * 0.15
            expect(result.employment).toBe(20000); // 2,000,000 * 0.01
            expect(result.incomeTax).toBe(80000); // 2,000,000 * 0.04
        });

        it('0원 급여를 처리한다', () => {
            const result = calculatePayrollDeductions({
                grossPay: 0,
                advanceDeduction: 0
            });

            expect(result.pension).toBe(0);
            expect(result.health).toBe(0);
            expect(result.care).toBe(0);
            expect(result.employment).toBe(0);
            expect(result.incomeTax).toBe(0);
            expect(result.totalDeduction).toBe(0);
            expect(result.netPay).toBe(0);
        });

        it('null 설정값을 기본값으로 처리한다', () => {
            const result = calculatePayrollDeductions({
                grossPay: 1000000,
                insuranceConfig: null,
                taxRate: null,
                advanceDeduction: 100000
            });

            // 기본 요율 사용
            expect(result.pension).toBe(45000);  // 1,000,000 * 0.045
            expect(result.incomeTax).toBe(33000); // 1,000,000 * 0.033
        });
    });

    describe('formatRateAsPercent', () => {
        it('요율을 퍼센트 문자열로 변환한다', () => {
            expect(formatRateAsPercent(0.045)).toBe('4.5%');
            expect(formatRateAsPercent(0.03545, 2)).toBe('3.55%');
            expect(formatRateAsPercent(0.1295, 2)).toBe('12.95%');
            expect(formatRateAsPercent(0.009, 1)).toBe('0.9%');
        });
    });

    describe('formatCurrency', () => {
        it('금액을 천단위 구분자로 포맷한다', () => {
            expect(formatCurrency(1000000)).toBe('1,000,000');
            expect(formatCurrency(0)).toBe('0');
            expect(formatCurrency(999)).toBe('999');
        });
    });

    describe('calculateTotalNetPay', () => {
        it('여러 작업자의 총 실지급액을 계산한다', () => {
            const workers = [
                { id: '1', grossPay: 3000000, advance: 100000 },
                { id: '2', grossPay: 2500000, advance: 50000 }
            ];

            const total = calculateTotalNetPay(
                workers,
                (w) => w.grossPay,
                (w) => w.advance
            );

            // 각 작업자 실지급액 합계와 일치해야 함
            const individual1 = calculatePayrollDeductions({ grossPay: 3000000, advanceDeduction: 100000 }).netPay;
            const individual2 = calculatePayrollDeductions({ grossPay: 2500000, advanceDeduction: 50000 }).netPay;

            expect(total).toBe(individual1 + individual2);
        });

        it('빈 배열은 0을 반환한다', () => {
            const total = calculateTotalNetPay(
                [],
                () => 0,
                () => 0
            );
            expect(total).toBe(0);
        });
    });

    describe('DEFAULT_INSURANCE_CONFIG', () => {
        it('기본 4대보험 요율이 정의되어 있다', () => {
            expect(DEFAULT_INSURANCE_CONFIG.pensionRate).toBe(0.045);
            expect(DEFAULT_INSURANCE_CONFIG.healthRate).toBe(0.03545);
            expect(DEFAULT_INSURANCE_CONFIG.careRateOfHealth).toBe(0.1295);
            expect(DEFAULT_INSURANCE_CONFIG.employmentRate).toBe(0.009);
        });
    });

    describe('DEFAULT_TAX_RATE', () => {
        it('기본 세금 요율이 3.3%이다', () => {
            expect(DEFAULT_TAX_RATE).toBe(0.033);
        });
    });
});
