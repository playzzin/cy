import type { Worker } from '../services/manpowerService';
import { isCompleteBankAccount, type BankAccountFields } from '../services/bankAccountPhotoService';

export type WorkerAccountPurpose = 'default' | 'directPay';
const accountText = (value: unknown): string => typeof value === 'string' ? value : '';
export const workerAccountLabel = (purpose: WorkerAccountPurpose) => purpose === 'directPay' ? '직불용 계좌' : '기본 계좌';
export const getWorkerAccount = (worker: Worker, purpose: WorkerAccountPurpose): BankAccountFields => purpose === 'directPay'
    ? { bankName: accountText(worker.directPayBankName), accountNumber: accountText(worker.directPayAccountNumber), accountHolder: accountText(worker.directPayAccountHolder) }
    : { bankName: accountText(worker.bankName), accountNumber: accountText(worker.accountNumber), accountHolder: accountText(worker.accountHolder) };
export const workerAccountPatch = (fields: BankAccountFields, purpose: WorkerAccountPurpose): Partial<Worker> => purpose === 'directPay'
    ? { directPayBankName: fields.bankName, directPayAccountNumber: fields.accountNumber, directPayAccountHolder: fields.accountHolder }
    : { ...fields };
export const workerPhotoField = (purpose: WorkerAccountPurpose) => purpose === 'directPay' ? 'directPayBankPhotoId' : 'bankPhotoId';
export const hasMissingWorkerAccount = (worker: Worker) => !isCompleteBankAccount(getWorkerAccount(worker, 'default')) || !isCompleteBankAccount(getWorkerAccount(worker, 'directPay'));
