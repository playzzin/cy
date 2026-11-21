import { resolvePayrollBankCode } from './payrollBankCode';

interface PayrollAccount {
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
}

/** 조회, 상세 표와 정산 점검에서 동일한 은행명 변환·공백 검사를 사용합니다. */
export function validatePayrollAccount(account: PayrollAccount) {
    const errors: Record<string, boolean> = {};
    if (!resolvePayrollBankCode(account.bankName, account.bankCode)) {
        errors[account.bankName?.trim() ? 'bankCode' : 'bankName'] = true;
    }
    if (!account.accountNumber?.trim()) errors.accountNumber = true;
    if (!account.accountHolder?.trim()) errors.accountHolder = true;
    return { isValid: Object.keys(errors).length === 0, errors };
}
