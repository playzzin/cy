import { strict as assert } from 'assert';
import { test } from 'node:test';
import { fineLedgerPeriod, sourceBelongsToFine, publicFineNotice } from './vehicleFineLinks';

const anchor = { id: 'vehicle-ledger__2026-11__car__2026-11-01__2026-11-15__FINE__BILLING_TARGET',
    type: 'FINE', date: '2026-11-01', vehicleId: 'car', status: 'ACTIVE', lastOperationId: 'vehicle-monthly-ledger:2026-11' };
const source = { id: 'notice', type: 'FINE', date: '2026-11-05', vehicleId: 'car', status: 'CANCELLED',
    lastOperationId: anchor.lastOperationId, fineChargeTarget: 'DRIVER', fineNotice: { violationDescription: '가상 위반', sourceSha256: 'a'.repeat(64), attachmentRemovedByUid: 'private' } };
test('월별대장 원본은 같은 차량·기간·저장 작업에만 연결하고 청구 대상 변경은 허용한다', () => {
    assert.deepEqual(fineLedgerPeriod(anchor), { start: '2026-11-01', end: '2026-11-15' });
    assert(sourceBelongsToFine(anchor, source, false));
    for (const patch of [{ vehicleId: 'other' }, { date: '2026-11-16' }, { lastOperationId: 'manual-cancel' }, { type: 'TOLL' }, { fineNotice: undefined }]) {
        assert(!sourceBelongsToFine(anchor, { ...source, ...patch }, false));
    }
    assert(!fineLedgerPeriod({ ...anchor, id: anchor.id.replace('__car__', '__other__') }));
    assert(!fineLedgerPeriod({ ...anchor, date: '2026-11-02' }));
});
test('명시적으로 보존한 연결은 다음 저장 작업에서도 유지하고 내부 감사 정보는 내보내지 않는다', () => {
    assert(sourceBelongsToFine({ ...anchor, lastOperationId: 'next-save' }, source, true));
    const detail = publicFineNotice(source, anchor.id);
    assert.equal(detail.attachmentExpenseId, anchor.id);
    assert.equal(detail.fineNotice.violationDescription, '가상 위반');
    assert(!('attachmentRemovedByUid' in detail.fineNotice));
    assert(!('status' in detail));
});
