const test = require('node:test');
const assert = require('node:assert/strict');
const { compareRelease, sameSourceState, sourceState } = require('./release-manifest.cjs');
const base = { schemaVersion: 1, fingerprints: { hosting: 'a', functions: 'b', firestore: 'c', storage: 'd', deployment: 'e' }, assetManifestHash: 'bundle-a' };
test('production deployment fingerprints isolate staging config changes while preserving v1 comparison', t => {
  const fs = require('node:fs'), path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const { gitBackendFingerprints } = require('./release-manifest.cjs');
  const root = require('./release-test-fixture.cjs').releaseFixture(t, 'cy-config-history-');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  const commit = (file, text) => {
    fs.writeFileSync(path.join(root, file), text);
    git('add', '--', file);
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'config fixture');
    return git('rev-parse', 'HEAD');
  };
  const first = commit('firebase.json', '{}');
  const stage = commit('firebase.staging.json', '{"hosting":{"public":"build-staging"}}');
  const production = commit('firebase.json', '{"hosting":{"public":"other-build"}}');
  const fingerprint = (sha, format) => gitBackendFingerprints(sha, root, format).deployment;
  assert.equal(fingerprint(first), fingerprint(stage));
  assert.notEqual(fingerprint(first, 'git-tree-v1'), fingerprint(stage, 'git-tree-v1'));
  assert.notEqual(fingerprint(stage), fingerprint(production));
});
test('identifies server-only changes even when web assets match', () => {
  const result = compareRelease({ ...base, fingerprints: { ...base.fingerprints, functions: 'new' } }, base);
  assert.deepEqual(result.changed, ['functions']);
  assert.equal(result.hostingMatches, true);
});
test('does not accept missing legacy records as proof of deployment', () => {
  assert.equal(compareRelease(base, null).known, false);
  assert.equal(compareRelease(base, {}).hostingMatches, false);
});
test('detects changed compiled assets even with the same source fingerprints', () => {
  assert.equal(compareRelease({ ...base, assetManifestHash: 'bundle-b' }, base).hostingMatches, false);
  assert.deepEqual(compareRelease(base, base).changed, []);
});
test('rejects edits or commits made while a build is running', () => {
  const start = { ...base, commit: 'one', dirty: false };
  assert.equal(sameSourceState(start, { ...start, commit: 'two' }), false);
  assert.equal(sameSourceState(start, { ...start, fingerprints: { ...base.fingerprints, hosting: 'new' } }), false);
  assert.equal(sameSourceState(start, { ...start, dirty: true }), false);
  assert.equal(sameSourceState(start, start), true);
});

test('untracked feature and verification-script edits change release fingerprints; ignored scratch data does not', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const parent = path.resolve(os.tmpdir()), fixture = fs.mkdtempSync(path.join(parent, 'cy-release-test-'));
  try {
    execFileSync('git', ['init', '--quiet', fixture]);
    execFileSync('git', ['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'fixture'], { cwd: fixture });
    fs.mkdirSync(path.join(fixture, 'src')); fs.mkdirSync(path.join(fixture, 'scripts'));
    fs.writeFileSync(path.join(fixture, '.gitignore'), '.tmp/\n.env*\n');
    fs.writeFileSync(path.join(fixture, 'src/feature.ts'), 'export const value = 1;');
    const first = sourceState(fixture);
    fs.writeFileSync(path.join(fixture, 'src/feature.ts'), 'export const value = 2;');
    const second = sourceState(fixture); assert.equal(first.dirty, true); assert.equal(second.dirty, true);
    assert.notEqual(first.fingerprints.hosting, second.fingerprints.hosting); assert.equal(sameSourceState(first, second), false);
    fs.writeFileSync(path.join(fixture, 'scripts/check.cjs'), 'module.exports = true;');
    const third = sourceState(fixture); assert.notEqual(second.fingerprints.hosting, third.fingerprints.hosting);
    fs.mkdirSync(path.join(fixture, '.tmp')); fs.writeFileSync(path.join(fixture, '.tmp/log.txt'), 'synthetic scratch');
    fs.writeFileSync(path.join(fixture, '.env.local'), 'SYNTHETIC_ONLY=value');
    assert.deepEqual(sourceState(fixture).fingerprints, third.fingerprints);
  } finally {
    const target = path.resolve(fixture);
    assert.ok(target.startsWith(parent + path.sep) && path.basename(target).startsWith('cy-release-test-'));
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('clean backend fingerprints survive checkout line endings and change when committed backend content changes', t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cy-backend-git-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '--quiet');
  git('config', 'core.autocrlf', 'true');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Test Fixture');
  fs.writeFileSync(path.join(dir, '.gitattributes'), '* text=auto\n');
  const source = path.join(dir, 'functions/src/worker.ts');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, 'export const value = 1;\n');
  git('add', '.');
  git('commit', '-qm', 'initial backend');
  const before = sourceState(dir);
  fs.unlinkSync(source);
  git('checkout-index', '--force', '--', 'functions/src/worker.ts');
  assert.equal(fs.readFileSync(source, 'utf8'), 'export const value = 1;\r\n');
  git('add', '--', 'functions/src/worker.ts');
  const after = sourceState(dir);
  assert.equal(after.dirty, false);
  assert.equal(after.fingerprints.functions, before.fingerprints.functions);
  fs.writeFileSync(source, 'export const value = 2;\r\n');
  assert.equal(sourceState(dir).dirty, true);
  git('commit', '-qam', 'update backend');
  assert.notEqual(sourceState(dir).fingerprints.functions, before.fingerprints.functions);
});
