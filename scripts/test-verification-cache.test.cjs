const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { MAX_AGE_MS, testIdentity, proofPath, runTests } = require('./test-verification-cache.cjs');

const passed = { success: true, wasInterrupted: false, numFailedTests: 0, numFailedTestSuites: 0,
  numRuntimeErrorTestSuites: 0, numTotalTests: 3, numPassedTests: 1, numPendingTests: 1, numTodoTests: 1,
  numTotalTestSuites: 1, numPassedTestSuites: 1, numPendingTestSuites: 0 };

function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'cy-test-proof-'));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith('cy-test-proof-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (name, value) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  write('.gitignore', 'node_modules/\n.env*\n');
  write('package.json', '{"name":"synthetic-test-proof","version":"1.0.0","private":true}');
  write('src/example.test.js', 'test("synthetic", () => expect(1).toBe(1));');
  write('node_modules/.package-lock.json', '{}');
  fs.symlinkSync(path.dirname(require.resolve('react-scripts/package.json')), path.join(root, 'node_modules/react-scripts'),
    process.platform === 'win32' ? 'junction' : 'dir');
  let calls = 0;
  const spawn = (_command, args, options) => {
    calls++;
    assert.equal(options.shell, false);
    assert.equal(options.env.NODE_ENV, 'test');
    assert.equal(options.env.npm_lifecycle_event, undefined);
    const outputIndex = args.indexOf('--outputFile');
    if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], JSON.stringify(passed));
    return { status: 0 };
  };
  const env = { PATH: process.env.PATH, SYNTHETIC_SETTING: 'a', npm_lifecycle_event: 'test:ci' };
  const options = { root, env, now: () => Date.parse('2026-10-05T03:00:00Z'), spawn, log: () => {} };
  const run = (args = [], overrides = {}) => runTests(args, { ...options, ...overrides });
  return { root, write, options, run, calls: () => calls };
}

test('only a successful full run is reused; proofs store counts and hashes, never environment values', t => {
  const f = fixture(t);
  assert.equal(f.run().reused, false);
  assert.equal(f.run().reused, true);
  assert.equal(f.calls(), 1);
  const proof = fs.readFileSync(proofPath(f.root), 'utf8');
  assert.ok(!proof.includes('SYNTHETIC_SETTING'));
  assert.ok(!proof.includes('example.test.js'));
  assert.equal(f.run([], { env: { ...f.options.env, npm_lifecycle_event: 'verify:project' } }).reused, true);
});

test('source, untracked fixtures, test settings, env files and installed dependencies invalidate reuse', t => {
  const f = fixture(t);
  f.run();
  for (const [name, value] of [
    ['src/example.test.js', '// changed test'], ['fixtures/new.json', '{"synthetic":true}'],
    ['package.json', '{"jest":{"resetMocks":true}}'], ['.env.test.local', 'SYNTHETIC_TEST_ONLY=value'],
    ['node_modules/.package-lock.json', '{"synthetic":true}'], ['scripts/helper.cjs', '// changed runner'],
  ]) {
    f.write(name, value);
    assert.equal(f.run().reused, false, name);
    assert.equal(f.run().reused, true, name);
  }
  fs.unlinkSync(path.join(f.root, 'src/example.test.js'));
  assert.equal(f.run().reused, false, 'deleted test');
  assert.equal(f.run([], { env: { ...f.options.env, SYNTHETIC_SETTING: 'b' } }).reused, false, 'environment');
});

test('forced runs, custom test arguments and CI never reuse an old success', t => {
  const f = fixture(t);
  f.run();
  assert.equal(f.run(['--force']).reused, false);
  for (const args of [['--runTestsByPath', 'src/example.test.js'], ['--listTests'], ['--passWithNoTests'], ['--maxWorkers=4']]) {
    f.run();
    assert.equal(f.run(args).reused, false);
    assert.equal(fs.existsSync(proofPath(f.root)), false);
  }
  f.run();
  assert.equal(f.run([], { env: { ...f.options.env, CI: 'true' } }).reused, false);
  assert.equal(fs.existsSync(proofPath(f.root)), false);
});

test('expired, future-dated and corrupt records fail closed', t => {
  const f = fixture(t);
  f.run();
  assert.equal(f.run([], { now: () => f.options.now() + MAX_AGE_MS }).reused, false);
  assert.equal(f.run().reused, false, 'future proof');
  f.write(path.relative(f.root, proofPath(f.root)), '{broken');
  assert.equal(f.run().reused, false);
  const proof = JSON.parse(fs.readFileSync(proofPath(f.root), 'utf8'));
  proof.summary.numPassedTests = 0;
  fs.writeFileSync(proofPath(f.root), JSON.stringify(proof));
  assert.equal(f.run().reused, false);
});

test('failures, interruption, empty/incomplete results and source changes cannot create a proof', t => {
  const f = fixture(t);
  for (const result of [{ status: 1 }, { status: null, signal: 'SIGTERM' }, { error: new Error('synthetic') }]) {
    f.run();
    assert.throws(() => f.run(['--force'], { spawn: () => result }), /테스트 실패/);
    assert.equal(fs.existsSync(proofPath(f.root)), false);
  }
  for (const report of [{}, { ...passed, wasInterrupted: true }, { ...passed, numPassedTests: 0 },
    { ...passed, numRuntimeErrorTestSuites: 1 }, { ...passed, numTotalTestSuites: 2 }]) {
    assert.throws(() => f.run([], { spawn: (_command, args) => {
      fs.writeFileSync(args[args.indexOf('--outputFile') + 1], JSON.stringify(report));
      return { status: 0 };
    } }), /통과 결과/);
    assert.equal(fs.existsSync(proofPath(f.root)), false);
  }
  assert.throws(() => f.run([], { spawn: (...args) => {
    f.write('src/changed-during-test.js', '// synthetic');
    return f.options.spawn(...args);
  } }), /테스트 중/);
  assert.equal(fs.existsSync(proofPath(f.root)), false);
});

test('missing dependency provenance executes without caching and live concurrent runs are blocked', t => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, 'node_modules/.package-lock.json'));
  assert.equal(f.run().reused, false);
  assert.equal(f.run().reused, false);
  assert.equal(fs.existsSync(proofPath(f.root)), false);
  assert.throws(() => f.run([], { spawn: () => {
    f.run();
    return { status: 0 };
  } }), /다른 테스트/);
  assert.equal(fs.existsSync(path.join(path.dirname(proofPath(f.root)), 'react-tests.lock')), false);
});

test('real CRA/Jest execution records a full success, reuses it and catches a later regression', t => {
  const f = fixture(t);
  const actual = (args = []) => f.run(args, { env: { ...process.env, CI: 'false' }, spawn: undefined });
  assert.equal(actual().reused, false);
  assert.equal(actual().reused, true);
  f.write('src/example.test.js', 'test("synthetic", () => expect(1).toBe(2));');
  assert.throws(() => actual(), /테스트 실패/);
  assert.equal(fs.existsSync(proofPath(f.root)), false);
});

test('date boundaries invalidate otherwise matching inputs', t => {
  const f = fixture(t);
  const a = testIdentity(f.root, f.options.env, Date.parse('2026-10-05T23:59:59Z'));
  const b = testIdentity(f.root, f.options.env, Date.parse('2026-10-06T00:00:01Z'));
  assert.notDeepEqual(a, b);
});

test('external fixtures, requested QA output and emulator tests always execute, including env-file settings', t => {
  const f = fixture(t);
  for (const key of ['EXCEL_FORMULA_GOLDEN', 'EXCEL_PAIR_SOURCE', 'EXCEL_CODE_QA_OUTPUT', 'CY_REQUEST_PREVIEW_DIR', 'FIRESTORE_EMULATOR_HOST']) {
    f.run();
    const env = { ...f.options.env, [key]: 'synthetic-external-input' };
    assert.equal(f.run([], { env }).reused, false);
    assert.equal(f.run([], { env }).reused, false);
    assert.equal(fs.existsSync(proofPath(f.root)), false);
  }
  f.write('.env.test.local', 'EXCEL_PAIR_TARGET=synthetic-external-input');
  assert.equal(f.run().reused, false);
  assert.equal(fs.existsSync(proofPath(f.root)), false);
});
