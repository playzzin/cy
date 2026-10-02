const test = require('node:test');
const assert = require('node:assert/strict');
const { ciTestArgs } = require('./react-scripts-test.cjs');

test('limits CI test workers while preserving selected tests and explicit concurrency', () => {
  assert.deepEqual(ciTestArgs(['--runTestsByPath', 'src/example.test.ts']), [
    '--watchAll=false', '--maxWorkers=2', '--runTestsByPath', 'src/example.test.ts',
  ]);
  for (const args of [['--runInBand'], ['-i'], ['--maxWorkers=4'], ['--maxWorkers', '50%'], ['-w', '3']]) {
    assert.deepEqual(ciTestArgs(args), ['--watchAll=false', ...args]);
  }
});
