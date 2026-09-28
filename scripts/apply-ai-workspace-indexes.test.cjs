const test = require('node:test'), assert = require('node:assert/strict');
const { desiredIndexes, missingIndexes } = require('./apply-ai-workspace-indexes.cjs');
const config = require('../firestore.indexes.json');
test('only the eleven workspace indexes are selected even when unrelated indexes exist', () => {
  const desired = desiredIndexes(config); assert.equal(desired.length, 11);
  assert.ok(desired.every(index => !index.collectionGroup.startsWith('notice')));
  assert.throws(() => desiredIndexes({ indexes: [] }), /missing/);
});
test('ready and building indexes are retained; implicit document-name ordering does not create duplicates', () => {
  const desired = desiredIndexes(config);
  const existing = desired.map((index, i) => ({ ...index, state: i % 2 ? 'CREATING' : 'READY', fields: [...index.fields, { fieldPath: '__name__', order: 'ASCENDING' }] }));
  assert.deepEqual(missingIndexes(desired, existing), []);
  assert.deepEqual(missingIndexes(desired, existing.slice(1)), [desired[0]]);
});
test('different sort direction and collection scope do not count as the required index', () => {
  const desired = desiredIndexes(config).slice(0, 1);
  assert.equal(missingIndexes(desired, [{ ...desired[0], queryScope: 'COLLECTION_GROUP' }]).length, 1);
  assert.equal(missingIndexes(desired, [{ ...desired[0], fields: desired[0].fields.map(field => ({ ...field, order: 'DESCENDING' })) }]).length, 1);
});
