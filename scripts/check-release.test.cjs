const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForRelease } = require('./check-release.cjs');
const local = { schemaVersion: 1, commit: 'expected', fingerprints: { hosting: 'h', functions: 'f', firestore: 'd', storage: 's', deployment: 'c' }, assetManifestHash: 'assets' };
const assets = { files: { main: 'main.js' } };

test('waits for release and asset manifests to converge without rebuilding or redeploying', async () => {
    let round = 0;
    const pauses = [];
    const remote = await waitForRelease('https://example.test', local, assets, {
        wait: async delay => { pauses.push(delay); },
        read: async (_, name) => {
            if (name === 'release.json') { round++; return round === 1 ? { ...local, commit: 'previous' } : local; }
            return round < 3 ? { files: { main: 'previous.js' } } : assets;
        },
    });
    assert.equal(remote.commit, 'expected');
    assert.deepEqual(pauses, [2000, 4000]);
});

test('a persistent wrong release or unavailable endpoint still fails after the bounded retries', async () => {
    for (const unavailable of [false, true]) {
        let calls = 0;
        await assert.rejects(waitForRelease('https://example.test', local, assets, {
            wait: async () => {},
            read: async (_, name) => {
                calls++;
                if (unavailable) throw new Error('unavailable');
                return name === 'release.json' ? { ...local, commit: 'wrong' } : assets;
            },
        }), unavailable ? /unavailable/ : /사이트 반영 확인 필요/);
        assert.equal(calls, 8);
    }
});
