import { createTransferRow, buildTransferWorkbook } from './transferModel';
import { compareExportRows, createExportRecord, matchesTransferIssue, transferSignature, workflowState } from './transferWorkflow';
import { isTransferDraft } from './transferDraftStorage';
import type { TransferDraft } from './types';
const row = () => createTransferRow({ id: 'rent:test', source: 'rent', sourceId: 'room', category: 'other', name: '검증숙소', groupName: '검증임대인', bankName: '국민은행', bankCode: '004', accountNumber: '0012345678', accountHolder: '검증예금주', amount: 1000, period: '2026-10', detail: '검증 월세' }, '검증', '{이름}');
const draft = (): TransferDraft => ({ version: 1, id: 'draft', title: '가상 송금', rows: [row()], period: '2026-10', receiverDisplay: '검증', memoRule: '{이름}', updatedAt: '2026-10-15T00:00:00Z' });
beforeEach(() => Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: () => 'file1' } }));

it('검토 후 계좌·금액·메모·변경 사유 수정은 재검토가 필요하지만 제목 수정은 유지한다', () => {
    const value = draft(); value.review = { signature: transferSignature(value.rows), reviewedAt: value.updatedAt };
    expect(workflowState(value).label).toBe('검토 완료');
    expect(workflowState({ ...value, title: '새 제목' }).reviewed).toBe(true);
    for (const patch of [{ amount: 2000 }, { accountNumber: '0098765432' }, { senderMemo: '변경' }, { adjustmentReason: '선지급' }, { accountHolder: '다른예금주' }]) {
        expect(workflowState({ ...value, rows: [{ ...value.rows[0], ...patch }] })).toMatchObject({ label: '작성 중', needsReview: true });
    }
});
it('파일 생성 당시 계좌·금액·중첩 상세를 편집 목록과 독립적으로 보존하고 동일 셀을 재생성한다', () => {
    const value = draft(); value.rows[0].rentDetail = { roomName: '검증숙소', address: '', billingMonth: '2026-10', originalAmount: 1000, basis: '대장', paymentStatus: '미확인' };
    const record = createExportRecord(value.rows, '검증.xlsx', value.updatedAt);
    value.rows[0].amount = 2000; value.rows[0].accountNumber = '0098765432'; value.rows[0].rentDetail!.originalAmount = 3000;
    expect(record.rows![0]).toMatchObject({ amount: 1000, accountNumber: '0012345678', rentDetail: { originalAmount: 1000 } });
    const cells = buildTransferWorkbook(record.rows!).Sheets['국민은행용'];
    expect(cells.B2.v).toBe('0012345678'); expect(cells.C2.v).toBe(1000);
});
it('결과가 일부만 있으면 파일 생성, 전부 확인되면 결과 확인이며 새 파일은 이전 결과를 물려받지 않는다', () => {
    const value = draft(); value.exportHistory = [createExportRecord(value.rows, '검증.xlsx', value.updatedAt)];
    expect(workflowState(value).label).toBe('파일 생성');
    value.exportHistory[0].results = [{ rowId: value.rows[0].rowId, status: 'failed', note: '계좌 오류' }];
    expect(workflowState(value).label).toBe('결과 확인');
    value.exportHistory.unshift({ ...createExportRecord(value.rows, '새파일.xlsx', value.updatedAt), id: 'new' });
    expect(workflowState(value).label).toBe('파일 생성');
});
it('오류와 주의사항·원본 금액 차이를 구분한다', () => {
    const value = row(); value.amount = 0;
    expect(matchesTransferIssue(value, 'amount', [])).toBe(true);
    expect(matchesTransferIssue(value, 'account', [])).toBe(false);
    expect(matchesTransferIssue(value, 'warning', ['추가 정산'])).toBe(true);
    expect(matchesTransferIssue(value, 'difference', [])).toBe(true);
});
it('이전 파일과 대상 추가·삭제·금액·계좌·순서 변경을 비교한다', () => {
    const a = row(), b = { ...a, rowId: 'b', id: 'b', name: '검증2' }, c = { ...a, rowId: 'c', id: 'c' };
    const comparison = compareExportRows([a, b, c], [{ ...b, amount: 2000 }, { ...a, accountNumber: '0098765432' }, { ...c, rowId: 'd', id: 'd' }]);
    expect(comparison).toMatchObject({ reordered: true });
    expect(comparison.added).toHaveLength(1); expect(comparison.removed).toHaveLength(1); expect(comparison.changed).toHaveLength(2);
});
it('이전 이력 호환성을 유지하면서 손상된 스냅샷과 결과 연결을 거부한다', () => {
    const value = draft(); const record = createExportRecord(value.rows, '검증.xlsx', value.updatedAt); value.exportHistory = [record];
    expect(isTransferDraft(value)).toBe(true);
    expect(isTransferDraft({ ...value, exportHistory: [{ ...record, rows: undefined }] })).toBe(true);
    expect(isTransferDraft({ ...value, exportHistory: [{ ...record, totalAmount: 2000 }] })).toBe(false);
    expect(isTransferDraft({ ...value, exportHistory: [{ ...record, results: [{ rowId: 'missing', status: 'success', note: '' }] }] })).toBe(false);
    expect(isTransferDraft({ ...value, review: { signature: 10, reviewedAt: value.updatedAt } })).toBe(false);
});
