import type { Worker } from '../services/manpowerService';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalizedName = (value: unknown) => text(value).normalize('NFC').replace(/\s+/g, '');
const accountKeys = ['directPayBankName', 'directPayAccountNumber', 'directPayAccountHolder'] as const;

export const clearedDirectPayAccount = {
    directPayBankName: '', directPayAccountNumber: '', directPayAccountHolder: '', directPayBankPhotoId: '',
};

export function directPayAccountHolderError(name: unknown, holder: unknown): string {
    return normalizedName(name) && normalizedName(name) === normalizedName(holder)
        ? '' : '직불용 계좌의 예금주는 작업자 이름과 같아야 합니다. 이름을 확인해 주세요.';
}

export function assertWorkerDirectPayAccount(before: Partial<Worker> | null | undefined, updates: Partial<Worker>): void {
    if (![...accountKeys, 'name'].some(key => Object.prototype.hasOwnProperty.call(updates, key))) return;
    const next = { ...before, ...updates };
    // Full removal is allowed even for legacy accounts with a different holder.
    if (!accountKeys.some(key => text(next[key]))) return;
    const error = directPayAccountHolderError(next.name, next.directPayAccountHolder);
    if (error) throw new Error(error);
}
