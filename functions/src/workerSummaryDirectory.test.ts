import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { summaryDirectoryTeams } from './workerSummaryDirectory';
import { getTeamScopedData } from './teamScopedRead';

test('명단 팀 범위는 서버의 회사 연결로 결정하고 회사 미지정·외부회사·비활성 팀은 넓히지 않는다', () => {
    const teams = [
        { id: 'a', companyId: 'cy' }, { id: 'b', companyId: 'legacy-cy' },
        { id: 'c', companyName: '(주)청연이엔지' }, { id: 'none' },
        { id: 'external', companyId: 'outside', companyName: '청연' },
        { id: 'inactive', companyId: 'cy', isActive: false },
    ];
    const companies = [{ id: 'cy', legacyId: 'legacy-cy', name: '청연이엔지' }, { id: 'outside', name: '외부회사' }];
    assert.deepEqual(summaryDirectoryTeams(teams, companies, [teams[0]]).map(team => team.id), ['a', 'b', 'c']);
    assert.deepEqual(summaryDirectoryTeams(teams, companies, [teams[3]]).map(team => team.id), ['none']);
    assert.deepEqual(summaryDirectoryTeams(teams, companies, [teams[4]]).map(team => team.id), ['external']);
});

test('팀장 명단은 같은 회사 여러 팀을 포함하지만 급여·타팀 사진·외부회사와 일반 작업자 접근은 제외한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-worker-summary-directory' });
    const db = app.firestore();
    const fixtures: Record<string, unknown> = {
        'users/leader': { status: 'active', position: '팀장', linkedWorkerIds: ['leader'] },
        'users/pending': { status: 'pending', position: '팀장', linkedWorkerIds: ['leader'] },
        'users/unlinked': { status: 'active', position: '팀장' },
        'users/worker': { status: 'active', accountType: 'worker', linkedWorkerIds: ['leader'] },
        'companies/cy': { name: '청연이엔지', legacyId: 'legacy-cy' },
        'companies/external': { name: '외부회사' },
        'teams/a': { name: '내팀', legacyId: 'legacy-a', companyId: 'cy', privateNote: 'secret' },
        'teams/b': { name: '다른내부팀', companyId: 'legacy-cy' },
        'teams/c': { name: '외부팀', companyId: 'external' },
        'workers/leader': { name: '가상팀장', teamId: 'a', role: '팀장' },
        'workers/own': { name: '가상작업자', teamId: 'legacy-a', fileNameSaved: 'own-id', bankPhotoId: 'own-bank', directPayBankPhotoId: 'own-direct-bank', salary: 111 },
        'workers/other': { name: '가상다른팀', teamId: 'b', idNumber: 'synthetic-id', contact: 'synthetic-phone', address: '가상주소', bloodType: 'A', fileNameSaved: 'private-id', bankPhotoId: 'private-bank', directPayBankPhotoId: 'private-direct-bank', salary: 999, bankAccount: 'private-account', notes: 'secret' },
        'workers/retired': { name: '가상퇴사', teamId: 'b', status: '퇴사' },
        'workers/inactive': { name: '가상비활성', teamId: 'b', isActive: false },
        'workers/external': { name: '가상외부', teamId: 'c' },
        'workers/unassigned': { name: '가상미배정' },
    };
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, value]) => batch.set(db.doc(path), value as any));
        await batch.commit();
        const call = (collection: string, uid = 'leader') => getTeamScopedData.run({ collection, filters: { companyId: 'external', teamId: 'c' } }, { auth: { uid, token: {} } } as any);
        const directory = (await call('worker_summary_directory')).rows[0];
        assert.deepEqual(directory.teams.map((team: any) => team.id), ['a', 'b']);
        assert.deepEqual(directory.workers.map((worker: any) => worker.id), ['leader', 'other', 'own']);
        assert.deepEqual(directory.documentWorkerIds, ['leader', 'own']);
        const other = directory.workers.find((worker: any) => worker.id === 'other');
        assert.deepEqual(other, { id: 'other', name: '가상다른팀', teamId: 'b', idNumber: 'synthetic-id', contact: 'synthetic-phone', address: '가상주소', bloodType: 'A' });
        assert.equal(directory.workers.find((worker: any) => worker.id === 'own').fileNameSaved, 'own-id');
        assert.equal(directory.workers.find((worker: any) => worker.id === 'own').directPayBankPhotoId, 'own-direct-bank');
        assert.equal(JSON.stringify(directory).includes('private-direct-bank'), false);
        assert.equal(JSON.stringify(directory).includes('secret'), false);
        assert.equal(JSON.stringify(directory).includes('salary'), false);
        assert.deepEqual((await call('workers')).rows.map((worker: any) => worker.id), ['leader', 'own']);
        for (const uid of ['pending', 'unlinked', 'missing', 'worker']) {
            await assert.rejects(call('worker_summary_directory', uid), (error: any) => error.code === 'permission-denied');
        }
        await db.doc('teams/b').update({ companyId: 'external' });
        assert.deepEqual((await call('worker_summary_directory')).rows[0].workers.map((worker: any) => worker.id), ['leader', 'own']);
        await db.doc('users/leader').update({ status: 'blocked' });
        await assert.rejects(call('worker_summary_directory'), (error: any) => error.code === 'permission-denied');
        await assert.rejects(getTeamScopedData.run({ collection: 'worker_summary_directory' }, {} as any), (error: any) => error.code === 'unauthenticated');
    } finally {
        await Promise.all(Object.keys(fixtures).map(path => db.doc(path).delete()));
        await app.delete();
    }
});
