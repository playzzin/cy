import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { handleTeamAdvanceRequest } from './teamAdvanceRequests';
import { handleTeamOffDutyRequest } from './teamOffDutyRequests';
import { filterTeamRows } from './teamReadPolicy';

test('대리 신청은 현재 소속 팀원만 허용하고 휴무 문서의 다른 팀 기록을 보존한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-worker-delegation');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const db = app.firestore();
    const context = { auth: { uid: 'leader', token: {} } } as any;
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const date = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
    const dateRef = db.doc(`field_schedule_requests/${date}___date_off_duty__`);
    const advance = (workerId: string, requestId: string) => handleTeamAdvanceRequest({ action: 'create', workerId, requestId, yearMonth: today.slice(0, 7), requestedAmount: 10000 }, context);
    const offDuty = (workerId: string, action = 'add') => handleTeamOffDutyRequest({ action, date, workerIds: [workerId], memo: 'fixture' }, context);
    try {
        const data: Record<string, any> = {
            'users/leader': { status: 'active', role: '팀장', linkedWorkerIds: ['anchor'], displayName: '신청자' },
            'workers/anchor': { isActive: true, teamId: 'legacy-team-a' },
            'teams/team-a': { legacyId: 'legacy-team-a', isActive: true },
            'teams/team-b': { isActive: true },
            'workers/member': { isActive: true, teamId: 'team-a', name: '대상자' },
            'workers/other': { isActive: true, teamId: 'team-b', name: '다른팀' },
            'daily_reports/fixture': { date: `${today.slice(0, 7)}-01`, workers: [{ workerId: 'member', manDay: 2, unitPrice: 100000 }] },
        };
        await Promise.all(Object.entries(data).map(([path, value]) => db.doc(path).set(value)));
        await dateRef.set({ date, siteId: '__date_off_duty__', offDutyWorkerIds: ['other'], offDutyWorkerNames: ['다른팀'], memo: 'other memo', offDutyRequestActors: { other: { requesterUid: 'other-user' } } });
        await assert.rejects(advance('other', 'denied'), (e: any) => e.code === 'permission-denied');
        await assert.rejects(offDuty('other'), (e: any) => e.code === 'permission-denied');
        const result = await advance('member', 'allowed');
        assert.equal((await db.doc(`advance_requests/${result.id}`).get()).data()?.requesterUid, 'leader');
        await offDuty('member');
        const saved = (await dateRef.get()).data()!;
        assert.deepEqual(saved.offDutyWorkerIds, ['other', 'member']);
        assert.equal(saved.offDutyRequestActors.member.requesterUid, 'leader');
        const visible = filterTeamRows('field_schedule_requests', [{ ...saved, id: dateRef.id }], { teamIds: ['team-a'], workerIds: ['member'], siteIds: [] });
        assert.deepEqual(Object.keys(visible[0].offDutyRequestActors), ['member']);
        await offDuty('member', 'remove');
        assert.deepEqual((await dateRef.get()).data()?.offDutyWorkerIds, ['other']);
        await db.doc('workers/member').update({ teamId: 'team-b' });
        await assert.rejects(advance('member', 'transferred'), (e: any) => e.code === 'permission-denied');
        await assert.rejects(offDuty('member'), (e: any) => e.code === 'permission-denied');
        await db.doc('workers/member').update({ teamId: 'team-a' });
        await db.doc('users/leader').update({ role: 'user' });
        await assert.rejects(advance('member', 'not-leader'), (e: any) => e.code === 'permission-denied');
        await assert.rejects(offDuty('member'), (e: any) => e.code === 'permission-denied');
        await db.doc('users/leader').update({ role: '팀장', status: 'inactive' });
        await assert.rejects(offDuty('member'), (e: any) => e.code === 'permission-denied');
    } finally {
        // The guarded demo project contains only fixtures from this test.
        for (const name of ['users', 'workers', 'teams', 'daily_reports', 'field_schedule_requests', 'advance_requests', 'server_settings']) {
            const rows = await db.collection(name).get();
            await Promise.all(rows.docs.map(row => row.ref.delete()));
        }
        await app.delete();
    }
});
