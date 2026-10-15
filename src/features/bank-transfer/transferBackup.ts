import { saveAs } from 'file-saver';
import { isTransferDraft, MAX_STORAGE_CHARACTERS, MAX_TRANSFER_DRAFTS } from './transferDraftStorage';
import type { TransferDraft } from './types';

export const MAX_BACKUP_BYTES = MAX_STORAGE_CHARACTERS * 3;
const FORMAT = 'cy-bank-transfer-backup';
export interface TransferBackup { format: typeof FORMAT; version: 1; exportedAt: string; drafts: TransferDraft[] }

export function parseTransferBackup(raw: string): TransferBackup {
    if (raw.length > MAX_STORAGE_CHARACTERS) throw new Error('백업 파일 용량이 너무 큽니다. 목록을 나누어 백업해 주세요.');
    let value: unknown;
    try { value = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { throw new Error('백업 파일을 읽을 수 없습니다. 송금 화면에서 만든 JSON 백업을 선택해 주세요.'); }
    const backup = value as Partial<TransferBackup> | null;
    if (!backup || backup.format !== FORMAT || backup.version !== 1 || typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))
        || !Array.isArray(backup.drafts) || !backup.drafts.length || backup.drafts.length > MAX_TRANSFER_DRAFTS || !backup.drafts.every(isTransferDraft)
        || new Set(backup.drafts.map(draft => draft.id)).size !== backup.drafts.length) throw new Error('지원하지 않거나 손상된 백업입니다. 기존 목록은 변경하지 않았습니다.');
    return backup as TransferBackup;
}

export function createTransferBackup(drafts: TransferDraft[], exportedAt = new Date().toISOString()): string {
    const raw = JSON.stringify({ format: FORMAT, version: 1, exportedAt, drafts });
    parseTransferBackup(raw);
    return raw;
}

export function downloadTransferBackup(drafts: TransferDraft[]) {
    const date = new Date().toISOString();
    const raw = createTransferBackup(drafts, date);
    saveAs(new Blob([raw], { type: 'application/json;charset=utf-8' }), `송금목록_백업_${date.replace(/[:.]/g, '-')}.json`);
}

export function readTransferBackupFile(file: File): Promise<TransferBackup> {
    if (file.size > MAX_BACKUP_BYTES) return Promise.reject(new Error('백업 파일 용량이 너무 큽니다. 12MB 이하의 파일을 선택해 주세요.'));
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('파일을 읽지 못했습니다. 다시 선택해 주세요.'));
        reader.onload = () => { try { resolve(parseTransferBackup(String(reader.result ?? ''))); } catch (error) { reject(error); } };
        reader.readAsText(file, 'utf-8');
    });
}
