import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { FieldPath } from 'firebase-admin/firestore';
import { readNoticeWorkers } from './noticeBoard';
import { canReadNotice, noticeBoardAccess } from './noticeAccess';

const teams = [{ id: 'a', legacyId: 'old-a', name: 'A팀', leaderName: '동명이인' }, { id: 'b', name: 'B팀', leaderId: 'b1' }];
const workers = [
    { id: 'a1', uid: 'viewer', name: '동명이인', teamId: 'old-a' },
    { id: 'a2', name: '동명이인', teamId: 'a' },
    { id: 'b1', legacyId: 'old-b1', name: '팀장', role: '팀장', teamId: 'b' },
    { id: 'collision', legacyId: 'old-b1', isActive: false },
    { id: 'private', name: '타팀 작업자', teamId: 'b' },
];

async function read(user: Record<string, unknown>) {
    const queries: string[] = [];
    const directory = {
        where: (field: string | FieldPath, op: string, value: unknown) => {
            const key = typeof field === 'string' ? field : 'id';
            queries.push(key);
            return workers.filter(worker => op === 'in' ? (value as unknown[]).includes(worker[key]) : worker[key] === value);
        },
    };
    const tx = { get: async (query: unknown) => {
        if (query === directory) queries.push('all');
        return { docs: (query === directory ? workers : query as typeof workers).map(row => ({ id: row.id, data: () => row })) };
    } };
    const db = { collection: () => ({ select: () => directory }) };
    const selected = await readNoticeWorkers(db as any, tx as any, user, teams);
    assert.deepEqual(noticeBoardAccess(user, selected, teams), noticeBoardAccess(user, workers, teams));
    for (const team of teams) {
        const notice = { audience: 'team', teamId: team.id, status: 'published' };
        assert.equal(canReadNotice(notice, user, selected, teams), canReadNotice(notice, user, workers, teams));
    }
    return { queries, selected };
}

test('공지 목록은 계정 UID 및 연결 ID만 조회하고 중복 과거 ID의 접근 제한을 유지한다', async () => {
    const { queries, selected } = await read({ uid: 'test', linkedWorkerIds: '["old-b1"]' });
    assert.deepEqual(queries.sort(), ['id', 'legacyId', 'uid']);
    assert.deepEqual(selected.map(worker => worker.id).sort(), ['b1', 'collision']);
    await read({ uid: 'test', linkedWorkerIds: ['b1'] });
});

test('이름으로만 팀장을 구분하는 이전 팀에서는 동명이인까지 확인한다', async () => {
    const { queries } = await read({ uid: 'viewer', role: 'user' });
    assert.deepEqual(queries.sort(), ['name', 'uid']);
});
