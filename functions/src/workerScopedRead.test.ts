import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ownWorkerRows, workerCatalogRow } from './workerScopedRead';

test('worker reports contain only own entries and recomputed totals, even within the same team', () => {
    const rows = ownWorkerRows('daily_reports', [{ id: 'mixed', date: '2026-10-17', memo: 'private', totalAmount: 999,
        workers: [{ workerId: 'self', manDay: 1, unitPrice: 100 }, { workerId: 'colleague', manDay: 2, unitPrice: 300 }] }], ['self']);
    assert.deepEqual(rows[0].workers.map((row: any) => row.workerId), ['self']);
    assert.equal(rows[0].totalAmount, 100); assert.equal(rows[0].memo, undefined);
    assert.deepEqual(ownWorkerRows('daily_reports', [{ id: 'foreign', workers: [{ workerId: 'colleague' }] }], ['self']), []);
});
test('worker catalogs and schedules remove coworkers, bank details and unrelated off-duty entries', () => {
    assert.deepEqual(workerCatalogRow('teams', { id: 'team', name: 'team', accountNumber: 'private', memberIds: ['other'] }), { id: 'team', name: 'team' });
    const result = ownWorkerRows('field_schedule_requests', [{ id: 'off', date: '2026-10-18', offDutyWorkerIds: ['self', 'other'], memo: 'private',
        offDutyRequestActors: { self: { memo: 'own' }, other: { memo: 'private' } } }], ['self'])[0];
    assert.deepEqual(result.offDutyWorkerIds, ['self']); assert.deepEqual(Object.keys(result.offDutyRequestActors), ['self']); assert.equal(result.memo, '');
    assert.deepEqual(ownWorkerRows('advance_requests', [{ id: 'foreign', workerId: 'other', teamId: 'same-team' }], ['self']), []);
});
