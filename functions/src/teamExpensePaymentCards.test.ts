import { strict as assert } from 'assert';
import { test } from 'node:test';
import { listExpensePaymentCards, readExpensePaymentCard } from './teamExpensePaymentCards';

const fixture = () => {
    const rows: Record<string, any> = {
        'teams/a': { legacyId: 'legacy-a' },
        'teams/b': {},
        'cards/a': { name: '현장 경비', issuer: '테스트카드', last4: '1234', currentAssigneeId: 'legacy-a', currentAssigneeType: 'TEAM', status: 'ASSIGNED', privateField: 'not-returned' },
        'cards/b': { name: '다른팀 카드', currentAssigneeId: 'b', currentAssigneeType: 'TEAM', status: 'ASSIGNED' },
        'cards/closed': { currentAssigneeId: 'a', currentAssigneeType: 'TEAM', status: 'CLOSED' },
        'cards/worker': { currentAssigneeId: 'a', currentAssigneeType: 'WORKER', status: 'ASSIGNED' },
        'cards/suspended': { currentAssigneeId: 'a', currentAssigneeType: 'TEAM', status: 'SUSPENDED' },
    };
    const reads: string[][] = [];
    const snapshot = (path: string) => ({ id: path.split('/')[1], exists: Boolean(rows[path]), data: () => rows[path] });
    const db = {
        doc: (path: string) => ({ path }),
        getAll: async (...refs: any[]) => refs.filter(ref => ref.path).map(ref => snapshot(ref.path)),
        collection: (name: string) => ({ where: (field: string, operator: string, refs: string[]) => {
            assert.equal(name, 'cards'); assert.equal(field, 'currentAssigneeId'); assert.equal(operator, 'in');
            reads.push(refs);
            return { select: (...fields: string[]) => {
                assert.ok(!fields.includes('privateField'));
                return { get: async () => ({ docs: Object.keys(rows).filter(path => path.startsWith('cards/') && refs.includes(rows[path].currentAssigneeId)).map(snapshot) }) };
            } };
        } }),
    };
    return { rows, db: db as any, reads };
};

test('소속팀과 legacy ID에 배정된 사용 가능 카드만 최소 정보로 반환한다', async () => {
    const { db, reads } = fixture();
    assert.deepEqual(await listExpensePaymentCards(db, [{ id: 'a' }]), [
        { id: 'a', label: '현장 경비 · 테스트카드 · •••• 1234', teamId: 'a' },
    ]);
    assert.deepEqual(reads, [['a', 'legacy-a']]);
    assert.deepEqual(await listExpensePaymentCards(db, []), []);
    assert.equal(reads.length, 1);
});

test('서버에서 카드 이름을 결정하고 다른팀·개인·해지·정지·삭제된 카드를 거부한다', async () => {
    const { db } = fixture();
    assert.deepEqual(await readExpensePaymentCard(db, 'a', 'a'), { id: 'a', label: '현장 경비 · 테스트카드 · •••• 1234', teamId: 'a' });
    for (const id of ['b', 'closed', 'worker', 'suspended', 'missing']) {
        await assert.rejects(readExpensePaymentCard(db, 'a', id), (error: any) => error.code === 'failed-precondition');
    }
});

test('저장 트랜잭션에서도 최신 배정 상태를 다시 읽는다', async () => {
    const { db, rows } = fixture();
    await readExpensePaymentCard(db, 'a', 'a');
    let read = false;
    const transaction = { getAll: async (...refs: any[]) => { read = true; rows['cards/a'].currentAssigneeId = 'b'; return db.getAll(...refs); } };
    await assert.rejects(readExpensePaymentCard(db, 'a', 'a', transaction as any), (error: any) => error.code === 'failed-precondition');
    assert.equal(read, true);
});
