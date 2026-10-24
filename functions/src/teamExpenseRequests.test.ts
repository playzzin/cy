import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { actorFor, handleTeamExpenseRequest, readTeamExpenseRequestList, validateExpenseReceipt } from './teamExpenseRequests';

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

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => { resolve = yes; });
    return { promise, resolve };
};
const document = (id: string, data: Record<string, unknown>) => ({ id, exists: true, data: () => data });

test('권한은 매번 최신 문서로 확인하고 직접 팀과 legacy 팀은 서로 기다리지 않고 조회한다', async () => {
    const direct = deferred<any[]>(), legacy = deferred<any>();
    const events: string[] = [], batches: string[][] = [], masks: string[][] = [];
    let active = true;
    const db = {
        doc: (path: string) => ({ path }),
        getAll: (...references: any[]) => {
            masks.push(references.pop().fieldMask);
            const paths = references.map(reference => reference.path);
            batches.push(paths);
            if (paths[0] === 'users/leader') return Promise.resolve([
                document('leader', { status: active ? 'active' : 'suspended', position: 'leader-position', linkedWorkerIds: ['worker'] }),
                document('menus_v12', { admin: { positionConfig: [{ id: 'leader-position', name: '팀장' }] } }),
            ]);
            if (paths[0] === 'workers/worker') return Promise.resolve([document('worker', { teamId: 'legacy-team' })]);
            events.push('direct');
            return direct.promise;
        },
        collection: (name: string) => ({
            doc: (id: string) => ({ path: `${name}/${id}` }),
            where: () => ({ select: (...fields: string[]) => { masks.push(fields); return { limit: () => ({ get: () => { events.push('legacy'); return legacy.promise; } }) }; } }),
        }),
    };
    const loading = actorFor('leader', db as any);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(batches[0], ['users/leader', 'settings/menus_v12']);
    assert.deepEqual(events, ['direct', 'legacy']);
    assert.deepEqual(masks, [
        ['status', 'role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions', 'linkedWorkerIds', 'name', 'displayName', 'admin.positionConfig'],
        ['isActive', 'status', 'role', 'teamId'],
        ['isActive', 'name', 'color', 'icon', 'iconKey'],
        ['isActive', 'name', 'color', 'icon', 'iconKey'],
    ]);
    direct.resolve([]);
    legacy.resolve({ docs: [document('team-a', { name: 'A팀', color: '#f00' })] });
    const actor = await loading;
    assert.equal(actor.canReview, false);
    assert.deepEqual(actor.teams, [{ id: 'team-a', name: 'A팀', color: '#ff0000', icon: 'fa-users' }]);
    active = false;
    await assert.rejects(actorFor('leader', db as any), rejected('permission-denied'));
    assert.equal(batches.filter(paths => paths[0] === 'users/leader').length, 2);
});

test('필드 제한 후에도 직책, 작업자 상태, 현재 소속팀을 기준으로 권한을 판정한다', async () => {
    const rows: Record<string, any> = {
        'users/leader': { status: 'active', displayName: '팀장', linkedWorkerIds: ['worker', 'retired', 'inactive'], contact: 'private' },
        'settings/menus_v12': { admin: { positionConfig: [{ id: 'office', name: '사무실' }], menu: ['unneeded'] } },
        'workers/worker': { role: '팀장', teamId: 'team', accountNumber: 'private' },
        'workers/retired': { role: '팀장', teamId: 'retired-team', status: '퇴사' },
        'workers/inactive': { role: '팀장', teamId: 'inactive-team', isActive: false },
        'teams/team': { name: '현재팀', color: '#abc', iconKey: 'fa-hard-hat', accountNumber: 'private' },
        'teams/retired-team': { name: '퇴사팀' },
        'teams/inactive-team': { name: '비활성 작업자 팀' },
    };
    const projected = (path: string, fields: string[]) => {
        const original = rows[path];
        const result: any = {};
        for (const field of fields) {
            const parts = field.split('.');
            const value = parts.reduce((data, part) => data?.[part], original);
            if (value === undefined) continue;
            let target = result;
            for (const part of parts.slice(0, -1)) target = target[part] ??= {};
            target[parts[parts.length - 1]] = value;
        }
        return { id: path.split('/')[1], exists: Boolean(original), data: () => original ? result : undefined };
    };
    const db = {
        doc: (path: string) => ({ path }),
        getAll: async (...args: any[]) => {
            const { fieldMask } = args.pop();
            return args.map(reference => projected(reference.path, fieldMask));
        },
        collection: (name: string) => ({
            doc: (id: string) => ({ path: name + '/' + id }),
            where: () => ({ select: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) }),
        }),
    };
    const actor = await actorFor('leader', db as any);
    assert.equal(actor.name, '팀장');
    assert.equal(actor.canReview, false);
    assert.deepEqual(actor.teams, [{ id: 'team', name: '현재팀', color: '#aabbcc', icon: 'fa-hard-hat' }]);
    rows['teams/team'].isActive = false;
    assert.deepEqual((await actorFor('leader', db as any)).teams, []);
    rows['workers/worker'].status = 'archived';
    await assert.rejects(actorFor('leader', db as any), rejected('permission-denied'));
    for (const field of ['role', 'position', 'systemRole', 'accountType', 'roles', 'additionalPositions']) {
        rows['users/leader'] = { status: 'active', [field]: field === 'roles' || field === 'additionalPositions' ? ['pos_office'] : 'pos_office' };
        assert.equal((await actorFor('leader', db as any)).canReview, true, field);
    }
    rows['users/leader'].status = 'suspended';
    await assert.rejects(actorFor('leader', db as any), rejected('permission-denied'));
});

test('목록·팀·경비 구분을 병렬 조회하면서 월과 소유자 범위를 유지한다', async () => {
    const pages = deferred<any>(), directory = deferred<any>(), categories = deferred<any>();
    const reads: string[] = [];
    const predicates: unknown[][] = [];
    const projections: string[][] = [];
    const limits: Array<[string, number]> = [];
    const sources = { team_expense_requests: pages, teams: directory, team_expense_categories: categories };
    const db = { collection: (name: keyof typeof sources) => {
        const query = {
            where: (...predicate: unknown[]) => { predicates.push(predicate); return query; },
            orderBy: () => query,
            limit: (limit: number) => { limits.push([name, limit]); return query; },
            select: (...fields: string[]) => { projections.push(fields); return query; },
            get: () => { reads.push(name); return sources[name].promise; },
        };
        return query;
    } };
    const actor = { uid: 'leader', name: '팀장', canReview: false, teams: [] };
    const loading = readTeamExpenseRequestList(db as any, actor, { yearMonth: '2026-09', includeBillingTeams: true });
    assert.deepEqual(reads, ['team_expense_requests', 'teams', 'team_expense_categories']);
    assert.deepEqual(predicates, [['ownerUid', '==', 'leader'], ['yearMonth', '==', '2026-09']]);
    assert.deepEqual(limits, [['team_expense_requests', 101], ['teams', 1001]]);
    assert.deepEqual(projections, [['name', 'color', 'icon', 'iconKey'], ['isActive', 'scope', 'label']]);
    pages.resolve({ size: 4, docs: [
        document('request', { yearMonth: '2026-09', status: 'pending', createdAt: '2026-09-20' }),
        document('without-created-at', { yearMonth: '2026-09', status: 'pending', submittedAt: '2026-09-30' }),
        document('draft', { yearMonth: '2026-09', status: 'draft' }),
        document('other-month', { yearMonth: '2026-08', status: 'approved' }),
    ] });
    directory.resolve({ size: 1, docs: [document('team', { name: '팀', accountNumber: 'private' })] });
    categories.resolve({ docs: [document('meal', { isActive: false })] });
    const result = await loading;
    assert.deepEqual(result.requests.map(row => row.id), ['without-created-at', 'request']);
    assert.equal(result.nextCursor, null);
    assert.equal(result.categories.some(category => category.id === 'meal'), false);
    assert.deepEqual(result.teams, [{ id: 'team', name: '팀', color: '#64748b', icon: 'fa-users' }]);
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
        // The expense month is fixed, but real submissions use the test run's
        // current timestamp. Keep this newest-row fixture newer than those
        // submissions, including when the test runs after September 2026.
        const existingMonthly = await call('leader-a', { action: 'list', yearMonth: '2026-09' });
        const newestSubmittedAt = Math.max(...existingMonthly.requests.map((row: any) => Date.parse(row.submittedAt || row.createdAt)));
        assert.ok(Number.isFinite(newestSubmittedAt));
        await db.doc('team_expense_requests/missing-created-at').set({ ownerUid: 'leader-a', yearMonth: '2026-09', status: 'pending', submittedAt: new Date(newestSubmittedAt + 1).toISOString() });
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
        await db.doc('cards/expense-card').set({ name: '현장 경비', issuer: '테스트카드', last4: '1234', currentAssigneeId: 'legacy-a', currentAssigneeType: 'TEAM', status: 'ASSIGNED' });
        const withCards = await call('leader-a', { action: 'list', yearMonth: '2026-09', includePaymentCards: true });
        assert.deepEqual(withCards.paymentCards, [{ id: 'expense-card', label: '현장 경비 · 테스트카드 · •••• 1234', teamId: 'team-a' }]);
        assert.deepEqual((await call('leader-b', { action: 'list', yearMonth: '2026-09', includePaymentCards: true })).paymentCards, []);
        await call('leader-a', { ...upload, requestId: 'card-payment' });
        const cardInput = { ...input, requestId: 'card-payment', paymentCardId: 'expense-card', paymentMethod: '위조된 카드명' };
        await db.doc('cards/expense-card').update({ status: 'SUSPENDED' });
        await assert.rejects(call('leader-a', { action: 'submit', ...cardInput }), rejected('failed-precondition'));
        await db.doc('cards/expense-card').update({ status: 'ASSIGNED', currentAssigneeId: 'team-b' });
        await assert.rejects(call('leader-a', { action: 'submit', ...cardInput }), rejected('failed-precondition'));
        await db.doc('cards/expense-card').update({ currentAssigneeId: 'legacy-a' });
        const cardSubmitted = await call('leader-a', { action: 'submit', ...cardInput });
        const cardRequest = (await db.doc(`team_expense_requests/${cardSubmitted.id}`).get()).data()!;
        assert.equal(cardRequest.paymentCardId, 'expense-card');
        assert.equal(cardRequest.paymentMethod, withCards.paymentCards[0].label);
        await call('office', { action: 'review', id: cardSubmitted.id, decision: 'approved', reason: '' });
        assert.equal((await db.doc(`team_expense_claims/team-request-${cardSubmitted.id}`).get()).data()!.cardLabel, cardRequest.paymentMethod);
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
