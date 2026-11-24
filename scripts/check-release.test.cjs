const test = require('node:test');
const assert = require('node:assert/strict');
const { readRemoteJson, waitForRelease } = require('./check-release.cjs');
const local = { schemaVersion: 1, commit: 'expected', fingerprints: { hosting: 'h', functions: 'f', firestore: 'd', storage: 's', deployment: 'c' }, assetManifestHash: 'assets' };
const assets = { files: { main: 'main.js' } };

test('a transient HTTP failure retries, while DNS and HTTP errors remain distinguishable', async () => {
    const once = [];
    const options = { wait: async () => {}, request: async () => {
        once.push(true);
        return once.length === 1 ? new Response(null, { status: 503 }) : Response.json(local);
    } };
    assert.deepEqual(await readRemoteJson('https://example.test', 'release.json', options), local);
    assert.equal(once.length, 2);
    let calls = 0;
    await assert.rejects(readRemoteJson('https://example.test', 'release.json', {
        allowMissing: true, wait: async () => {}, request: async () => {
            calls++;
            throw new TypeError('fetch failed', { cause: Object.assign(new Error(), { code: 'ENOTFOUND' }) });
        },
    }), /example\.test\/release\.json.*ENOTFOUND/);
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(readRemoteJson('https://example.test', 'release.json', {
        allowMissing: true, request: async () => { calls++; return new Response(null, { status: 403 }); },
    }), /HTTP 403/);
    assert.equal(calls, 1);
});

test('initialization accepts a 404 or verified SPA fallback and rejects unrelated HTML and malformed records', async () => {
    function read(request, allowMissing = true) {
        return readRemoteJson('https://example.test', 'release.json', { allowMissing, request });
    }
    const missing = () => new Response(null, { status: 404 });
    assert.equal(await read(missing), null);
    await assert.rejects(read(missing, false), /HTTP 404/);
    const html = body => new Response(body, { headers: { 'content-type': 'text/html' } });
    const shell = '<html><div id="root"></div></html>';
    assert.equal(await read(() => html(shell)), null);
    await assert.rejects(read(url => html(url.pathname === '/index.html' ? shell : shell + 'upstream error')), /응답 형식/);
    await assert.rejects(read(() => html('login required')), /응답 형식/);
    await assert.rejects(read(() => Response.json(null)), /JSON 객체/);
});

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
