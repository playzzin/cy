import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { handleTeamExpenseRequest, validateExpenseReceipt } from './teamExpenseRequests';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
const rejected = (code: string) => (error: any) => error.code === code;
test('영수증 파일의 크기와 실제 형식을 검증한다', () => {
    assert.ok(validateExpenseReceipt('image/png', png).length > 0);
    assert.throws(() => validateExpenseReceipt('image/jpeg', png), rejected('invalid-argument'));
    assert.throws(() => validateExpenseReceipt('text/html', Buffer.from('<html>secret</html>').toString('base64')), rejected('invalid-argument'));
    assert.throws(() => validateExpenseReceipt('image/png', 'A'.repeat(7 * 1024 * 1024)), rejected('invalid-argument'));
});
test('미인증 요청은 DB에 접근하기 전에 거부한다', async () => {
    await assert.rejects(handleTeamExpenseRequest({ action: 'list' }, {} as any), rejected('unauthenticated'));
});

test('제출·영수증 불변성·권한·승인 원자성·반려를 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST }, async () => {
    const projectId = 'demo-team-expense-request';
    const app = admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
    const db = app.firestore();
    const fixtures = {
        'users/leader-a': { status: 'active', role: 'user', position: 'team-position', linkedWorkerIds: ['worker-a'], name: '팀장 A' },
        'users/leader-b': { status: 'active', role: 'user', position: '팀장', linkedWorkerIds: ['worker-b'] },
        'users/office': { status: 'active', role: 'user', position: 'office-position', name: '사무실 직원' },
        'users/stranger': { status: 'active', role: 'user' },
        'users/suspended': { status: 'suspended', role: 'admin' },
        'settings/menus_v12': { admin: { positionConfig: [{ id: 'team-position', name: '팀장' }, { id: 'office-position', name: '사무실' }] } },
        'workers/worker-a': { teamId: 'legacy-a', role: '팀장' },
        'workers/worker-b': { teamId: 'team-b', role: '팀장' },
        'teams/team-a': { name: 'A팀', legacyId: 'legacy-a', color: '#f00', iconKey: 'fa-helmet-safety', accountNumber: 'private-field' },
        'teams/team-b': { name: 'B팀', color: '#2563eb', icon: 'fa-truck-front', accountNumber: 'private-field' },
    };
    const call = (uid: string, data: any): Promise<any> => handleTeamExpenseRequest(data, { auth: { uid, token: { role: 'admin' } } } as any);
    const input = { requestId: 'request-one', teamId: 'team-a', chargeToTeamId: 'team-b', date: '2026-09-20', category: 'meal', description: '테스트 식대', amount: 25000, paymentMethod: '현찰', memo: '', receiptIds: ['receipt-one'] };
    const upload = { action: 'upload', requestId: input.requestId, teamId: input.teamId, receiptId: 'receipt-one', name: 'receipt.png', contentType: 'image/png', base64: png };
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, value]) => batch.set(db.doc(path), value));
        await batch.commit();
        const list = await call('leader-a', { action: 'list', yearMonth: '2026-09', includeBillingTeams: true });
        assert.deepEqual(list.payerTeams, [{ id: 'team-a', name: 'A팀', color: '#ff0000', icon: 'fa-helmet-safety' }]);
        assert.deepEqual(list.teams, [{ id: 'team-a', name: 'A팀', color: '#ff0000', icon: 'fa-helmet-safety' }, { id: 'team-b', name: 'B팀', color: '#2563eb', icon: 'fa-truck-front' }]);
        assert.equal(list.canReview, false); // Forged token role must not grant approval.
        assert.deepEqual((await call('leader-a', { action: 'list', yearMonth: '2026-09' })).teams, list.payerTeams);
        await assert.rejects(call('stranger', { action: 'list', yearMonth: '2026-09' }), rejected('permission-denied'));
        await assert.rejects(call('suspended', { action: 'list', yearMonth: '2026-09' }), rejected('permission-denied'));
        await assert.rejects(call('leader-a', { ...upload, teamId: 'team-b' }), rejected('permission-denied'));
        await assert.rejects(call('leader-a', { action: 'submit', ...input }), rejected('failed-precondition'));
        for (const amount of [true, [1], { value: 1 }, '1e3']) await assert.rejects(call('leader-a', { action: 'submit', ...input, amount }), rejected('invalid-argument'));
        await assert.rejects(call('leader-a', { action: 'analyze', teamId: 'team-b', contentType: 'image/png', base64: png }), rejected('permission-denied'));
        await assert.rejects(call('leader-a', { action: 'analyze', teamId: 'team-a', contentType: 'text/html', base64: png }), rejected('invalid-argument'));
        const analysisInput = { action: 'analyze', teamId: 'team-a', contentType: 'image/png', base64: png };
        const usage = db.doc(`server_settings/receipt-analysis-${createHash('sha256').update('leader-a').digest('hex')}`);
        const originalFetch = global.fetch;
        try {
            await db.doc('server_settings/ai').set({ apiKey: 'local-test-key', documentModel: 'gemini-2.5-flash' });
            await usage.delete();
            global.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ isReceipt: true, receiptCount: 1, isCancelled: false, date: '2026-09-20', amount: 12000, currency: 'KRW', paymentMethod: '현찰', category: 'meal', warnings: [] }) }] } }] }) })) as any;
            const analysis = await call('leader-a', analysisInput);
            assert.equal(analysis.amount, 12000);
            assert.equal((await db.collection('team_expense_requests').get()).size, 0);
            assert.equal((await usage.get()).data()!.dayCount, 1);
            await usage.set({ day: Math.floor(Date.now() / 86_400_000), dayCount: 100 });
            await assert.rejects(call('leader-a', analysisInput), rejected('resource-exhausted'));
        } finally {
            global.fetch = originalFetch;
            await usage.delete();
            await db.doc('server_settings/ai').delete();
        }
        const first = await call('leader-a', upload);
        assert.equal(first.receipt.url, '');
        const [metadata] = await app.storage().bucket().file(first.receipt.fullPath).getMetadata();
        assert.ok(!metadata.metadata?.firebaseStorageDownloadTokens);
        const requestDocumentId = first.receipt.fullPath.split('/')[2];
        const receipt = await call('leader-a', { action: 'receipt', id: requestDocumentId, receiptId: 'receipt-one' });
        assert.equal(receipt.base64, png);
        await assert.rejects(call('leader-b', { action: 'receipt', id: requestDocumentId, receiptId: 'receipt-one' }), rejected('permission-denied'));
        assert.equal((await call('leader-a', upload)).receipt.url, first.receipt.url);
        await assert.rejects(call('leader-a', { action: 'submit', ...input, teamId: 'team-b' }), rejected('permission-denied'));
        await assert.rejects(call('leader-a', { action: 'submit', ...input, chargeToTeamId: 'missing-team' }), rejected('invalid-argument'));
        await assert.rejects(call('leader-a', { ...upload, base64: Buffer.concat([Buffer.from(png, 'base64'), Buffer.from('changed')]).toString('base64') }), rejected('already-exists'));
        const submitted = await call('leader-a', { action: 'submit', ...input, status: 'approved', claimId: 'forged' });
        assert.equal(submitted.status, 'pending');
        const stored = (await db.collection('team_expense_requests').doc(submitted.id).get()).data()!;
        assert.equal(stored.teamColor, '#ff0000');
        assert.equal(stored.teamIcon, 'fa-helmet-safety');
        assert.equal(stored.chargeToTeamIcon, 'fa-truck-front');
        assert.equal(stored.chargeToTeamName, 'B팀');
        assert.equal(stored.chargeToTeamColor, '#2563eb');
        assert.equal((await db.collection('team_expense_claims').get()).size, 0);
        assert.equal((await call('leader-a', { action: 'submit', ...input })).id, submitted.id);
        await assert.rejects(call('leader-a', { action: 'submit', ...input, amount: 999 }), rejected('failed-precondition'));
        await assert.rejects(call('leader-a', { action: 'submit', ...input, chargeToTeamId: 'team-a' }), rejected('failed-precondition'));
        // A lost submit response can safely retry the complete upload/submit flow.
        assert.equal((await call('leader-a', upload)).receipt.url, first.receipt.url);
        assert.equal((await call('leader-a', { action: 'submit', ...input })).id, submitted.id);
        await assert.rejects(call('leader-a', { ...upload, receiptId: 'new-after-submit' }), rejected('failed-precondition'));
        await assert.rejects(call('leader-a', { ...upload, base64: Buffer.concat([Buffer.from(png, 'base64'), Buffer.from('changed')]).toString('base64') }), rejected('already-exists'));
        assert.equal((await call('leader-b', { action: 'list', yearMonth: '2026-09' })).requests.length, 0);
        assert.equal((await call('office', { action: 'list', yearMonth: '2026-09' })).requests.length, 1);
        await assert.rejects(call('leader-a', { action: 'review', id: submitted.id, decision: 'approved' }), rejected('permission-denied'));
        await Promise.all([1, 2].map(() => call('office', { action: 'review', id: submitted.id, decision: 'approved' })));
        const claims = await db.collection('team_expense_claims').get();
        assert.equal(claims.size, 1);
        assert.equal(claims.docs[0].data().status, 'charged');
        assert.equal(claims.docs[0].data().amount, 25000);
        assert.equal(claims.docs[0].data().claimType, 'teamCharge');
        assert.equal(claims.docs[0].data().payerTeamId, 'team-a');
        assert.equal(claims.docs[0].data().chargeToTeamId, 'team-b'); // A receives the refund; B bears the expense.
        assert.equal(claims.docs[0].data().sourceRequestId, submitted.id);
        assert.equal(claims.docs[0].data().attachments.length, 1);
        await assert.rejects(call('office', { action: 'review', id: submitted.id, decision: 'rejected', reason: '늦은 반려' }), rejected('failed-precondition'));
        await call('leader-a', { ...upload, requestId: 'rejected-one' });
        const second = await call('leader-a', { action: 'submit', ...input, requestId: 'rejected-one' });
        await assert.rejects(call('office', { action: 'review', id: second.id, decision: 'rejected' }), rejected('invalid-argument'));
        await call('office', { action: 'review', id: second.id, decision: 'rejected', reason: '영수증 금액을 확인해 주세요.' });
        assert.equal((await db.collection('team_expense_claims').get()).size, 1);
        assert.equal((await call('leader-a', { action: 'list', yearMonth: '2026-09' })).requests.find((row: any) => row.id === second.id).reviewReason, '영수증 금액을 확인해 주세요.');
        // Existing pending requests had one team; preserve their accounting.
        const { chargeToTeamId, chargeToTeamName, chargeToTeamColor, ...oldRequest } = stored;
        await db.doc('team_expense_requests/legacy-pending').set(oldRequest);
        await call('office', { action: 'review', id: 'legacy-pending', decision: 'approved' });
        const legacyClaim = (await db.doc('team_expense_claims/team-request-legacy-pending').get()).data()!;
        assert.equal(legacyClaim.payerTeamId, 'team-a');
        assert.equal(legacyClaim.chargeToTeamId, 'team-a');
        // A leader's historical requests and abandoned uploads must not consume
        // the selected month's 2,000-row limit.
        for (let offset = 0; offset < 2001; offset += 450) {
            const history = db.batch();
            for (let index = offset; index < Math.min(offset + 450, 2001); index++) {
                history.set(db.collection('team_expense_requests').doc(`history-${index}`), {
                    ownerUid: 'leader-a', yearMonth: '2026-08', status: 'rejected', createdAt: '2026-08-01'
                });
            }
            await history.commit();
        }
        await db.doc('team_expense_requests/missing-created-at').set({ ownerUid: 'leader-a', yearMonth: '2026-09', status: 'pending', submittedAt: '2026-09-30' });
        const monthly = await call('leader-a', { action: 'list', yearMonth: '2026-09' });
        assert.equal(monthly.requests.length, 4);
        assert.equal(monthly.requests[0].id, 'missing-created-at');
        assert.ok(monthly.requests.every((row: any) => row.yearMonth === '2026-09'));
        for (let index = 0; index < 5; index++) await call('leader-a', { ...upload, requestId: 'limit-test', receiptId: `receipt-${index}` });
        await assert.rejects(call('leader-a', { ...upload, requestId: 'limit-test', receiptId: 'receipt-six' }), rejected('resource-exhausted'));
        await db.doc('team_expense_claims/team-request-legacy-pending').delete();
        await assert.rejects(call('office', { action: 'review', id: 'legacy-pending', decision: 'approved' }), rejected('failed-precondition'));
        await db.doc('team_expense_requests/deleted-team').set({ ...stored, chargeToTeamId: 'missing-team' });
        await assert.rejects(call('office', { action: 'review', id: 'deleted-team', decision: 'approved' }), rejected('failed-precondition'));
        assert.equal((await db.doc('team_expense_claims/team-request-deleted-team').get()).exists, false);
        await db.doc('workers/worker-a').update({ isActive: false });
        await assert.rejects(call('leader-a', { ...upload, requestId: 'inactive-worker' }), rejected('permission-denied'));
        await db.doc('users/leader-a').update({ position: '사무실' });
        await assert.rejects(call('leader-a', { action: 'review', id: submitted.id, decision: 'approved' }), rejected('permission-denied'));
    } finally {
        await db.recursiveDelete(db.collection('team_expense_requests'));
        await db.recursiveDelete(db.collection('team_expense_claims'));
        await app.storage().bucket().deleteFiles({ prefix: 'team-expense-receipts/' });
        await app.delete();
    }
});
