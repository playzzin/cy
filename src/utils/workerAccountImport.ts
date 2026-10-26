import type { Worker } from '../services/manpowerService';
import { isCompleteBankAccount, normalizeBankAccountFields, type BankAccountFields } from '../services/bankAccountPhotoService';
import { getWorkerAccount, workerAccountPatch, type WorkerAccountPurpose } from './workerAccount';

type Row = Record<string, unknown>;
type AccountPreview = { purpose: WorkerAccountPurpose; fields: BankAccountFields };
export type WorkerAccountImport = {
    keyText: string;
    workerId?: string;
    updates: Partial<Worker>;
    accounts: AccountPreview[];
    error?: string;
};
const text = (value: unknown) => String(value ?? '').trim();
const cell = (row: Row, aliases: string[]) => aliases.map(key => row[key]).find(value => text(value) !== '');
const aliases = {
    default: { bankName: ['기본 은행', '은행', 'bankName'], accountNumber: ['기본 계좌번호', '계좌번호', 'accountNumber'], accountHolder: ['기본 예금주', '예금주', 'accountHolder'] },
    directPay: { bankName: ['직불용 은행', '직불 은행', 'directPayBankName'], accountNumber: ['직불용 계좌번호', '직불 계좌번호', 'directPayAccountNumber'], accountHolder: ['직불용 예금주', '직불 예금주', 'directPayAccountHolder'] },
} as const;

export function planWorkerAccountImport(rows: Row[], workers: Worker[]): WorkerAccountImport[] {
    const plans = rows.map((row): WorkerAccountImport => {
        const id = text(cell(row, ['id', 'ID', '작업자ID']));
        const name = text(cell(row, ['이름', '작업자명']));
        const team = text(cell(row, ['팀명']));
        const plan: WorkerAccountImport = { keyText: `${name || id || '(식별값 없음)'} / ${team || '-'}`, updates: {}, accounts: [] };
        // An explicit but invalid ID must never fall back to somebody with a similar name.
        const matches = id ? workers.filter(worker => worker.id === id)
            : name ? workers.filter(worker => text(worker.name) === name && text(worker.teamName) === team) : [];
        if (matches.length !== 1 || !matches[0].id) return { ...plan, error: matches.length > 1 ? '동명이인 중복: 작업자ID를 입력해 주세요.' : '대상 작업자 미매칭' };
        const worker = matches[0];
        plan.workerId = worker.id;
        for (const purpose of ['default', 'directPay'] as const) {
            const fields = getWorkerAccount(worker, purpose);
            let changed = false;
            for (const key of ['bankName', 'accountNumber', 'accountHolder'] as const) {
                const value = cell(row, [...aliases[purpose][key]]);
                if (value === undefined) continue; // Missing columns and empty cells preserve saved data.
                if (key === 'accountNumber' && typeof value !== 'string') return { ...plan, updates: {}, error: '계좌번호는 앞자리 0이 보존되도록 텍스트 셀로 입력해 주세요.' };
                fields[key] = text(value);
                changed = true;
            }
            if (!changed) continue;
            if (!isCompleteBankAccount(fields)) return { ...plan, updates: {}, error: `${purpose === 'directPay' ? '직불용' : '기본'} 은행·계좌번호(6~20자리)·예금주를 확인해 주세요.` };
            const normalized = normalizeBankAccountFields(fields);
            plan.accounts.push({ purpose, fields: normalized });
            Object.assign(plan.updates, workerAccountPatch(normalized, purpose));
        }
        if (!plan.accounts.length) plan.error = '변경할 계좌정보가 없습니다. 빈 셀은 기존 정보를 유지합니다.';
        return plan;
    });
    const counts = new Map<string, number>();
    plans.forEach(plan => { if (plan.workerId) counts.set(plan.workerId, (counts.get(plan.workerId) || 0) + 1); });
    return plans.map(plan => plan.workerId && (counts.get(plan.workerId) || 0) > 1
        ? { ...plan, updates: {}, error: '같은 작업자가 중복되었습니다. 한 행에 기본·직불용 계좌를 입력해 주세요.' } : plan);
}
