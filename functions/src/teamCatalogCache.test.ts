import { strict as assert } from 'assert';
import { test } from 'node:test';
import { readTeamCatalog } from './teamCatalogCache';

test('카탈로그 캐시는 계정·허용 ID별로 분리하고 수정 후 우회하며 30초 후 만료된다', async () => {
    const originalNow = Date.now;
    let now = 1000;
    Date.now = () => now;
    let reads = 0;
    const load = async () => [{ id: 'company-a', name: `name-${++reads}` }];
    try {
        const first = await readTeamCatalog('leader-cache-test', 'companies', ['a'], false, load);
        first[0].name = 'mutated';
        assert.equal((await readTeamCatalog('leader-cache-test', 'companies', ['a'], false, load))[0].name, 'name-1');
        assert.equal(reads, 1);
        await readTeamCatalog('other-cache-test', 'companies', ['a'], false, load);
        await readTeamCatalog('leader-cache-test', 'companies', ['b'], false, load);
        assert.equal(reads, 3);
        await readTeamCatalog('leader-cache-test', 'companies', ['a'], true, load);
        assert.equal(reads, 4);
        now += 30_001;
        await readTeamCatalog('leader-cache-test', 'companies', ['a'], false, load);
        assert.equal(reads, 5);
    } finally { Date.now = originalNow; }
});

test('조회 실패는 캐시하지 않는다', async () => {
    await assert.rejects(readTeamCatalog('failed-cache-test', 'materials', [], false, async () => { throw new Error('offline'); }));
    assert.deepEqual(await readTeamCatalog('failed-cache-test', 'materials', [], false, async () => [{ id: 'material-a' }]), [{ id: 'material-a' }]);
});
