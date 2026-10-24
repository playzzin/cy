import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { noticeRecipients, isNoticeManager } from './notificationCenter';

const users = [{ uid: 'leader', role: 'user', position: '팀장', linkedWorkerIds: ['w'] }, { uid: 'office', role: 'admin', position: '사무실' }, { uid: 'inactive', position: '팀장', status: 'suspended' }];
const notice = { targetPositions: ['팀장'] };
const config = (mode: string, fields = {}) => ({ recipientScope: 'all', events: { 'notice.created': { recipientRule: { mode, ...fields } } } });
test('notice audience always intersects configured recipients and active users', () => {
    assert.deepEqual(noticeRecipients(notice, config('allUsers'), users, [], []).map(u => u.uid), ['leader']);
    assert.deepEqual(noticeRecipients(notice, config('users', { recipientIds: ['office'] }), users, [], []), []);
    assert.deepEqual(noticeRecipients({ targetPositions: [] }, { ...config('global'), recipientScope: 'users', recipientIds: ['office'] }, users, [], []).map(u => u.uid), ['office']);
});
test('worker links support legacy IDs and team names; ambiguous leader names do not expand access', () => {
    const workers = [{ id: 'w', legacyId: 'old-w', name: '담당자', teamId: 'team' }];
    const teams = [{ id: 'team', name: '현장팀', leaderName: '담당자' }];
    const legacyUser = [{ uid: 'leader', linkedWorkerIds: '["old-w"]' }];
    assert.equal(noticeRecipients({ targetPositions: [] }, config('teamLeaders', { teamIds: ['team'] }), legacyUser, workers, teams).length, 1);
    assert.equal(noticeRecipients({ targetPositions: [] }, config('teamMembers', { teamNames: ['현장팀'] }), legacyUser, workers, teams).length, 1);
    assert.equal(noticeRecipients({ targetPositions: [] }, config('teamLeaders'), legacyUser, [...workers, { id: 'duplicate', name: '담당자', teamId: 'team' }], teams).length, 0);
});
test('unknown modes never fall back to a broader audience and suspended managers are denied', () => {
    assert.throws(() => noticeRecipients(notice, config('unexpected'), users, [], []));
    assert.equal(isNoticeManager({ role: 'admin', status: 'suspended' }), false);
    assert.equal(isNoticeManager({ role: 'user', position: '매니저', status: 'active' }), true);
});
