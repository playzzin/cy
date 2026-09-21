import { strict as assert } from 'assert';
import { test } from 'node:test';
import { FieldPath, Filter } from 'firebase-admin/firestore';
import { queryByIds as readRowsByIds } from './teamScopedQuery';

test('문서 ID와 legacyId를 분리해 조회하고 중복 문서를 합친다', async () => {
    const originalWhere = Filter.where;
    const queriedFields: unknown[] = [];
    const requestedIds: string[][] = [];
    const doc = (id: string, exists = true) => ({ id, exists, data: () => ({ name: id }) });
    const db = {
        collection: () => ({
            doc: (id: string) => ({ id }),
            where: () => ({ limit: () => ({ get: async () => ({ size: 2, docs: [doc('direct'), doc('legacy')] }) }) }),
        }),
        getAll: async (...refs: Array<{ id: string }>) => {
            requestedIds.push(refs.map(ref => ref.id));
            return refs.map(ref => doc(ref.id, ref.id !== 'missing'));
        },
    };
    Filter.where = ((field, operator, value) => {
        queriedFields.push(field);
        return originalWhere(field, operator, value);
    }) as typeof Filter.where;
    try {
        const metrics = { queries: 0, documents: 0 };
        const rows = await readRowsByIds(db as any, 'teams', [FieldPath.documentId(), 'legacyId'], ['direct', 'missing', 'direct', ''], metrics);
        assert.deepEqual(requestedIds, [['direct', 'missing']]);
        // An OR query containing __name__ can fail only in production, even
        // when the emulator passes, so verify the actual query field boundary.
        assert.deepEqual(queriedFields, ['legacyId', 'legacyId']);
        assert.deepEqual(rows.map(row => row.id), ['direct', 'legacy']);
        assert.deepEqual(metrics, { queries: 2, documents: 4 });
    } finally { Filter.where = originalWhere; }
});

test('빈 ID 목록은 DB를 조회하지 않는다', async () => {
    const db = { collection: () => { throw new Error('Unexpected query'); }, getAll: () => { throw new Error('Unexpected read'); } };
    assert.deepEqual(await readRowsByIds(db as any, 'teams', [FieldPath.documentId(), 'legacyId'], []), []);
});
