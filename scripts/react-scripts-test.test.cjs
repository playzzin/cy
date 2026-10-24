const test = require('node:test');
const assert = require('node:assert/strict');
const { ciTestArgs } = require('./react-scripts-test.cjs');
const ordinaryWorkspace = { platform: 'win32', cwd: 'C:\\projects\\cy' };

test('limits CI test workers while preserving selected tests and explicit concurrency', () => {
  assert.deepEqual(ciTestArgs(['--runTestsByPath', 'src/example.test.ts'], ordinaryWorkspace), [
    '--watchAll=false', '--maxWorkers=2', '--runTestsByPath', 'src/example.test.ts',
  ]);
  for (const args of [['--runInBand'], ['-i'], ['--maxWorkers=4'], ['--maxWorkers', '50%'], ['-w', '3']]) {
    assert.deepEqual(ciTestArgs(args, ordinaryWorkspace), ['--watchAll=false', ...args]);
  }
});

test('finds both __tests__ and named tests in Windows worktrees with dotted paths', () => {
  const args = ciTestArgs(['--runInBand'], { platform: 'win32', cwd: 'C:\\Users\\person\\.codex\\worktrees\\cy' });
  assert.deepEqual(args.filter(arg => arg.startsWith('--testMatch=')), [
    '--testMatch=**/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '--testMatch=**/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ]);
  assert.ok(args.includes('--runInBand'));
  assert.ok(!args.some(arg => arg.startsWith('--passWithNoTests')));
});

test('preserves explicit patterns and non-Windows test discovery', () => {
  const worktree = { platform: 'win32', cwd: 'C:/Users/person/.codex/worktrees/cy' };
  for (const pattern of ['--testMatch=**/custom.test.ts', '--testRegex=custom']) {
    assert.deepEqual(ciTestArgs([pattern], worktree), ['--watchAll=false', '--maxWorkers=2', pattern]);
  }
  assert.deepEqual(ciTestArgs([], { platform: 'linux', cwd: '/home/person/.codex/cy' }), ['--watchAll=false', '--maxWorkers=2']);
});
