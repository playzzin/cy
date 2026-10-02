const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { hash } = require('./release-manifest.cjs');
const { inputIdentity, canReuseBuild, invalidateBuild, recordBuild } = require('./hosting-build-cache.cjs');

test('reuse requires unchanged inputs and every output, including lazy chunks and public files', t => {
    const parent = path.resolve(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(parent, 'cy-hosting-cache-test-'));
    t.after(() => {
        assert.ok(directory.startsWith(parent + path.sep) && path.basename(directory).startsWith('cy-hosting-cache-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git(['init', '--quiet']);
    git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'fixture']);
    for (const name of ['src', 'public', 'node_modules', 'build/static/js']) fs.mkdirSync(path.join(directory, name), { recursive: true });
    fs.writeFileSync(path.join(directory, '.gitignore'), 'node_modules/\nbuild/\n');
    fs.writeFileSync(path.join(directory, 'node_modules/.package-lock.json'), '{}');
    fs.writeFileSync(path.join(directory, 'src/example.ts'), 'export const value = 1;');
    for (const [name, value] of Object.entries({ 'index.html': '<script src="/static/js/main.js"></script>', 'asset-manifest.json': '{}', 'static/js/main.js': 'main', 'static/js/lazy.js': 'lazy', 'manual.pdf': 'synthetic' })) {
        fs.writeFileSync(path.join(directory, 'build', name), value);
    }
    const env = { NODE_ENV: 'production', REACT_APP_FIREBASE_PROJECT_ID: 'demo-cache', REACT_APP_TEST_SETTING: 'synthetic-a' };
    const identity = inputIdentity(directory, env);
    fs.writeFileSync(path.join(directory, 'build/release.json'), JSON.stringify({ schemaVersion: 1, ...identity.source, assetManifestHash: hash('{}') }));
    assert.equal(canReuseBuild(identity, directory), false);
    recordBuild(identity, directory, env);
    assert.equal(canReuseBuild(identity, directory), true);
    for (const name of ['static/js/lazy.js', 'manual.pdf']) {
        const filename = path.join(directory, 'build', name);
        const original = fs.readFileSync(filename);
        fs.writeFileSync(filename, 'changed');
        assert.equal(canReuseBuild(identity, directory), false);
        fs.unlinkSync(filename);
        assert.equal(canReuseBuild(identity, directory), false);
        fs.writeFileSync(filename, original);
    }
    fs.writeFileSync(path.join(directory, 'build/unexpected.txt'), 'unexpected');
    assert.equal(canReuseBuild(identity, directory), false);
    fs.unlinkSync(path.join(directory, 'build/unexpected.txt'));
    assert.equal(canReuseBuild(inputIdentity(directory, { ...env, REACT_APP_TEST_SETTING: 'synthetic-b' }), directory), false);
    assert.equal(canReuseBuild(inputIdentity(directory, { ...env, DISABLE_FORK_TS_CHECKER: 'true' }), directory), false);
    fs.writeFileSync(path.join(directory, 'src/example.ts'), 'export const value = 2;');
    assert.equal(canReuseBuild(inputIdentity(directory, env), directory), false);
    assert.throws(() => recordBuild(identity, directory, env), /빌드 중/);
    fs.writeFileSync(path.join(directory, 'src/example.ts'), 'export const value = 1;');
    fs.writeFileSync(path.join(directory, 'node_modules/.package-lock.json'), '{"changed":true}');
    assert.equal(canReuseBuild(inputIdentity(directory, env), directory), false);
    fs.writeFileSync(path.join(directory, 'node_modules/.package-lock.json'), '{}');
    assert.equal(canReuseBuild(inputIdentity(directory, env), directory), true);
    invalidateBuild(directory);
    assert.equal(canReuseBuild(identity, directory), false);
});
