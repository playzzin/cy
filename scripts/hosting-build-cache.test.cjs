const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { hash } = require('./release-manifest.cjs');
const { inputIdentity, canReuseBuild, invalidateBuild, recordBuild, proofPath } = require('./hosting-build-cache.cjs');
const { beginBuild, writeManifest } = require('./release-manifest.cjs');
const { resolveBuildDirectory } = require('./hosting-build-paths.cjs');
const { verifyHostingBuild } = require('./verify-hosting-build.js');
const { assertHostingDirectory } = require('./verify-hosting-target.cjs');

for (const absolute of [false, true]) test(`custom output is used for manifest, cache and verification (${absolute ? 'absolute' : 'relative'})`, t => {
    const parent = path.resolve(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(parent, 'cy-hosting-cache-test-'));
    t.after(() => {
        assert.ok(directory.startsWith(parent + path.sep) && path.basename(directory).startsWith('cy-hosting-cache-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    git(['init', '--quiet']);
    git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'fixture']);
    const write = (name, value) => {
        fs.mkdirSync(path.dirname(name), { recursive: true });
        fs.writeFileSync(name, value);
    };
    write(path.join(directory, '.gitignore'), 'node_modules/\nbuild/\n.tmp/\n.firebase/\n');
    write(path.join(directory, 'node_modules/.package-lock.json'), '{}');
    const defaultEnv = { NODE_ENV: 'production' };
    const relative = '.tmp/hosting output';
    const customEnv = { ...defaultEnv, BUILD_PATH: absolute ? path.join(directory, relative) : relative };
    const defaultOutput = resolveBuildDirectory(directory, defaultEnv);
    const customOutput = resolveBuildDirectory(directory, customEnv);
    for (const [output, name] of [[defaultOutput, 'default'], [customOutput, 'custom']]) {
        write(path.join(output, 'index.html'), '<script src="/static/js/main.js"></script>');
        write(path.join(output, 'asset-manifest.json'), JSON.stringify({ name }));
        write(path.join(output, 'static/js/main.js'), 'exact-pixel-current-tab-selection-v3 document.body allowTaint');
    }
    // Starting the second output must not consume or overwrite the first marker.
    beginBuild(directory, defaultEnv);
    beginBuild(directory, customEnv);
    const original = writeManifest(directory, defaultEnv);
    const custom = writeManifest(directory, customEnv);
    assert.notEqual(original.assetManifestHash, custom.assetManifestHash);
    assert.equal(custom.assetManifestHash, hash(fs.readFileSync(path.join(customOutput, 'asset-manifest.json'))));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(defaultOutput, 'release.json'))), original);
    const defaultIdentity = inputIdentity(directory, defaultEnv);
    const customIdentity = inputIdentity(directory, customEnv);
    recordBuild(defaultIdentity, directory, defaultEnv);
    assert.equal(canReuseBuild(customIdentity, directory), false);
    recordBuild(customIdentity, directory, customEnv);
    assert.equal(canReuseBuild(defaultIdentity, directory), true);
    assert.equal(canReuseBuild(customIdentity, directory), true);
    assert.match(verifyHostingBuild(directory, customEnv), /verified/);
    assert.throws(() => assertHostingDirectory('build', directory, customEnv), /경로가 다릅니다/);
    assert.doesNotThrow(() => assertHostingDirectory(relative, directory, customEnv));
    invalidateBuild(directory, customOutput);
    assert.equal(canReuseBuild(customIdentity, directory), false);
    assert.equal(canReuseBuild(defaultIdentity, directory), true);
    recordBuild(customIdentity, directory, customEnv);
    fs.unlinkSync(path.join(customOutput, 'asset-manifest.json'));
    assert.equal(canReuseBuild(customIdentity, directory), false);
    assert.equal(canReuseBuild(defaultIdentity, directory), true);
    assert.throws(() => verifyHostingBuild(directory, customEnv), /incomplete/);
    beginBuild(directory, customEnv);
    assert.throws(() => writeManifest(directory, customEnv), /ENOENT/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(defaultOutput, 'release.json'))), original);
});

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

test('backend edits and commits reuse web assets while keeping release provenance strict', t => {
    const parent = path.resolve(os.tmpdir());
    const directory = fs.mkdtempSync(path.join(parent, 'cy-hosting-cache-test-'));
    t.after(() => {
        assert.ok(directory.startsWith(parent + path.sep) && path.basename(directory).startsWith('cy-hosting-cache-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const git = args => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
    const commit = message => git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.test', 'commit', '--quiet', '--allow-empty', '-m', message]);
    const write = (name, value) => {
        const filename = path.join(directory, name);
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, value);
    };
    git(['init', '--quiet']);
    commit('fixture');
    write('.gitignore', 'node_modules/\nbuild/\n');
    write('src/example.ts', 'export const value = 1;');
    write('node_modules/.package-lock.json', '{}');
    write('build/index.html', '<script src="/static/js/main.js"></script>');
    write('build/static/js/main.js', 'main');
    write('build/asset-manifest.json', '{}');
    const env = { NODE_ENV: 'production', REACT_APP_FIREBASE_PROJECT_ID: 'demo-cache' };
    const identity = () => inputIdentity(directory, env);
    const manifest = state => write('build/release.json', JSON.stringify({
        schemaVersion: 1, ...state.source, assetManifestHash: hash('{}'),
    }));
    let previous = identity();
    recordBuild(previous, directory, env);
    manifest(previous);
    for (const file of ['functions/src/index.ts', 'firestore.rules', 'storage.rules', 'firebase.json']) {
        write(file, 'synthetic backend change');
        const changed = identity();
        assert.equal(canReuseBuild(changed, directory), true, file);
        // A change DURING a build remains an error, even if it is backend-only.
        const priorIdentity = previous;
        assert.throws(() => recordBuild(priorIdentity, directory, env), /빌드 중/);
        recordBuild(changed, directory, env);
        assert.equal(canReuseBuild(changed, directory), false, 'postbuild must refresh the manifest');
        manifest(changed);
        assert.equal(canReuseBuild(changed, directory), true);
        previous = changed;
    }
    git(['add', '.']);
    commit('same web source, new commit and clean state');
    const committed = identity();
    assert.notEqual(committed.source.commit, previous.source.commit);
    assert.equal(committed.source.dirty, false);
    assert.equal(canReuseBuild(committed, directory), true);
    recordBuild(committed, directory, env);
    manifest(committed);
    assert.equal(canReuseBuild(committed, directory), true);

    manifest({ ...committed, source: { ...committed.source, commit: 'unverified' } });
    assert.equal(canReuseBuild(committed, directory), false);
    manifest(committed);
    const proofFile = proofPath(directory);
    const proof = fs.readFileSync(proofFile, 'utf8');
    fs.writeFileSync(proofFile, JSON.stringify({ ...JSON.parse(proof), identity: { ...committed, schemaVersion: 1 } }));
    assert.equal(canReuseBuild(committed, directory), false);
    fs.writeFileSync(proofFile, proof);
    for (const file of ['public/manual.pdf', 'scripts/build-helper.cjs', 'src/example.test.ts', 'tailwind.config.js']) {
        write(file, 'synthetic frontend input');
        assert.equal(canReuseBuild(identity(), directory), false, file);
        fs.unlinkSync(path.join(directory, file));
    }
    assert.equal(canReuseBuild(committed, directory), true);
});
