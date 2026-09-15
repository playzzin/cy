const test = require('node:test');
const assert = require('node:assert/strict');
const { compareRelease } = require('./release-manifest.cjs');
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
