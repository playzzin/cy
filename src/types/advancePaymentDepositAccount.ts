export const ADVANCE_DEPOSIT_ACCOUNTS = [
    { value: 'cheongyeon', label: '청연결제' },
    { value: 'dawon', label: '다원결제' },
    { value: 'personal', label: '개인결제' },
] as const;

export type AdvancePaymentDepositAccount = '' | typeof ADVANCE_DEPOSIT_ACCOUNTS[number]['value'];

export const isAdvancePaymentDepositAccount = (value: unknown): value is AdvancePaymentDepositAccount =>
    value === '' || ADVANCE_DEPOSIT_ACCOUNTS.some(option => option.value === value);

export const normalizeAdvancePaymentDepositAccount = (value: unknown): AdvancePaymentDepositAccount =>
    isAdvancePaymentDepositAccount(value) ? value : '';
