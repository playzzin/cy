const test = require('node:test');
const assert = require('node:assert/strict');
const { compareRelease, sameSourceState, sourceState } = require('./release-manifest.cjs');
const base = { schemaVersion: 1, fingerprints: { hosting: 'a', functions: 'b', firestore: 'c', storage: 'd', deployment: 'e' }, assetManifestHash: 'bundle-a' };
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
