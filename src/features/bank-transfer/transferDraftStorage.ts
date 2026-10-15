import type { TransferDraft, TransferExportRecord, TransferRow } from './types';
import { validateTransferRow } from './transferModel';
import { isPayrollTransferDetail } from './payrollTransferDetail';
import { isSupportTransferDetail } from './supportTransferDetail';
import { MAX_TRANSFER_ROWS } from './transferLimits';

// @guide-sync 05: 저장 위치/계정 범위/용량/충돌 정책 변경 시 transferGuideContent.ts의
// 저장·다른 PC·오류 FAQ와 저장/복원 연습도 수정한다. 연습에 실제 저장소를 연결하지 않는다.
export const MAX_TRANSFER_DRAFTS = 20;
export const MAX_TRANSFER_DRAFT_ROWS = MAX_TRANSFER_ROWS;
export const MAX_STORAGE_CHARACTERS = 4_000_000;
const STORAGE_PREFIX = 'cy:bank-transfer:drafts:';

type StorageEnvelope = { version: 1; drafts: TransferDraft[] };
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, maximum = 2000): value is string =>
    typeof value === 'string' && value.length <= maximum;
const isNonemptyText = (value: unknown, maximum = 2000): value is string =>
    isText(value, maximum) && value.trim().length > 0;

const isRow = (value: unknown): value is TransferRow => {
    if (!isRecord(value)) return false;
    if (typeof value.source !== 'string' || !['account', 'payroll', 'rent', 'support'].includes(value.source)) return false;
    if (typeof value.category !== 'string' || !['worker', 'team', 'company', 'purchase', 'other'].includes(value.category)) return false;
    if (!['id', 'rowId', 'sourceId'].every((field) => isNonemptyText(value[field], 500))) return false;
    if (!['name', 'groupName', 'bankName', 'bankCode', 'accountNumber', 'accountHolder', 'period',
        'detail', 'receiverDisplay', 'senderMemo'].every((field) => isText(value[field]))) return false;
    if (value.warning !== undefined && !isText(value.warning)) return false;
    if (['accountTeamKey', 'accountTeamLabel'].some(field => value[field] !== undefined && !isText(value[field]))) return false;
    if (value.teamAffiliation !== undefined && (typeof value.teamAffiliation !== 'string' || !['cheongyeon', 'external', 'unassigned'].includes(value.teamAffiliation))) return false;
    if (value.originalAmount !== undefined && (typeof value.originalAmount !== 'number' || !Number.isFinite(value.originalAmount))) return false;
    if (value.adjustmentReason !== undefined && !isText(value.adjustmentReason, 500)) return false;
    if (value.retryContext !== undefined && (!isRecord(value.retryContext) || !isNonemptyText(value.retryContext.exportFileName, 200) || !isText(value.retryContext.failureReason, 500))) return false;
    if (value.rentDetail !== undefined && (!isRecord(value.rentDetail)
        || !['roomName', 'address', 'billingMonth', 'basis', 'paymentStatus'].every(field => isText((value.rentDetail as Record<string, unknown>)[field]))
        || typeof value.rentDetail.originalAmount !== 'number' || !Number.isFinite(value.rentDetail.originalAmount))) return false;
    if (value.payrollDetail !== undefined && !isPayrollTransferDetail(value.payrollDetail)) return false;
    if (value.supportDetail !== undefined && !isSupportTransferDetail(value.supportDetail)) return false;
    // 미입력 금액과 계좌도 초안으로 보관할 수 있지만 JSON으로 손실되는 NaN/Infinity는 거부한다.
    return typeof value.amount === 'number' && Number.isFinite(value.amount);
};

const uniqueRows = (rows: TransferRow[]) => new Set(rows.map(row => row.rowId)).size === rows.length && new Set(rows.map(row => row.id)).size === rows.length;
const isDate = (value: unknown) => isText(value, 100) && Number.isFinite(Date.parse(value));
export const isTransferExportRecord = (item: unknown): item is TransferExportRecord => {
    if (!isRecord(item) || !isNonemptyText(item.id, 500) || !isNonemptyText(item.fileName, 200) || !isDate(item.createdAt)
        || !Number.isSafeInteger(item.rowCount) || Number(item.rowCount) <= 0 || Number(item.rowCount) > MAX_TRANSFER_DRAFT_ROWS
        || !Number.isSafeInteger(item.totalAmount) || Number(item.totalAmount) <= 0) return false;
    if (item.rows !== undefined && (!Array.isArray(item.rows) || item.rows.length !== item.rowCount || !item.rows.every(isRow)
        || !uniqueRows(item.rows) || item.rows.some(row => validateTransferRow(row).length)
        || item.rows.reduce((sum, row) => sum + row.amount, 0) !== item.totalAmount)) return false;
    if (item.resultFileName !== undefined && !isText(item.resultFileName, 200)) return false;
    if (item.resultsUpdatedAt !== undefined && !isDate(item.resultsUpdatedAt)) return false;
    if (item.results !== undefined) {
        if (!Array.isArray(item.rows) || !Array.isArray(item.results) || item.results.length > item.rows.length) return false;
        const rowIds = new Set(item.rows.map(row => row.rowId));
        if (!item.results.every(result => isRecord(result) && isNonemptyText(result.rowId, 500) && rowIds.has(result.rowId)
            && (result.status === 'success' || result.status === 'failed') && isText(result.note, 500))) return false;
        if (new Set(item.results.map(result => result.rowId)).size !== item.results.length) return false;
    }
    return true;
};

export const isTransferDraft = (value: unknown): value is TransferDraft => {
    if (!isRecord(value) || value.version !== 1) return false;
    if (!isNonemptyText(value.id, 500) || !isNonemptyText(value.title, 200)) return false;
    if (!isText(value.period, 100) || !isText(value.receiverDisplay) || !isText(value.memoRule)) return false;
    if (!isText(value.updatedAt, 100) || !Number.isFinite(Date.parse(value.updatedAt))) return false;
    if (value.review !== undefined && (!isRecord(value.review) || !isText(value.review.signature, 2_000_000) || !isDate(value.review.reviewedAt))) return false;
    if (value.exportHistory !== undefined && (!Array.isArray(value.exportHistory) || value.exportHistory.length > 20
        || !value.exportHistory.every(isTransferExportRecord) || new Set(value.exportHistory.map(item => item.id)).size !== value.exportHistory.length)) return false;
    if (!Array.isArray(value.rows) || value.rows.length > MAX_TRANSFER_DRAFT_ROWS || !value.rows.every(isRow)) return false;
    const ids = value.rows.map((row) => row.id);
    const rowIds = value.rows.map((row) => row.rowId);
    return new Set(ids).size === ids.length && new Set(rowIds).size === rowIds.length;
};

export const getTransferDraftStorageKey = (userId: string): string => {
    if (typeof userId !== 'string' || !userId.trim()) throw new Error('로그인한 사용자만 송금 초안을 저장하거나 불러올 수 있습니다.');
    return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
};

const storage = (): Storage => {
    try {
        if (typeof window === 'undefined') throw new Error();
        return window.localStorage;
    } catch {
        throw new Error('이 브라우저에서 초안 저장소에 접근할 수 없습니다. 브라우저 저장 설정을 확인해 주세요.');
    }
};

export const loadTransferDrafts = (userId: string): TransferDraft[] => {
    const key = getTransferDraftStorageKey(userId);
    let raw: string | null;
    try { raw = storage().getItem(key); }
    catch { throw new Error('송금 초안을 읽을 수 없습니다. 브라우저 저장 설정을 확인해 주세요.'); }
    if (raw === null) return [];
    if (raw.length > MAX_STORAGE_CHARACTERS) throw new Error('저장된 송금 초안이 용량 제한을 초과했습니다.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('저장된 송금 초안이 손상되어 불러올 수 없습니다. 기존 저장 내용은 유지됩니다.'); }
    if (isRecord(parsed) && (parsed.version !== 1 || (Array.isArray(parsed.drafts)
        && parsed.drafts.some((draft) => isRecord(draft) && draft.version !== 1)))) {
        throw new Error('이 버전의 송금 초안은 지원하지 않습니다. 기존 저장 내용은 유지됩니다.');
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.drafts) || parsed.drafts.length > MAX_TRANSFER_DRAFTS
        || !parsed.drafts.every(isTransferDraft) || new Set(parsed.drafts.map((draft) => draft.id)).size !== parsed.drafts.length) {
        throw new Error('저장된 송금 초안의 형식이 올바르지 않습니다. 기존 저장 내용은 유지됩니다.');
    }
    return [...parsed.drafts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};

const writeDrafts = (userId: string, drafts: TransferDraft[]): void => {
    const key = getTransferDraftStorageKey(userId);
    const envelope: StorageEnvelope = { version: 1, drafts };
    const raw = JSON.stringify(envelope);
    if (raw.length > MAX_STORAGE_CHARACTERS) throw new Error('초안 저장 용량을 초과했습니다. 이전 초안을 정리하거나 송금 목록을 나누어 주세요.');
    try { storage().setItem(key, raw); }
    catch (error) {
        const name = error instanceof Error ? error.name : '';
        if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            throw new Error('브라우저 저장 공간이 부족하여 초안을 저장하지 못했습니다. 이전 초안을 정리해 주세요.');
        }
        throw new Error('송금 초안을 저장하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.');
    }
};

type DraftWriteOptions = { expectedDraft: TransferDraft | null };
const checkForConflict = (existing: TransferDraft | undefined, options?: DraftWriteOptions): void => {
    if (options && JSON.stringify(existing ?? null) !== JSON.stringify(options.expectedDraft)) {
        throw new Error('다른 창에서 이 목록을 변경하거나 삭제했습니다. 저장한 목록을 다시 열거나 ‘사본 저장’으로 현재 편집 내용을 보관해 주세요.');
    }
};

export const saveTransferDraft = (userId: string, draft: TransferDraft, options?: DraftWriteOptions): void => {
    getTransferDraftStorageKey(userId);
    if (Array.isArray(draft?.rows) && draft.rows.length > MAX_TRANSFER_DRAFT_ROWS) {
        throw new Error(`초안 한 개에는 최대 ${MAX_TRANSFER_DRAFT_ROWS.toLocaleString('ko-KR')}행까지 저장할 수 있습니다.`);
    }
    if (!isTransferDraft(draft)) throw new Error('초안 형식이 올바르지 않아 저장하지 못했습니다. 제목과 입력 내용을 확인해 주세요.');
    const existing = loadTransferDrafts(userId);
    checkForConflict(existing.find(saved => saved.id === draft.id), options);
    const next = [draft, ...existing.filter((saved) => saved.id !== draft.id)];
    if (next.length > MAX_TRANSFER_DRAFTS) throw new Error(`초안은 최대 ${MAX_TRANSFER_DRAFTS}개까지 저장할 수 있습니다. 이전 초안을 정리해 주세요.`);
    writeDrafts(userId, next);
};

export const deleteTransferDraft = (userId: string, id: string, options?: DraftWriteOptions): void => {
    const drafts = loadTransferDrafts(userId);
    if (!isNonemptyText(id, 500)) throw new Error('삭제할 초안을 선택해 주세요.');
    checkForConflict(drafts.find(draft => draft.id === id), options);
    if (!drafts.some((draft) => draft.id === id)) return;
    writeDrafts(userId, drafts.filter((draft) => draft.id !== id));
};

/** Import is one validated write; a conflicting ID always becomes a separate list. */
export const restoreTransferDrafts = (userId: string, incoming: TransferDraft[]) => {
    if (!incoming.length || incoming.length > MAX_TRANSFER_DRAFTS || !incoming.every(isTransferDraft)) throw new Error('복원할 목록의 형식이 올바르지 않습니다.');
    const existing = loadTransferDrafts(userId);
    const content = (draft: TransferDraft) => JSON.stringify({ title: draft.title, period: draft.period, receiverDisplay: draft.receiverDisplay,
        memoRule: draft.memoRule, rows: draft.rows, exportHistory: draft.exportHistory ?? [], review: draft.review });
    const signatures = new Set(existing.map(content));
    const ids = new Set(existing.map(item => item.id));
    const restored: TransferDraft[] = [];
    let skippedCount = 0, copiedCount = 0;
    for (const item of incoming) {
        const signature = content(item);
        if (signatures.has(signature)) { skippedCount += 1; continue; }
        const collision = ids.has(item.id);
        const id = collision ? crypto.randomUUID() : item.id;
        if (ids.has(id)) throw new Error('복원 목록 번호를 만들지 못했습니다. 다시 시도해 주세요.');
        restored.push({ ...item, id }); ids.add(id); signatures.add(signature);
        if (collision) copiedCount += 1;
    }
    const next = [...restored, ...existing];
    if (next.length > MAX_TRANSFER_DRAFTS) throw new Error(`저장 가능한 목록은 ${MAX_TRANSFER_DRAFTS}개입니다. 현재 ${existing.length}개이며 새로 ${restored.length}개를 추가하려고 합니다. 복원할 목록을 줄여 주세요.`);
    if (restored.length) writeDrafts(userId, next);
    return { addedCount: restored.length, skippedCount, copiedCount };
};
