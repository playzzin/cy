import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { canReadNotice, canManageNotice, noticeBoardAccess, matchesNoticeAudience } from './noticeAccess';

const teams = [{ id: 'a', legacyId: 'old-a', name: 'A팀', leaderId: 'wa' }, { id: 'b', name: 'B팀', leaderId: 'wb' }];
const workers = [
    { id: 'wa', legacyId: 'old-wa', teamId: 'old-a', role: '팀장' },
    { id: 'ma', teamId: 'a', role: '작업자' },
    { id: 'wb', teamId: 'b', role: '팀장' },
    { id: 'mb', teamId: 'b', role: '작업자' },
];
const leader = { uid: 'leader-a', role: 'user', linkedWorkerIds: '["old-wa"]' };
const member = { uid: 'member-a', role: 'user', linkedWorkerIds: ['ma'] };
const otherLeader = { uid: 'leader-b', linkedWorkerIds: ['wb'] };
const otherMember = { uid: 'member-b', linkedWorkerIds: ['mb'] };
const notice = { audience: 'team', teamId: 'a', status: 'published', createdBy: { uid: leader.uid } };

test('team notices stay within canonical membership, including legacy links', () => {
    for (const user of [leader, member]) assert.equal(canReadNotice(notice, user, workers, teams), true);
    for (const user of [otherLeader, otherMember, { uid: 'unlinked', position: '팀장' }, { ...member, status: 'suspended' }]) {
        assert.equal(canReadNotice(notice, user, workers, teams), false);
    }
    assert.equal(canReadNotice(notice, member, workers.map(w => w.id === 'ma' ? { ...w, teamId: 'b' } : w), teams), false);
});
test('Cheongyeon leader-only and all-user audiences differ and unknown scopes fail closed', () => {
    for (const user of [leader, otherLeader]) assert.equal(matchesNoticeAudience({ audience: 'teamLeaders' }, user, workers, teams), true);
    for (const user of [member, otherMember]) assert.equal(matchesNoticeAudience({ audience: 'teamLeaders' }, user, workers, teams), false);
    for (const user of [leader, member, otherLeader, otherMember]) assert.equal(matchesNoticeAudience({ audience: 'all' }, user, workers, teams), true);
    assert.equal(matchesNoticeAudience({ audience: 'unknown' }, leader, workers, teams), false);
});
test('only a current leader author or manager can manage a team notice', () => {
    assert.equal(canManageNotice(notice, leader, workers, teams), true);
    for (const user of [member, otherLeader, { ...leader, uid: 'co-leader' }]) assert.equal(canManageNotice(notice, user, workers, teams), false);
    assert.equal(canManageNotice(notice, { uid: 'office', role: 'admin' }, workers, teams), true);
    assert.deepEqual(noticeBoardAccess(leader, workers, teams).teams, [{ id: 'a', name: 'A팀' }]);
    assert.deepEqual(noticeBoardAccess(member, workers, teams).teams, []);
});
test('untrusted labels, inactive links and ambiguous IDs cannot confer team access', () => {
    assert.equal(canReadNotice(notice, { uid: 'fake', email: 'same@test', teamName: 'A팀' }, [...workers, { id: 'x', email: 'same@test', teamId: 'a' }], teams), false);
    assert.equal(canReadNotice(notice, leader, workers.map(w => ({ ...w, isActive: false })), teams), false);
    assert.equal(canReadNotice(notice, leader, [...workers, { id: 'duplicate', legacyId: 'old-wa', teamId: 'a' }], teams), false);
    assert.equal(canReadNotice({ ...notice, status: 'archived' }, member, workers, teams), false);
    assert.equal(canReadNotice({ ...notice, expiresAt: { toMillis: () => 1 } }, member, workers, teams, {}, 2), false);
});
test('configured role IDs and legacy target positions are retained', () => {
    const menu = { admin: { positionConfig: [{ id: 'leader-role', name: '팀장' }] } };
    const user = { uid: 'custom', position: 'pos_leader-role', linkedWorkerIds: ['ma'] };
    assert.equal(matchesNoticeAudience({ audience: 'teamLeaders' }, user, workers, teams, menu), true);
    assert.deepEqual(noticeBoardAccess(user, workers, teams, menu).teams, [{ id: 'a', name: 'A팀' }]);
    assert.equal(matchesNoticeAudience({ targetPositions: ['팀장'] }, leader, workers, teams), true);
    assert.equal(matchesNoticeAudience({ targetPositions: ['팀장'] }, member, workers, teams), false);
});
