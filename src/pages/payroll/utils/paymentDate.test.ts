import { formatPayrollPaymentDate, getPayrollPaymentDate } from './paymentDate';

describe('payroll payment date', () => {
    it('급여월 다음 달 말일을 지급일로 계산한다', () => {
        const paymentDate = getPayrollPaymentDate('2026-03');

        expect(paymentDate?.getFullYear()).toBe(2026);
        expect(paymentDate?.getMonth()).toBe(3);
        expect(paymentDate?.getDate()).toBe(30);
        expect(formatPayrollPaymentDate('2026-03')).toBe('2026-04-30 (목)');
    });

    it('다음 달 말일이 일요일이면 하루 앞당긴다', () => {
        const paymentDate = getPayrollPaymentDate('2026-04');

        expect(paymentDate?.getFullYear()).toBe(2026);
        expect(paymentDate?.getMonth()).toBe(4);
        expect(paymentDate?.getDate()).toBe(30);
        expect(formatPayrollPaymentDate('2026-04')).toBe('2026-05-30 (토)');
    });

    it('잘못된 월 문자열은 대시로 표시한다', () => {
        expect(getPayrollPaymentDate('2026-13')).toBeNull();
        expect(formatPayrollPaymentDate('2026-13')).toBe('-');
    });
});
