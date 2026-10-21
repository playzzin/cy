import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { saveTeamVehicleOilData } from './teamVehicleOilWrite';

test('오일 기록 저장은 비로그인·미리보기·잘못된 입력을 차단한다', async () => {
    await assert.rejects(saveTeamVehicleOilData({}, {} as any), (e: any) => e.code === 'unauthenticated');
    await assert.rejects(saveTeamVehicleOilData({}, { auth: { uid: 'cy-preview-test', token: {} } } as any), (e: any) => e.code === 'permission-denied');
    for (const records of [[], [{ id: '../other' }], [{ id: 'v', currentKm: 10, lastOilKm: 20, cycleKm: 10000 }]]) {
        await assert.rejects(saveTeamVehicleOilData({ records }, { auth: { uid: 'leader', token: {} } } as any), (e: any) => e.code === 'invalid-argument');
    }
});

test('현재 팀 배정을 다시 검증하고 타 팀·미변경 차량을 보존하며 혼합 저장 전체를 거부한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: process.env.TEAM_READ_TEST_PROJECT_ID || 'demo-team-scoped-read' });
    const db = app.firestore();
    const fixtures = {
        'users/oil-leader': { status: 'active', position: '팀장', linkedWorkerIds: ['oil-worker'] },
        'workers/oil-worker': { teamId: 'oil-team', status: '재직' },
        'teams/oil-team': { name: '가상 팀', legacyId: 'oil-legacy' },
        'vehicles/oil-own': { currentAssigneeType: 'TEAM', currentAssigneeId: 'oil-legacy' },
        'vehicles/oil-member': { currentAssigneeType: 'WORKER', currentAssigneeId: 'oil-worker' },
        'vehicles/oil-other': { currentAssigneeType: 'TEAM', currentAssigneeId: 'other-team' },
        'support_shared_data/engine_oil_cycle': { data: { 'oil-other': { currentKm: 999 }, untouched: { currentKm: 555 } } },
    };
    const context = { auth: { uid: 'oil-leader', token: { role: 'admin' } } } as any;
    const metric = (id: string) => ({ id, currentKm: 100, lastOilKm: 10, cycleKm: 5000 });
    const save = (ids: string[]) => saveTeamVehicleOilData({ records: ids.map(metric), teamId: 'other-team' }, context);
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, data]) => batch.set(db.doc(path), data));
        await batch.commit();
        assert.deepEqual(await save(['oil-own', 'oil-member']), { savedIds: ['oil-own', 'oil-member'] });
        const data = (await db.doc('support_shared_data/engine_oil_cycle').get()).data()!.data;
        assert.deepEqual(data['oil-own'], metric('oil-own'));
        assert.deepEqual(data['oil-other'], { currentKm: 999 });
        assert.deepEqual(data.untouched, { currentKm: 555 });
        await assert.rejects(save(['oil-own', 'oil-other']), (e: any) => e.code === 'permission-denied');
        await assert.rejects(save(['missing']), (e: any) => e.code === 'permission-denied');
        await db.doc('vehicles/oil-own').update({ currentAssigneeId: 'other-team', billingTargetType: 'TEAM', billingTargetId: 'oil-team' });
        await assert.rejects(save(['oil-own']), (e: any) => e.code === 'permission-denied');
        await db.doc('workers/oil-worker').update({ teamId: 'other-team' });
        await assert.rejects(save(['oil-member']), (e: any) => e.code === 'permission-denied');
        await db.doc('users/oil-leader').update({ status: 'suspended' });
        await assert.rejects(save(['oil-other']), (e: any) => e.code === 'permission-denied');
        assert.deepEqual((await db.doc('support_shared_data/engine_oil_cycle').get()).data()!.data, data);
    } finally {
        await Promise.all(Object.keys(fixtures).map(path => db.doc(path).delete()));
        await app.delete();
    }
});
