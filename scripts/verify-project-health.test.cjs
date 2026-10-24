const test = require('node:test');
const assert = require('node:assert/strict');
const { parallelMode, verificationScope, runSteps } = require('./verify-project-health.js');

const roomy = { cpus: 8, free: 16 * 1024 ** 3, total: 32 * 1024 ** 3, ci: '' };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('automatic parallelism is bounded to capable local machines with an explicit sequential fallback', () => {
  assert.equal(parallelMode([], roomy), true);
  for (const resources of [{ cpus: 2 }, { free: 2 * 1024 ** 3 }, { total: 8 * 1024 ** 3 }, { ci: 'true' }]) {
    assert.equal(parallelMode([], { ...roomy, ...resources }), false);
  }
  assert.equal(parallelMode(['--sequential'], roomy), false);
  assert.equal(parallelMode(['--parallel'], { ...roomy, cpus: 2 }), true);
  assert.throws(() => parallelMode(['--parallel', '--sequential'], roomy), /사용법/);
  assert.throws(() => parallelMode(['--skip-tests'], roomy), /사용법/);
});

test('sequential mode preserves every check and stops before later stages on failure', async () => {
  const calls = [];
  await runSteps({ execute: async step => calls.push(step.args.join(' ')) });
  assert.deepEqual(calls, ['run typecheck', 'run test:ci', 'run functions:build']);
  calls.length = 0;
  await assert.rejects(runSteps({ execute: async step => {
    calls.push(step.name);
    throw new Error('synthetic failure');
  } }), /synthetic failure/);
  assert.deepEqual(calls, ['TypeScript typecheck']);
});

test('parallel mode overlaps only independent lanes and waits for every check', async () => {
  const typecheck = deferred();
  const react = deferred();
  const calls = [];
  let completed = false;
  const run = runSteps({ parallel: true, forceTests: true, execute: step => {
    calls.push(step.args.join(' '));
    if (step.name === 'TypeScript typecheck') return typecheck.promise;
    if (step.name === 'React test suite') return react.promise;
    return Promise.resolve();
  } }).then(() => { completed = true; });
  assert.deepEqual(calls, ['run typecheck', 'run test:ci -- --force']);
  typecheck.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[2], 'run functions:build');
  assert.equal(completed, false);
  react.resolve();
  await run;
  assert.equal(completed, true);
});

test('a parallel failure blocks later steps and waits for an in-flight check before rejecting', async () => {
  const typecheck = deferred();
  const react = deferred();
  const calls = [];
  let settled = false;
  const run = runSteps({ parallel: true, execute: step => {
    calls.push(step.name);
    return step.name === 'TypeScript typecheck' ? typecheck.promise : react.promise;
  } });
  const rejected = assert.rejects(run, /synthetic failure/).then(() => { settled = true; });
  react.reject(new Error('synthetic failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  typecheck.resolve();
  await rejected;
  assert.deepEqual(calls, ['TypeScript typecheck', 'React test suite']);
});

test('scoped verification excludes unrelated builds in both execution modes', async () => {
  for (const parallel of [false, true]) {
    for (const [scope, expected] of [
      ['hosting', ['run typecheck', 'run test:ci -- --force']],
      ['functions', ['run functions:build']],
    ]) {
      const calls = [];
      await runSteps({ scope, parallel, forceTests: true, execute: async step => calls.push(step.args.join(' ')) });
      assert.deepEqual(calls, expected);
    }
  }
});

test('unknown or conflicting scopes never weaken the default full verification', async () => {
  assert.equal(verificationScope([]), 'all');
  assert.equal(verificationScope(['--scope=hosting']), 'hosting');
  assert.equal(parallelMode(['--scope=hosting'], roomy), true);
  for (const args of [['--scope='], ['--scope=rules'], ['--scope=hosting', '--scope=functions'], ['--skip-tests']]) {
    assert.throws(() => parallelMode(args, roomy), /사용법/);
  }
  let executed = false;
  await assert.rejects(runSteps({ scope: 'unknown', execute: async () => { executed = true; } }), /사용법/);
  assert.equal(executed, false);
});
