import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { fixturePlan } from './fixtures';
import { validatePlan } from './domain';
import { reusablePlan } from './savedAnalyses';
import { resolveSavedCommand, SavedSelection } from './savedCommands';
import { savedCommandItems, savedCommandPlan } from './savedCommandFixtures';

const selection = (): SavedSelection => ({ id: 'choice-token', accessHash: 'own-access', expiresAt: '2026-09-29T00:00:00Z', refs: [{ id: 'saved-monthly', revision: 1 }] });
const previous = (items = savedCommandItems(), value: unknown = selection(), token: unknown = 'choice-token', hash = 'own-access', now = Date.parse('2026-09-28')) =>
  resolveSavedCommand(items, savedCommandPlan('savedRun', '', true), value, token, hash, now);

test('saved commands validate separately and cannot silently override saved filters or output settings', () => {
  const plan = savedCommandPlan(); assert.deepEqual(validatePlan(plan), plan);
  for (const patch of [{ saved: null }, { saved: { query: 'x', usePrevious: true } }, { saved: { query: 'x'.repeat(61), usePrevious: false } },
    { saved: { query: '', usePrevious: false, id: 'forged' } }, { filters: [{ entity: 'team', id: 't1', name: '1팀' }] }, { comparison: plan.range },
    { report: { ...plan.report, format: 'pdf' } }, { report: { ...plan.report, includeAmount: false } }, { dataset: 'teamSettlements' }, { sortBy: 'amount' }])
    assert.throws(() => validatePlan({ ...plan, ...patch }));
  assert.throws(() => reusablePlan(plan));
  assert.throws(() => validatePlan({ ...fixturePlan(), saved: plan.saved }));
  assert.deepEqual(validatePlan({ ...fixturePlan(), saved: null }), fixturePlan());
});
test('find lists all or literal matching names without executing or changing items', () => {
  const items = savedCommandItems(), before = JSON.stringify(items);
  assert.equal(resolveSavedCommand(items, savedCommandPlan()).matches.length, 2);
  const found = resolveSavedCommand(items, savedCommandPlan('savedFind', '현장'));
  assert.equal(found.matches.length, 1); assert.equal(found.run, null);
  assert.equal(resolveSavedCommand(items, savedCommandPlan('savedFind', '[.*]')).matches.length, 0);
  assert.equal(JSON.stringify(items), before);
});
test('clarification discards a retained saved name without authorizing a lookup or execution', () => {
  const clarified = validatePlan({ ...savedCommandPlan('savedRun', '월간 현장 보고'), operation: 'clarify', clarification: '먼저 저장 조건으로 실행해 주세요.' });
  assert.equal(clarified.operation, 'clarify'); assert.equal(clarified.saved, undefined);
  assert.throws(() => resolveSavedCommand(savedCommandItems(), clarified));
});
test('only a unique exact normalized name runs immediately; partial, blank and duplicate names require selection', () => {
  const items = savedCommandItems();
  assert.equal(resolveSavedCommand(items, savedCommandPlan('savedRun', ' 월간현장보고 ')).run?.id, 'saved-monthly');
  for (const query of ['', '월간', '현장', '없는 이름']) assert.equal(resolveSavedCommand(items, savedCommandPlan('savedRun', query)).run, null);
  items.push({ ...items[0], id: 'duplicate', name: '월간현장보고' });
  const duplicate = resolveSavedCommand(items, savedCommandPlan('savedRun', '월간 현장 보고'));
  assert.equal(duplicate.matches.length, 2); assert.equal(duplicate.run, null);
});
test('a single previous candidate uses server-owned id and revision rather than a model-supplied name', () => {
  assert.equal(previous().run?.id, 'saved-monthly');
  const context = selection(); context.refs.push({ id: 'saved-evidence', revision: 1 });
  const multiple = previous(undefined, context); assert.equal(multiple.run, null); assert.equal(multiple.matches.length, 2);
  context.refs = []; assert.equal(previous(undefined, context).matches.length, 0);
});
test('expired, foreign, missing, superseded and malformed selection tokens fail closed', () => {
  assert.throws(() => resolveSavedCommand(savedCommandItems(), savedCommandPlan('savedRun', '', true)), /선택/);
  for (const context of [null, {}, { ...selection(), refs: [null] }, { ...selection(), expiresAt: 'bad' }, { ...selection(), accessHash: 'foreign' },
    { ...selection(), refs: Array(21).fill({ id: 'saved-monthly', revision: 1 }) }]) assert.throws(() => previous(undefined, context), /선택/);
  assert.throws(() => previous(undefined, selection(), 'old-token'), /선택/);
  assert.throws(() => previous(undefined, selection(), 'choice-token', 'changed-access'), /선택/);
  assert.throws(() => previous(undefined, selection(), 'choice-token', 'own-access', Date.parse('2026-09-29')), /선택/);
});
test('changed revision or removed candidate cannot execute stale or substitute conditions', () => {
  const items = savedCommandItems(); items[0].revision++;
  assert.throws(() => previous(items), /변경되었거나 삭제/);
  assert.throws(() => previous(items.slice(1)), /변경되었거나 삭제/);
});
