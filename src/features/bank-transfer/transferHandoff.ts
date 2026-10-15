import type { TransferCandidate } from './types';
import { isPayrollTransferDetail } from './payrollTransferDetail';
import { isSupportTransferDetail } from './supportTransferDetail';

const KEY_PREFIX = 'bank-transfer-handoff:v1:';
const storageKey = (userId: string): string => {
    if (!userId.trim()) throw new Error('로그인 후 송금 목록을 가져와 주세요.');
    return `${KEY_PREFIX}${encodeURIComponent(userId)}`;
};

const isCandidate = (value: unknown): value is TransferCandidate => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    const requiredText = ['id', 'sourceId', 'name', 'groupName', 'bankName', 'bankCode', 'accountNumber', 'accountHolder', 'period', 'detail'];
    if (!requiredText.every(key => typeof row[key] === 'string')) return false;
    if (!row.id || !row.sourceId) return false;
    if (!['account', 'payroll', 'rent', 'support'].includes(String(row.source))) return false;
    if (!['worker', 'team', 'company', 'purchase', 'other'].includes(String(row.category))) return false;
    if (typeof row.amount !== 'number' || !Number.isFinite(row.amount)) return false;
    if (row.payrollDetail !== undefined && !isPayrollTransferDetail(row.payrollDetail)) return false;
    if (row.supportDetail !== undefined && !isSupportTransferDetail(row.supportDetail)) return false;
    return ['receiverDisplay', 'senderMemo', 'warning'].every(key => row[key] === undefined || typeof row[key] === 'string');
};

export const storeTransferHandoff = (userId: string, candidates: TransferCandidate[]): void => {
    const key = storageKey(userId);
    if (!Array.isArray(candidates) || !candidates.every(isCandidate)) {
        throw new Error('송금 목록에 담을 데이터가 올바르지 않습니다.');
    }
    try {
        window.sessionStorage.setItem(key, JSON.stringify({ version: 1, userId, candidates }));
    } catch {
        throw new Error('브라우저에 송금 목록을 임시 저장하지 못했습니다. 저장 공간 또는 브라우저 설정을 확인해 주세요.');
    }
};

export const readTransferHandoff = (userId: string): TransferCandidate[] | null => {
    const key = storageKey(userId);
    let raw: string | null;
    try {
        raw = window.sessionStorage.getItem(key);
    } catch {
        throw new Error('브라우저에서 임시 송금 목록을 읽지 못했습니다.');
    }
    if (raw === null) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('임시 송금 목록이 손상되었습니다. 급여 미리보기에서 다시 담아 주세요.');
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('임시 송금 목록 형식이 올바르지 않습니다.');
    }
    const payload = parsed as Record<string, unknown>;
    if (payload.userId !== userId) throw new Error('현재 로그인 계정의 송금 목록이 아닙니다.');
    if (payload.version !== 1 || !Array.isArray(payload.candidates) || !payload.candidates.every(isCandidate)) {
        throw new Error('임시 송금 목록 형식이 올바르지 않습니다. 급여 미리보기에서 다시 담아 주세요.');
    }
    return payload.candidates;
};

export const clearTransferHandoff = (userId: string): void => {
    const key = storageKey(userId);
    try {
        window.sessionStorage.removeItem(key);
    } catch {
        throw new Error('가져온 임시 송금 목록을 정리하지 못했습니다.');
    }
};
