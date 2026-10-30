export const ADVANCE_DEPOSIT_ACCOUNTS = [
    { value: 'corporate', label: '법인입금' },
    { value: 'personal', label: '개인입금' },
    { value: 'other', label: '기타입금' },
] as const;

// Keep old selections identifiable until the user explicitly chooses a new classification.
export const LEGACY_ADVANCE_DEPOSIT_ACCOUNTS = [
    { value: 'cheongyeon', label: '청연결제' },
    { value: 'dawon', label: '다원결제' },
] as const;

export type AdvanceDepositAccountCategory = typeof ADVANCE_DEPOSIT_ACCOUNTS[number]['value'];
export type AdvancePaymentDepositAccount = '' | AdvanceDepositAccountCategory | typeof LEGACY_ADVANCE_DEPOSIT_ACCOUNTS[number]['value'];

export const isAdvancePaymentDepositAccount = (value: unknown): value is AdvancePaymentDepositAccount =>
    value === '' || [...ADVANCE_DEPOSIT_ACCOUNTS, ...LEGACY_ADVANCE_DEPOSIT_ACCOUNTS].some(option => option.value === value);

export const normalizeAdvancePaymentDepositAccount = (value: unknown): AdvancePaymentDepositAccount =>
    isAdvancePaymentDepositAccount(value) ? value : '';
