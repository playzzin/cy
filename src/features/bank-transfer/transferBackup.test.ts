import { createTransferBackup, parseTransferBackup, readTransferBackupFile, MAX_BACKUP_BYTES } from './transferBackup';
import { loadTransferDrafts, restoreTransferDrafts, saveTransferDraft } from './transferDraftStorage';
import { createTransferRow } from './transferModel';
import type { TransferDraft } from './types';
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
const fixture = (id = 'backup1'): TransferDraft => ({ version: 1, id, title: '가상 백업', period: '2026-10', receiverDisplay: '검증회사', memoRule: '{이름}', updatedAt: '2026-10-15T00:00:00Z',
    rows: [createTransferRow({ id: 'payroll:w1:totalAmount', sourceId: 'w1', source: 'payroll', category: 'worker', name: '검증작업자', groupName: '검증팀', bankName: '국민은행', bankCode: '004', accountNumber: '00123456789', accountHolder: '검증예금주', amount: 1000, period: '2026-10', detail: '검증급여' }, '검증회사', '{이름}')],
    exportHistory: [{ id: 'file1', createdAt: '2026-10-15T00:00:00Z', fileName: '검증.xlsx', rowCount: 1, totalAmount: 1000 }] });
beforeEach(() => { localStorage.clear(); let sequence = 0; Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => `restore-${++sequence}` } }); });
afterEach(() => jest.restoreAllMocks());

it('다른 계정·브라우저에 같은 계좌 문자열·내역·파일 이력을 복원한다', () => {
    const value = fixture();
    const parsed = parseTransferBackup('\uFEFF' + createTransferBackup([value]));
    restoreTransferDrafts('different-user', parsed.drafts);
    expect(loadTransferDrafts('different-user')).toEqual([value]);
    expect(loadTransferDrafts('original-user')).toEqual([]);
});
it('같은 ID의 다른 내용은 별도 복원하고 동일 백업의 반복 복원을 건너뛴다', () => {
    const existing = fixture(); saveTransferDraft('user', existing);
    const changed = fixture(); changed.rows[0].amount = 2000;
    expect(restoreTransferDrafts('user', [changed])).toEqual({ addedCount: 1, copiedCount: 1, skippedCount: 0 });
    expect(loadTransferDrafts('user').find(item => item.id === existing.id)).toEqual(existing);
    expect(restoreTransferDrafts('user', [{ ...changed, updatedAt: '2026-10-15T01:00:00Z' }]).skippedCount).toBe(1);
    expect(loadTransferDrafts('user')).toHaveLength(2);
});
it('20개 제한이나 저장 공간 실패 시 일부 목록만 저장하지 않는다', () => {
    for (let i = 0; i < 19; i++) saveTransferDraft('user', { ...fixture(String(i)), title: `목록 ${i}` });
    const before = localStorage.getItem('cy:bank-transfer:drafts:user');
    expect(() => restoreTransferDrafts('user', [fixture('new1'), { ...fixture('new2'), title: '새로운 목록' }])).toThrow('20개');
    expect(localStorage.getItem('cy:bank-transfer:drafts:user')).toBe(before);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(() => restoreTransferDrafts('user', [fixture('new1')])).toThrow('저장 공간');
    expect(localStorage.getItem('cy:bank-transfer:drafts:user')).toBe(before);
});
it.each(['잘못된 JSON', '버전', '행', '이력', '중복 ID'])('%s 백업을 거부한다', kind => {
    const value = JSON.parse(createTransferBackup([fixture()]));
    if (kind === '버전') value.version = 2;
    if (kind === '행') value.drafts[0].rows[0].amount = '1000';
    if (kind === '이력') value.drafts[0].exportHistory[0].rowCount = -1;
    if (kind === '중복 ID') value.drafts.push(fixture());
    expect(() => parseTransferBackup(kind === '잘못된 JSON' ? '{broken' : JSON.stringify(value))).toThrow();
});
it('파일을 읽기 전에 크기 제한을 적용한다', async () => {
    const file = new File(['{}'], 'too-large.json'); Object.defineProperty(file, 'size', { value: MAX_BACKUP_BYTES + 1 });
    await expect(readTransferBackupFile(file)).rejects.toThrow('12MB');
});
