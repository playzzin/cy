import { getKBValidationErrorLabel, validateKBTransferRow } from '../../pages/payroll/utils/kbTransferExport';
import { resolvePayrollBankCode } from '../../pages/payroll/utils/payrollBankCode';
import type { TransferBankAccount, TransferRow } from './types';

export function toTransferBankAccount(account: Omit<TransferBankAccount, 'bankCode'> & { bankCode?: string }): TransferBankAccount {
    const { bankName, accountNumber, accountHolder } = account;
    return { bankName, bankCode: resolvePayrollBankCode(bankName, account.bankCode), accountNumber, accountHolder };
}

export function isTransferBankAccount(value: unknown): value is TransferBankAccount {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const fields = value as Record<string, unknown>;
    return ['bankName', 'bankCode', 'accountNumber', 'accountHolder'].every(key => typeof fields[key] === 'string' && fields[key].length <= 2000);
}

export function updatePayrollTransferAccount(row: TransferRow, account: Partial<TransferBankAccount>, usesPrimaryAccount = false): TransferRow {
    const validationLabels = validateKBTransferRow(row).filter(error => error !== 'amount').map(getKBValidationErrorLabel);
    const previousAccountWarning = validationLabels.length ? `${validationLabels.join(', ')} 확인 필요` : '';
    const warning = row.warning?.split(' · ').filter(item => item !== previousAccountWarning).join(' · ');
    return {
        ...row,
        ...account,
        usesPrimaryAccount,
        detail: row.detail.replace(/ · 대표계좌 적용$/, ''),
        warning: warning || undefined,
    };
}
