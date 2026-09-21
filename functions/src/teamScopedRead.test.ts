import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { getTeamScopedData } from './teamScopedRead';

test('로그인하지 않은 호출은 데이터를 읽기 전에 차단한다', async () => {
    await assert.rejects(getTeamScopedData.run({ collection: 'workers' }, {} as any), (error: any) => error.code === 'unauthenticated');
});

test('서버가 연결된 팀을 결정하고 타 팀·미승인·임의 컬렉션 조회를 차단한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: process.env.TEAM_READ_TEST_PROJECT_ID || 'demo-team-scoped-read' });
    const db = app.firestore();
    const fixtures: Record<string, unknown> = {
        'users/leader': { status: 'active', role: 'user', position: '팀장', linkedWorkerIds: ['leader-worker'] },
        'users/pending': { status: 'pending', position: '팀장', linkedWorkerIds: ['leader-worker'] },
        'users/unlinked': { status: 'active', position: '팀장' },
        'teams/team-a': { name: 'A', companyId: 'company-a' }, 'teams/team-b': { name: 'B', companyId: 'company-b' },
        'companies/company-a': { name: 'A company', secret: 'private' }, 'companies/company-b': { name: 'B company' },
        'workers/leader-worker': { uid: 'leader', teamId: 'team-a', role: '팀장' },
        'workers/member-a': { teamId: 'team-a', createdAt: admin.firestore.Timestamp.fromMillis(1000) }, 'workers/member-b': { teamId: 'team-b' },
        'advance_payments/own': { workerId: 'member-a', teamId: 'team-a', yearMonth: '2026-09', items: { advance1: 100 } },
        'advance_payments/other': { workerId: 'member-b', teamId: 'team-b', yearMonth: '2026-09' },
        'advance_payments/wrong-team-label': { workerId: 'member-b', teamId: 'team-a', yearMonth: '2026-09' },
        'advance_requests/own': { workerId: 'member-a', teamId: 'team-a', requestedAmount: 50 },
        'advance_requests/other': { workerId: 'member-b', teamId: 'team-b', requesterUid: 'leader' },
        'advance_requests/nested-own': { worker: { id: 'member-a' } },
        'advance_requests/nested-precedence': { workerId: 'member-b', worker: { id: 'member-a' } },
        'system_configs/support_site_rates': { data: JSON.stringify([{ siteId: 'site-a', rate: 10 }, { siteId: 'site-b', rate: 90 }]) },
        'system_configs/team_settlement_sep__team-a': { data: JSON.stringify({ teamId: 'team-a', yearMonth: '2026-09' }) },
        'system_configs/team_settlement_legacy': { data: { responsibleTeam: { id: 'team-a' } } },
        'system_configs/team_settlement_other': { data: JSON.stringify({ teamId: 'team-b' }) },
        'system_configs/team_settlement_broken': { data: '{bad json' },
        'system_configs/unrelated': { data: JSON.stringify({ teamId: 'team-a' }) },
        'sites/site-a': { responsibleTeamId: 'team-a' }, 'sites/site-b': { responsibleTeamId: 'team-b' },
        'daily_reports/mixed': { date: '2026-09-17', workers: [{ workerId: 'member-a', manDay: 1, unitPrice: 100 }, { workerId: 'member-b', manDay: 1, unitPrice: 900 }] },
        'cardAssignments/own': { cardId: 'card-a', assigneeType: 'TEAM', assigneeId: 'team-a', startDate: '2026-09-10', endDate: '2026-09-20' },
        'cardTransactions/before': { cardId: 'card-a', date: '2026-09-01' },
        'cardTransactions/during': { cardId: 'card-a', date: '2026-09-17' },
        'cardTransactions/after': { cardId: 'card-a', date: '2026-09-25' },
        'vehicleAssignments/own': { vehicleId: 'vehicle-a', assigneeType: 'TEAM', assigneeId: 'team-a', startDate: '2026-09-10', endDate: '2026-09-20' },
        'vehicleExpenses/own': { vehicleId: 'vehicle-a', date: '2026-09-17' },
        'vehicleExpenses/other-period': { vehicleId: 'vehicle-a', date: '2026-09-25' },
        'accommodationAssignments/own': { accommodationId: 'house-a', teamId: 'team-a', startDate: '2026-09-01', endDate: '2026-09-30' },
        'accommodationUtilityRecords/own': { accommodationId: 'house-a', yearMonth: '2026-09' },
        'accommodationUtilityRecords/other-period': { accommodationId: 'house-a', yearMonth: '2026-10' },
        'accommodation_billing_targets/own-team': { accommodationId: 'house-a', targetType: 'team', teamId: 'team-a' },
        'accommodation_billing_targets/own-worker': { accommodationId: 'house-a', targetType: 'worker', workerId: 'member-a' },
        'accommodation_billing_targets/other-team': { accommodationId: 'house-b', targetType: 'team', teamId: 'team-b' },
        'materials/material-a': { itemName: '테스트 자재', materialKey: '기타::테스트자재::', category: '기타', unit: '개', unitPrice: 900, safetyStock: 2, hiddenCatalogDefault: true },
        'materialInbounds/own': { siteId: 'site-a', materialId: 'material-a', quantity: 3 },
        'materialInbounds/other-team': { siteId: 'site-b', materialId: 'material-a', quantity: 100 },
        'sites/nested-own': { responsibleTeam: { id: 'team-a' } },
        'sites/wrong-type': { assigneeType: 'COMPANY', assigneeId: 'team-a' },
        'accommodation_billing_documents/sep': { teamId: 'team-a', yearMonth: '2026-09' },
        'accommodation_billing_documents/oct': { team: { id: 'team-a' }, yearMonth: '2026-10' },
        'accommodation_billing_documents/other': { teamId: 'team-b', yearMonth: '2026-09' },
        'accommodation_billing_line_items/sep': { billingDocumentId: 'sep', amount: 100 },
        'accommodation_billing_line_items/oct': { billingDocument: { id: 'oct' }, amount: 200 },
        'accommodation_billing_line_items/other': { billingDocumentId: 'other', amount: 900 },
    };
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, data]) => batch.set(db.doc(path), data as any));
        await batch.commit();
        const call = (collection: string, uid = 'leader', extra = {}) => getTeamScopedData.run({ collection, ...extra }, { auth: { uid, token: { role: 'admin' } } } as any);
        assert.deepEqual((await call('teams', 'leader', { teamId: 'team-b' })).rows.map((row: any) => row.id), ['team-a']);
        assert.deepEqual((await call('workers')).rows.map((row: any) => row.id).sort(), ['leader-worker', 'member-a']);
        assert.deepEqual((await call('workers')).rows.find((row: any) => row.id === 'member-a').createdAt, { __teamTimestamp: 1000 });
        assert.deepEqual((await call('advance_payments')).rows.map((row: any) => row.id), ['own']);
        assert.deepEqual((await call('advance_requests')).rows.map((row: any) => row.id), ['nested-own', 'own']);
        const configs = (await call('system_configs')).rows;
        assert.deepEqual(configs.map((row: any) => row.id), ['support_site_rates', 'team_settlement_legacy', 'team_settlement_sep__team-a']);
        assert.deepEqual(JSON.parse(configs[0].data), [{ siteId: 'site-a', rate: 10 }]);
        assert.deepEqual((await call('system_configs', 'leader', { filters: { configId: 'team_settlement_sep__team-a' } })).rows.map((row: any) => row.id), ['team_settlement_sep__team-a']);
        for (const configId of ['team_settlement_other', 'unrelated', '../users/leader']) {
            assert.deepEqual((await call('system_configs', 'leader', { filters: { configId } })).rows, []);
        }
        await db.doc('system_configs/support_site_rates').set({ data: JSON.stringify({ rates: [{ siteId: 'site-a', rate: 10 }, { siteId: 'site-b', rate: 90 }] }) });
        const exactConfigs = await getTeamScopedData.run({ requests: [
            { collection: 'system_configs', filters: { configId: 'support_site_rates' } },
            { collection: 'system_configs', filters: { configId: 'team_settlement_legacy' } },
        ] }, { auth: { uid: 'leader', token: {} } } as any);
        assert.deepEqual(JSON.parse(exactConfigs.results[0].rows[0].data), { rates: [{ siteId: 'site-a', rate: 10 }] });
        assert.deepEqual(exactConfigs.results[1].rows.map((row: any) => row.id), ['team_settlement_legacy']);
        assert.deepEqual((await call('sites')).rows.map((row: any) => row.id).sort(), ['nested-own', 'site-a']);
        const reports = (await call('daily_reports', 'leader', { filters: { startDate: '2026-09-01', endDate: '2026-09-30' } })).rows;
        assert.equal(reports[0].workers.length, 1);
        assert.equal(reports[0].totalAmount, 100);
        assert.deepEqual((await call('cardTransactions')).rows.map((row: any) => row.id), ['during']);
        assert.deepEqual((await call('vehicleExpenses')).rows.map((row: any) => row.id), ['own']);
        assert.deepEqual((await call('accommodationUtilityRecords')).rows.map((row: any) => row.id), ['own']);
        assert.deepEqual((await call('accommodation_billing_targets')).rows.map((row: any) => row.id).sort(), ['own-team', 'own-worker']);
        const material = (await call('materials')).rows.find((row: any) => row.id === 'material-a');
        assert.equal(material.itemName, '테스트 자재');
        assert.equal(material.materialKey, '기타::테스트자재::');
        assert.equal(material.hiddenCatalogDefault, true);
        assert.equal(material.safetyStock, 2);
        assert.equal(material.unitPrice, undefined);
        assert.deepEqual((await call('materialInbounds')).rows.map((row: any) => row.quantity), [3]);
        const multi = await getTeamScopedData.run({ requests: [
            { collection: 'workers' }, { collection: 'teams' },
            { collection: 'accommodation_billing_documents', filters: { yearMonth: '2026-09' } },
            { collection: 'accommodation_billing_line_items', filters: { yearMonth: '2026-09' } },
            { collection: 'accommodation_billing_documents', filters: { yearMonth: '2026-10' } },
        ] }, { auth: { uid: 'leader', token: {} } } as any);
        assert.deepEqual(multi.results[0].rows.map((row: any) => row.id).sort(), ['leader-worker', 'member-a']);
        assert.deepEqual(multi.results[1].rows.map((row: any) => row.id), ['team-a']);
        assert.deepEqual(multi.results[2].rows.map((row: any) => row.id), ['sep']);
        assert.deepEqual(multi.results[3].rows.map((row: any) => row.id), ['sep']);
        assert.deepEqual(multi.results[4].rows.map((row: any) => row.id), ['oct']);
        await assert.rejects(getTeamScopedData.run({ requests: [{ collection: 'workers' }, { collection: 'users' }] }, { auth: { uid: 'leader' } } as any), (error: any) => error.code === 'invalid-argument');
        assert.deepEqual((await call('companies')).rows, [{ id: 'company-a', name: 'A company', type: null, code: null }]);
        await db.doc('companies/company-a').update({ name: 'A updated' });
        assert.equal((await call('companies', 'leader', { filters: { bypassCache: true } })).rows[0].name, 'A updated');
        // Even a warm catalog cache cannot retain access after a team/account change.
        await db.doc('workers/leader-worker').update({ teamId: 'team-b' });
        assert.deepEqual((await call('companies')).rows.map((row: any) => row.id), ['company-b']);
        await db.doc('workers/leader-worker').update({ isActive: false });
        await assert.rejects(call('companies'), (error: any) => error.code === 'permission-denied');
        await db.doc('workers/leader-worker').update({ isActive: true, status: '퇴사' });
        await assert.rejects(call('workers'), (error: any) => error.code === 'permission-denied');
        await db.doc('workers/leader-worker').update({ status: '재직', role: '작업자' });
        await db.doc('settings/menus_v12').set({ admin: { positionConfig: [{ id: 'dynamic-leader', name: '팀장' }] } });
        await db.doc('users/leader').update({ position: 'pos_dynamic-leader' });
        assert.deepEqual((await call('teams')).rows.map((row: any) => row.id), ['team-b']);
        await db.doc('users/leader').update({ status: 'suspended' });
        await assert.rejects(call('companies'), (error: any) => error.code === 'permission-denied');
        for (const uid of ['pending', 'unlinked', 'missing']) {
            await assert.rejects(call('workers', uid), (error: any) => error.code === 'permission-denied');
        }
        await assert.rejects(call('users'), (error: any) => error.code === 'invalid-argument');
    } finally {
        await Promise.all([...Object.keys(fixtures), 'settings/menus_v12'].map(path => db.doc(path).delete()));
        await app.delete();
    }
});
