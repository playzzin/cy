import { test } from 'node:test';
import { strict as assert } from 'assert';
import { parseWorkspaceRuntime, workspaceRuntimeAllows } from './runtime';
const valid = { version: 1, revision: 1, mode: 'pilot', pilotUids: ['pilot-b', 'pilot-a'], schedulerEnabled: true };
test('missing and malformed rollout configuration is off by default', () => {
  for (const input of [undefined, null, {}, { ...valid, version: 2 }, { ...valid, revision: 0 }, { ...valid, revision: '1' },
    { ...valid, mode: 'enabled' }, { ...valid, schedulerEnabled: 'true' }, { ...valid, pilotUids: ['one/two'] },
    { ...valid, pilotUids: [' account '] }, { ...valid, pilotUids: ['bad\nuid'] }, { ...valid, pilotUids: Array(21).fill('account') }]) {
    const result = parseWorkspaceRuntime(input); assert.equal(result.mode, 'off'); assert.equal(result.schedulerEnabled, false);
    assert.equal(workspaceRuntimeAllows(result, 'admin'), false);
  }
});
test('pilot allow-list is explicit, normalized and does not grant business permissions', () => {
  const result = parseWorkspaceRuntime({ ...valid, pilotUids: ['pilot-b', 'pilot-a', 'pilot-a'] });
  assert.deepEqual(result.pilotUids, ['pilot-a', 'pilot-b']);
  assert.equal(workspaceRuntimeAllows(result, 'pilot-a'), true); assert.equal(workspaceRuntimeAllows(result, 'admin'), false);
  assert.equal(workspaceRuntimeAllows(parseWorkspaceRuntime({ ...valid, pilotUids: [] }), 'pilot-a'), false);
});
test('automatic execution switch is independent of interactive access and global off wins', () => {
  const result = parseWorkspaceRuntime({ ...valid, mode: 'on', schedulerEnabled: false });
  assert.equal(workspaceRuntimeAllows(result, 'active-account'), true);
  assert.equal(workspaceRuntimeAllows(result, 'active-account', true), false);
  assert.equal(workspaceRuntimeAllows(parseWorkspaceRuntime({ ...valid, mode: 'off' }), 'pilot-a', true), false);
});
