import type { Worker } from '../services/manpowerService';
import { isForeignWorker } from './workerForeignStatus';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalizedName = (value: unknown) => text(value).normalize('NFC').replace(/\s+/g, '');
const accountKeys = ['directPayBankName', 'directPayAccountNumber', 'directPayAccountHolder'] as const;

export const clearedDirectPayAccount = {
    directPayBankName: '', directPayAccountNumber: '', directPayAccountHolder: '', directPayBankPhotoId: '',
};

export function directPayAccountHolderError(worker: Partial<Worker>, holder: unknown): string {
    if (!normalizedName(holder)) return '직불용 계좌의 예금주를 입력해 주세요.';
    return normalizedName(worker.name) && (isForeignWorker(worker) || normalizedName(worker.name) === normalizedName(holder))
        ? '' : '직불용 계좌의 예금주는 작업자 이름과 같아야 합니다. 이름을 확인해 주세요.';
}

export class WorkerDirectPayAccountError extends Error {}

export function assertWorkerDirectPayAccount(before: Partial<Worker> | null | undefined, updates: Partial<Worker>): void {
    if (![...accountKeys, 'name' as const, 'idNumber' as const, 'isForeignWorker' as const].some(key =>
        Object.prototype.hasOwnProperty.call(updates, key) && updates[key] !== before?.[key])) return;
    const next = { ...before, ...updates };
    // Full removal is allowed even for legacy accounts with a different holder.
    if (!accountKeys.some(key => text(next[key]))) return;
    const error = directPayAccountHolderError(next, next.directPayAccountHolder);
    if (error) throw new WorkerDirectPayAccountError(error);
}
