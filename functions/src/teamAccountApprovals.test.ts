import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { eligibleTeamAccount, handleTeamAccountApprovals } from './teamAccountApprovals';

const link = { id: 'approval-link', uid: 'approval-member', accountType: 'worker', entityType: 'worker', entityId: 'approval-worker', status: 'pending' };
const worker = { name: '합성 작업자', role: '일반', teamId: 'approval-team', status: '재직', isActive: true };
const profile = { role: 'user', status: 'pending', requestedAccountType: 'worker', primaryLinkId: link.id };
test('팀원 계정 정책은 본인·타팀·특수권한·정지·퇴사·중복 연결을 거절한다', () => {
    const check = (l: any = link, w: any = worker, u: any = profile) => eligibleTeamAccount('approval-leader', ['approval-team'], l, w, u);
    assert.equal(check(), true);
    for (const patch of [{ uid: 'approval-leader' }, { entityType: 'office' }, { accountType: 'office' }, { status: 'rejected' }]) assert.equal(check({ ...link, ...patch }), false);
    for (const patch of [{ teamId: 'other' }, { role: '팀장' }, { isActive: false }, { status: '퇴사' }, { uid: 'somebody' }]) assert.equal(check(link, { ...worker, ...patch }), false);
    for (const patch of [{ status: 'suspended' }, { position: '관리자' }, { additionalPositions: ['office'] }, { linkedCompanyIds: ['company'] }, { linkedWorkerIds: ['somebody'] }, { requestedAccountType: 'office' }]) assert.equal(check(link, worker, { ...profile, ...patch }), false);
});

test('실제 트랜잭션: 선택 일부 실패, 동시 승인, 권한 회수, 이전 토큰, 페이지 이동, claims 재시도', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-team-worker-request');
    const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    const db = app.firestore();
    const paths: string[] = [];
    const put = async (path: string, data: any) => { paths.push(path); await db.doc(path).set(data); };
    const call = (input: any, uid = 'approval-leader') => handleTeamAccountApprovals(input, { auth: { uid, token: { role: 'admin', position: '팀장' } } } as any);
    try {
        await put('users/approval-leader', { role: 'user', position: '팀장', status: 'active', linkedWorkerIds: ['approval-anchor'] });
        await put('workers/approval-anchor', { uid: 'approval-leader', role: '팀장', teamId: 'approval-team', status: '재직' });
        await put('teams/approval-team', { name: '합성 팀', isActive: true });
        await put('users/approval-member', profile);
        // Imported/default position documents can omit their redundant `id` field.
        // An empty candidate position must not match every such privileged row.
        await put('positions/approval-manager-position', { name: '매니저1', systemRole: '매니저' });
        await put('workers/approval-worker', worker);
        await put(`account_links/${link.id}`, link);
        await put('workers/approval-outsider', { ...worker, teamId: 'other' });
        await put('users/approval-outside', { ...profile, primaryLinkId: 'approval-outside-link' });
        await put('account_links/approval-outside-link', { ...link, id: 'approval-outside-link', entityId: 'approval-outsider', uid: 'approval-outside' });
        const pending = await call({ action: 'list' });
        assert.deepEqual((pending as any).rows.map((row: any) => row.linkId), [link.id]);
        assert.equal(JSON.stringify(pending).includes('approval-outside'), false);
        const outcomes = await Promise.all([call({ action: 'approve', linkIds: [link.id, 'approval-outside-link'] }), call({ action: 'approve', linkIds: [link.id] })]);
        assert.equal((outcomes[0] as any).results[0].status, 'active');
        assert.equal((outcomes[0] as any).results[1].status, 'failed');
        assert.equal((outcomes[1] as any).results[0].status, 'active');
        assert.equal((outcomes[0] as any).results[0].claimsPending, true); // No Auth user yet: recoverable claims failure.
        assert.equal((await db.doc('users/approval-member').get()).data()?.status, 'active');
        assert.equal((await db.doc('users/approval-outside').get()).data()?.status, 'pending');
        assert.equal((await db.collection('audit_logs').where('linkId', '==', link.id).get()).size, 1);
        const { getMyAccountLinkStatus } = await import('./accountAccess');
        // There is still no Auth user: an attempted preview claim write would fail.
        const preview = await getMyAccountLinkStatus.run({ refreshAccessClaims: true }, { auth: {
            uid: 'cy-preview-approval-test', token: { devPreview: true, previewActorUid: 'approval-leader',
                previewTargetUid: 'approval-member', previewExpiresAt: Date.now() / 1000 + 600, previewDevRole: 'DEV' },
        } } as any);
        assert.equal(preview.user.status, 'active');
        await app.auth().createUser({ uid: 'approval-member', email: 'approval-member@example.test', password: 'Emulator-only-password-123!' });
        const self = await getMyAccountLinkStatus.run({ refreshAccessClaims: true, uid: 'approval-leader', role: 'admin' }, { auth: { uid: 'approval-member', token: {} } } as any);
        assert.equal(self.user.status, 'active');
        assert.equal(self.user.requestedAccountType, null);
        assert.equal(self.links.find((entry: any) => entry.id === link.id)?.status, 'active');
        const claims = (await app.auth().getUser('approval-member')).customClaims;
        assert.equal(claims?.accountType, 'worker');
        assert.deepEqual(claims?.erpRoleGroups, ['user']);
        // Password login twice represents a fresh session; approval is not reset by login.
        for (let login = 0; login < 2; login++) {
            const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email: 'approval-member@example.test', password: 'Emulator-only-password-123!', returnSecureToken: true }),
            });
            const signedIn = await response.json() as any;
            assert.equal(response.ok, true);
            assert.equal(signedIn.localId, 'approval-member');
            assert.equal(JSON.parse(Buffer.from(signedIn.idToken.split('.')[1], 'base64url').toString()).accountType, 'worker');
            assert.equal((await db.doc('users/approval-member').get()).data()?.status, 'active');
        }
        const replay = await call({ action: 'approve', linkIds: [link.id] });
        assert.equal((replay as any).results[0].reused, true);
        assert.equal((replay as any).results[0].claimsPending, false);
        assert.equal((await app.auth().getUser('approval-member')).customClaims?.accountType, 'worker');
        await db.doc('workers/approval-worker').update({ teamId: 'other' });
        assert.equal((await call({ action: 'approve', linkIds: [link.id] }) as any).results[0].status, 'failed');
        await db.doc('workers/approval-worker').update({ teamId: 'approval-team' });
        await db.doc('users/approval-leader').update({ position: '일반' });
        await assert.rejects(call({ action: 'list' }), (error: any) => error.code === 'permission-denied');
        assert.equal((await call({ action: 'approve', linkIds: [link.id] }) as any).results[0].status, 'failed');
        await db.doc('users/approval-leader').update({ position: '팀장' });
        await db.doc('workers/approval-anchor').update({ role: '일반' });
        await assert.rejects(call({ action: 'list' }), (error: any) => error.code === 'permission-denied');
        await db.doc('workers/approval-anchor').update({ role: '팀장' });
        await put('settings/user_menu_positions', { data: JSON.stringify({ 'approval-member': ['admin'] }) });
        assert.equal((await call({ action: 'approve', linkIds: [link.id] }) as any).results[0].status, 'failed');
        await db.doc('settings/user_menu_positions').delete();
        await put('positions/approval-worker-position', { name: '일반', systemRole: '관리자' });
        assert.equal((await call({ action: 'approve', linkIds: [link.id] }) as any).results[0].status, 'failed');
        await db.doc('positions/approval-worker-position').delete();
        for (let i = 0; i < 51; i++) await put(`workers/approval-page-${String(i).padStart(2, '0')}`, { ...worker });
        const first: any = await call({ action: 'list' });
        assert.ok(first.nextCursor);
        const second: any = await call({ action: 'list', cursor: first.nextCursor });
        assert.equal(second.nextCursor, null);
        assert.deepEqual([...first.rows, ...second.rows].map(row => row.linkId), [link.id]);
    } finally {
        await Promise.all(paths.map(path => db.doc(path).delete()));
        const audits = await db.collection('audit_logs').where('linkId', '==', link.id).get();
        await Promise.all(audits.docs.map(doc => doc.ref.delete()));
        await app.auth().deleteUser('approval-member').catch(() => undefined);
        await app.delete();
    }
});
