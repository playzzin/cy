import { strict as assert } from 'assert';
import { test } from 'node:test';
import * as admin from 'firebase-admin';
import { getTeamAccommodationBoardData as load, saveTeamAccommodationBoardData as save, validateAccommodationChanges, validateAccommodationRoomChanges, accommodationCompanyTeams } from './teamAccommodationBoard';
import { permitsPreviewCall } from './devPreviewPolicy';

const context = (uid = 'housing-leader') => ({ auth: { uid, token: { role: 'admin' } } } as any);
test('청연 소속은 회사 현재·레거시 ID를 우선하고 미소속·유사명·외부 회사는 제외한다', () => {
    const companies = [
        { id: 'cy', legacyId: 'old-cy', name: '주식회사 청연이엔지', code: 'C1' },
        { id: 'external', name: '다른 회사', code: 'C2' },
        { id: 'code-cy', name: '등록 회사', code: 'CYENG' },
    ];
    const teams = [
        { id: 'current', companyId: 'cy' }, { id: 'legacy', companyId: 'old-cy' },
        { id: 'by-code', companyId: 'code-cy' }, { id: 'name-only', companyName: '㈜ 청연 ENG' },
        { id: 'stale-name', companyId: 'external', companyName: '청연이엔지' },
        { id: 'similar-name', companyName: '청연이엔지협력사' }, { id: 'unassigned' },
    ];
    assert.deepEqual(accommodationCompanyTeams(teams, companies).map(team => team.id), ['current', 'legacy', 'by-code', 'name-only']);
    assert.deepEqual(accommodationCompanyTeams([{ id: 'unassigned' }], []), []);
});
test('숙소 배정은 비로그인·미리보기 저장·잘못된 변경을 거부한다', async () => {
    await assert.rejects(load({}, {} as any), (error: any) => error.code === 'unauthenticated');
    await assert.rejects(save({}, context('cy-preview-test')), (error: any) => error.code === 'permission-denied');
    for (const changes of [[], [{ workerId: '../other', accommodationId: null }], [{ workerId: 'w', accommodationId: undefined }],
        [{ workerId: 'w', accommodationId: null }, { workerId: 'w', accommodationId: 'a' }]]) {
        assert.throws(() => validateAccommodationChanges({ teamId: 'team-a', revision: 'a'.repeat(64), changes }), (error: any) => error.code === 'invalid-argument');
    }
    assert.equal(permitsPreviewCall('getTeamAccommodationBoard', {}), true);
    assert.equal(permitsPreviewCall('saveTeamAccommodationBoard', {}), false);
});

test('방 설정은 중복 없는 숙소 ID와 정수 또는 미설정만 허용한다', () => {
    const setting = { accommodationId: 'room', roomCount: 2, maxOccupants: null };
    const payload = { teamId: 'team-a', revision: 'a'.repeat(64), changes: [], roomChanges: [setting] };
    assert.deepEqual(validateAccommodationChanges(payload), []);
    assert.deepEqual(validateAccommodationRoomChanges(payload), [setting]);
    assert.deepEqual(validateAccommodationRoomChanges({}), []);
    for (const roomChanges of [null, 'invalid', [setting, setting], [{ ...setting, accommodationId: '../room' }],
        ...[0, -1, 1.5, 1000, '2', undefined].flatMap(value => [[{ ...setting, roomCount: value }], [{ ...setting, maxOccupants: value }]])]) {
        assert.throws(() => validateAccommodationRoomChanges({ roomChanges }), (error: any) => error.code === 'invalid-argument');
    }
});

test('공유 숙소 정원·설정 변경·동시 입실은 같은 트랜잭션으로 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-team-accommodation' });
    const db = app.firestore();
    const fixtures = {
        'companies/cy': { name: '청연이엔지' },
        'teams/a': { name: '가 팀', companyId: 'cy' },
        'teams/b': { name: '나 팀', companyId: 'cy' },
        'users/a': { status: 'active', position: '팀장', linkedWorkerIds: ['a'] },
        'users/b': { status: 'active', position: '팀장', linkedWorkerIds: ['b'] },
        'workers/a': { name: '가 작업자', teamId: 'a' },
        'workers/b': { name: '나 작업자', teamId: 'b' },
        'accommodations/shared': { name: '공유 숙소', type: 'TwoRoom', ownership: 'Cheongyeon', maxOccupants: 2, status: 'active', contract: { memo: '보존' } },
        'accommodations/private': { name: '개인방', type: 'OneRoom', ownership: 'Individual', status: 'active' },
        'accommodationAssignments/a': { source: 'team', teamId: 'a', accommodationId: 'shared', status: 'active' },
        'accommodationAssignments/b': { source: 'team', teamId: 'b', accommodationId: 'shared', status: 'active' },
        'accommodationAssignments/private': { source: 'team', teamId: 'a', accommodationId: 'private', status: 'active' },
        'accommodationAssignments/outside': { source: 'worker', workerId: 'outside', teamId: 'outside', accommodationId: 'shared', status: 'active' },
    };
    const read = (uid: string) => load({ teamId: uid }, context(uid));
    const setting = (roomCount: number | null, maxOccupants: number | null) => ({ accommodationId: 'shared', roomCount, maxOccupants });
    try {
        const batch = db.batch();
        Object.entries(fixtures).forEach(([path, value]) => batch.set(db.doc(path), value));
        await batch.commit();
        let a = await read('a');
        const shared = a.rooms.find(room => room.id === 'shared')!;
        assert.equal(shared.roomCount, 2, '기존 투룸은 방 개수 2를 표시한다');
        assert.equal(shared.totalOccupants, 1, '현재 조회 범위 밖의 입실 인원도 포함한다');
        assert.equal(shared.ownership, 'Cheongyeon');
        assert.equal(a.rooms.find(room => room.id === 'private')?.ownership, 'Individual');
        assert.equal(a.rooms.find(room => room.id === 'private')?.maxOccupants, null, '미등록 정원을 임의로 추정하지 않는다');
        assert.equal(JSON.stringify(a).includes('outside'), false, '다른 팀 입실자의 신원은 반환하지 않는다');
        await save({ teamId: 'a', revision: a.revision, changes: [], roomChanges: [setting(3, 2)] }, context('a'));
        assert.deepEqual((await db.doc('accommodations/shared').get()).data()?.contract, { memo: '보존' });
        await assert.rejects(save({ teamId: 'a', revision: a.revision, changes: [], roomChanges: [setting(4, 3)] }, context('a')), (e: any) => e.code === 'failed-precondition');
        a = await read('a');
        let b = await read('b');
        await assert.rejects(save({ teamId: 'b', revision: b.revision, changes: [], roomChanges: [{ accommodationId: 'private', roomCount: 2, maxOccupants: 3 }] }, context('b')), (e: any) => e.code === 'permission-denied');
        const payload = (uid: string, revision: string) => ({ teamId: uid, revision, changes: [{ workerId: uid, accommodationId: 'shared' }] });
        const race = await Promise.allSettled([save(payload('a', a.revision), context('a')), save(payload('b', b.revision), context('b'))]);
        assert.equal(race.filter(result => result.status === 'fulfilled').length, 1, '서로 다른 팀이 마지막 1자리에 동시에 입실할 수 없다');
        const winner = race[0].status === 'fulfilled' ? 'a' : 'b';
        const loser = winner === 'a' ? 'b' : 'a';
        const losingBoard = await read(loser);
        await assert.rejects(save(payload(loser, losingBoard.revision), context(loser)), (e: any) => e.code === 'failed-precondition' && e.message.includes('최대 인원'));
        let board = await read(winner);
        assert.equal(board.rooms.find(room => room.id === 'shared')?.totalOccupants, 2);
        await assert.rejects(save({ teamId: winner, revision: board.revision, changes: [], roomChanges: [setting(3, 1)] }, context(winner)), (e: any) => e.code === 'failed-precondition');
        await save({ teamId: winner, revision: board.revision, changes: [{ workerId: winner, accommodationId: null }], roomChanges: [setting(3, 1)] }, context(winner));
        board = await read(winner);
        assert.equal(board.rooms.find(room => room.id === 'shared')?.totalOccupants, 1);
        assert.equal(board.rooms.find(room => room.id === 'shared')?.maxOccupants, 1);
        await save({ teamId: winner, revision: board.revision, changes: [], roomChanges: [setting(null, null)] }, context(winner));
        board = await read(winner);
        assert.equal(board.rooms.find(room => room.id === 'shared')?.roomCount, null, '명시적으로 비운 값은 유형 기본값으로 되돌리지 않는다');
        assert.equal(board.rooms.find(room => room.id === 'shared')?.maxOccupants, null);
        assert.equal((await db.doc('accommodationAssignments/outside').get()).data()?.status, 'active');
        assert.equal((await db.doc('accommodationAssignments/a').get()).data()?.status, 'active');
        assert.equal((await db.doc('accommodations/shared').get()).data()?.ownership, 'Cheongyeon');
    } finally {
        for (const collection of ['users', 'companies', 'teams', 'workers', 'accommodations', 'accommodationAssignments']) {
            const rows = await db.collection(collection).get();
            const cleanup = db.batch(); rows.docs.forEach(doc => cleanup.delete(doc.ref)); await cleanup.commit();
        }
        await app.delete();
    }
});

test('팀 범위·동시 저장·입실 이력과 기존 팀 배정을 실제 Firestore 트랜잭션에서 검증한다', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = admin.initializeApp({ projectId: 'demo-team-accommodation' });
    const db = app.firestore();
    const date = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    const previous = new Date(new Date(`${date}T00:00:00Z`).getTime() - 86400_000).toISOString().slice(0, 10);
    const future = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10);
    const fixtures = {
        'users/housing-leader': { status: 'active', position: '팀장', linkedWorkerIds: ['anchor'] },
        'users/housing-admin': { status: 'active', role: 'dev' },
        'users/housing-ceo': { status: 'active', role: 'CEO' },
        'users/housing-manager': { status: 'active', role: 'manager' },
        'users/housing-manager-ko': { status: 'active', position: '매니저' },
        'users/housing-manager-custom': { status: 'active', position: 'pos_housing-manager' },
        'settings/menus_v12': { admin: { positionConfig: [{ id: 'housing-manager', name: '매니저' }] } },
        'users/housing-worker': { status: 'active', role: '작업자', linkedWorkerIds: ['anchor'] },
        'companies/cy': { name: '(주) 청연이엔지', legacyId: 'old-cy', code: 'CYENG', accountNumber: 'private' },
        'companies/external': { name: '외부 회사' },
        'teams/team-a': { name: '가상 A팀', legacyId: 'old-a', color: '#2563eb', companyId: 'old-cy' },
        'teams/team-b': { name: '가상 B팀', color: '#d97706', companyId: 'cy' },
        'teams/external': { name: '외부팀', companyId: 'external', companyName: '청연이엔지' },
        'teams/unassigned': { name: '미소속팀' },
        'workers/anchor': { name: '가상 팀장', teamId: 'old-a', role: '팀장' },
        'workers/member': { name: '가상 작업자', teamId: 'team-a', phone: 'private' },
        'workers/other': { name: '다른 팀 작업자', teamId: 'team-b' },
        'workers/no-team': { name: '소속 미지정 작업자' },
        'workers/external': { name: '외부 작업자', teamId: 'external' },
        'workers/unassigned-team': { name: '미소속팀 작업자', teamId: 'unassigned' },
        'workers/retired': { name: '퇴사 작업자', teamId: 'team-a', status: '퇴사' },
        'accommodations/room-a': { name: '가상 원룸', type: 'OneRoom', status: 'active', contract: { accountNumber: 'private' } },
        'accommodations/room-a2': { name: '가상 투룸', type: 'TwoRoom', status: 'active' },
        'accommodations/room-worker': { name: '팀 작업자 입실 숙소', type: 'OneRoom', status: 'active' },
        'accommodations/room-b': { name: '다른 팀 숙소', status: 'active' },
        'accommodations/unallocated': { name: '팀 배정 전 숙소', status: 'active' },
        'accommodations/expired': { name: '종료 숙소', status: 'active', contract: { endDate: previous } },
        'accommodationAssignments/team-a': { source: 'team', teamId: 'old-a', accommodationId: 'room-a', startDate: previous, status: 'active' },
        'accommodationAssignments/team-a2': { source: 'team', teamId: 'team-a', accommodationId: 'room-a2', startDate: previous, status: 'active' },
        'accommodationAssignments/team-b': { source: 'team', teamId: 'team-b', accommodationId: 'room-b', startDate: previous, status: 'active' },
        'accommodationAssignments/expired': { source: 'team', teamId: 'team-a', accommodationId: 'expired', startDate: previous, status: 'active' },
        'accommodationAssignments/member': { source: 'worker', workerId: 'member', teamId: 'old-a', accommodationId: 'room-worker', startDate: previous, status: 'active', memo: '보존할 메모' },
    };
    const change = (workerId: string, accommodationId: string | null) => ({ workerId, accommodationId });
    const read = () => load({}, context());
    const write = (board: any, changes: any[]) => save({ teamId: board.teamId, revision: board.revision, changes }, context());
    try {
        const batch = db.batch(); Object.entries(fixtures).forEach(([path, data]) => batch.set(db.doc(path), data)); await batch.commit();
        let board = await read();
        assert.deepEqual(board.teams.map(row => row.id), ['team-a']);
        assert.deepEqual(new Set(board.rooms.map(row => row.id)), new Set(['room-a', 'room-a2', 'room-worker']));
        assert.deepEqual(new Set(board.workers.map(row => row.id)), new Set(['anchor', 'member']));
        assert.equal(JSON.stringify(board).includes('private'), false);
        assert.equal(board.canManageAll, false);
        assert.equal(board.teams[0].color, '#2563eb');
        await assert.rejects(load({ teamId: '__all__', canManageAll: true }, context()), (e: any) => e.code === 'permission-denied');
        await assert.rejects(load({ teamId: 'team-b' }, context()), (e: any) => e.code === 'permission-denied');
        await assert.rejects(load({}, context('housing-worker')), (e: any) => e.code === 'permission-denied');
        assert.equal((await load({ teamId: 'team-b' }, context('housing-admin'))).teamId, 'team-b');
        // Actual profile roles (including custom menu IDs), never token/input role claims, determine global access.
        for (const [index, uid] of ['housing-admin', 'housing-ceo', 'housing-manager', 'housing-manager-ko', 'housing-manager-custom'].entries()) {
            const firstTeam = await load({}, context(uid));
            assert.equal(firstTeam.teamId, 'team-a');
            assert.deepEqual(new Set(firstTeam.rooms.map(row => row.id)), new Set(['room-a', 'room-a2', 'room-worker']));
            assert.deepEqual(new Set(firstTeam.workers.map(row => row.id)), new Set(['anchor', 'member']));
            const global = await load({ teamId: '__all__' }, context(uid));
            assert.equal(global.canManageAll, true);
            assert.equal(global.teamId, '__all__');
            assert.deepEqual(new Set(global.teams.map(row => row.id)), new Set(['team-a', 'team-b']));
            assert.deepEqual(new Set(global.workers.map(row => row.id)), new Set(['anchor', 'member', 'other']));
            assert.deepEqual(new Set(global.rooms.map(row => row.id)), new Set(['room-a', 'room-a2', 'room-worker', 'room-b', 'unallocated']));
            const target = index % 2 ? 'room-a2' : 'unallocated';
            await save({ teamId: global.teamId, revision: global.revision, changes: [change('other', target)] }, context(uid));
            const occupancy = (await db.collection('accommodationAssignments').where('workerId', '==', 'other').where('status', '==', 'active').get()).docs[0].data();
            assert.equal(occupancy.accommodationId, target);
            assert.equal(occupancy.teamId, 'team-b', '저장자의 팀이나 숙소의 팀으로 작업자 소속을 덮어쓰면 안 된다');
        }
        let global = await load({ teamId: '__all__' }, context('housing-manager'));
        for (const workerId of ['no-team', 'external', 'unassigned-team']) {
            await assert.rejects(save({ teamId: '__all__', revision: global.revision, changes: [change(workerId, 'room-a')] }, context('housing-manager')), (e: any) => e.code === 'permission-denied');
        }
        for (const teamId of ['external', 'unassigned']) {
            await assert.rejects(load({ teamId }, context('housing-admin')), (e: any) => e.code === 'permission-denied');
        }
        const filtered = await load({ teamId: 'team-b' }, context('housing-manager'));
        assert.deepEqual(filtered.workers.map(row => row.id), ['other']);
        assert.deepEqual(new Set(filtered.rooms.map(row => row.id)), new Set(['room-b', 'unallocated']), '개별 팀은 현재 팀 배정·입실 기록이 있는 숙소만 표시한다');
        await assert.rejects(save({ teamId: 'team-b', revision: filtered.revision, changes: [change('other', 'room-a')] }, context('housing-admin')), (e: any) => e.code === 'permission-denied');
        await db.doc('teams/no-room').set({ name: '숙소 미배정팀', companyId: 'cy' });
        const noRoom = await load({ teamId: 'no-room' }, context('housing-admin'));
        assert.deepEqual(noRoom.rooms, [], '숙소 없는 팀에는 다른 팀 숙소를 대신 보여주지 않는다');
        await db.doc('teams/no-room').delete();
        global = await load({ teamId: '__all__' }, context('housing-manager'));
        await db.doc('users/housing-manager').update({ role: '작업자' });
        await assert.rejects(save({ teamId: '__all__', revision: global.revision, changes: [change('other', 'room-a')] }, context('housing-manager')), (e: any) => e.code === 'permission-denied');
        await db.doc('teams/team-b').update({ companyId: 'external' });
        await assert.rejects(save({ teamId: 'team-b', revision: filtered.revision, changes: [change('other', 'room-a')] }, context('housing-admin')), (e: any) => e.code === 'permission-denied');
        await db.doc('teams/team-b').update({ companyId: 'cy' });
        for (const invalid of [change('other', 'room-a'), change('retired', 'room-a'), change('anchor', 'room-b'), change('anchor', 'expired')]) {
            await assert.rejects(write(board, [change('member', 'room-a2'), invalid]), (e: any) => e.code === 'permission-denied');
            assert.equal((await db.doc('accommodationAssignments/member').get()).data()?.status, 'active');
        }
        await write(board, [change('member', 'room-a2')]);
        const history = (await db.doc('accommodationAssignments/member').get()).data();
        assert.equal(history?.status, 'ended'); assert.equal(history?.endDate, previous); assert.equal(history?.memo, '보존할 메모');
        assert.equal((await db.doc('accommodationAssignments/team-a').get()).data()?.status, 'active');
        await assert.rejects(write(board, [change('anchor', 'room-a')]), (e: any) => e.code === 'failed-precondition');
        board = await read();
        assert.equal(board.workers.find(row => row.id === 'member')?.accommodationId, 'room-a2');
        const before = (await db.collection('accommodationAssignments').where('workerId', '==', 'member').get()).size;
        await write(board, [change('member', 'room-a')]);
        assert.equal((await db.collection('accommodationAssignments').where('workerId', '==', 'member').get()).size, before);
        board = await read();
        const race = await Promise.allSettled([write(board, [change('anchor', 'room-a')]), write(board, [change('anchor', 'room-a2')])]);
        assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((await db.collection('accommodationAssignments').where('workerId', '==', 'anchor').where('status', '==', 'active').get()).size, 1);
        board = await read(); await write(board, [change('member', null)]);
        assert.equal((await read()).workers.find(row => row.id === 'member')?.accommodationId, null);
        await db.doc('accommodationAssignments/future').set({ workerId: 'member', teamId: 'team-a', accommodationId: 'room-a', status: 'active', startDate: future });
        board = await read(); assert.ok(board.workers.find(row => row.id === 'member')?.lockedReason);
        await assert.rejects(write(board, [change('member', 'room-a2')]), (e: any) => e.code === 'permission-denied');
        await db.doc('workers/member').update({ teamId: 'team-b' });
        await assert.rejects(write(board, [change('member', 'room-a')]), (e: any) => e.code === 'failed-precondition');
        await db.doc('users/housing-leader').update({ status: 'suspended' });
        await assert.rejects(read(), (e: any) => e.code === 'permission-denied');
    } finally {
        // This suite never connects unless FIRESTORE_EMULATOR_HOST is explicitly set.
        for (const collection of ['users', 'companies', 'teams', 'workers', 'accommodations', 'accommodationAssignments', 'settings']) {
            const rows = await db.collection(collection).get();
            const cleanup = db.batch(); rows.docs.forEach(doc => cleanup.delete(doc.ref)); await cleanup.commit();
        }
        await app.delete();
    }
});
