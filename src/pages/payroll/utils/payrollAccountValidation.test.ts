import { validatePayrollAccount } from './payrollAccountValidation';

const account = { accountNumber: 'test-account', accountHolder: '검증 예금주' };

it.each(['국민은행', 'KB국민', ' 004 ', '신한은행'])('은행코드가 따로 없어도 은행명으로 검증한다: %s', bankName => {
    expect(validatePayrollAccount({ ...account, bankName })).toEqual({ isValid: true, errors: {} });
});

it('은행코드만 등록되어도 정상 계좌로 판단한다', () => {
    expect(validatePayrollAccount({ ...account, bankCode: '004' }).isValid).toBe(true);
});

it('공백 정보와 변환할 수 없는 은행명을 구분한다', () => {
    expect(validatePayrollAccount({ bankName: '없는금융기관', accountNumber: ' ', accountHolder: ' ' })).toEqual({
        isValid: false, errors: { bankCode: true, accountNumber: true, accountHolder: true },
    });
    expect(validatePayrollAccount({ ...account, bankName: ' ' }).errors).toEqual({ bankName: true });
});
