const test = require('node:test');
const assert = require('node:assert/strict');
const { selectedTarget, deploySelected } = require('./deploy-selected.cjs');
const { main: deployHosting } = require('./deploy-verified.cjs');

const state = { commit: 'synthetic-commit', dirty: false, fingerprints: {
  hosting: 'web', functions: 'server', firestore: 'rules', storage: 'storage', deployment: 'config',
} };
const remote = { ...state, schemaVersion: 1, assetManifestHash: 'assets' };
const fail = () => { throw new Error('Unexpected side effect'); };
const quiet = () => {};

test('npm entrypoints keep both old and new deployment commands on scoped paths', () => {
  const app = require('../package.json').scripts;
  const functions = require('../functions/package.json').scripts;
  assert.equal(app['release:deploy'], app['deploy:hosting']);
  assert.equal(app['deploy:functions'], 'node scripts/deploy-selected.cjs functions');
  assert.equal(app['deploy:rules'], 'node scripts/deploy-selected.cjs firestore:rules');
  assert.equal(functions.deploy, 'node ../scripts/deploy-selected.cjs functions');
  const config = require('../firebase.json');
  assert.deepEqual(config.functions.predeploy, ['npm --prefix functions run build']);
  assert.equal(config.hosting.predeploy.filter(command => command === 'npm run build').length, 1);
});

test('function deployment requires explicit names and cannot broaden to all services', () => {
  assert.equal(selectedTarget(['functions', 'first', 'second', 'first']).only, 'functions:first,functions:second');
  for (const args of [[], ['functions'], ['functions', '--dry-run'], ['functions', '*'],
    ['functions', 'first,hosting'], ['functions', '--force'], ['functions', 'functions:first'],
    ['functions', 'first', '--project=other'], ['firestore'], ['firestore:rules', '--only=hosting']]) {
    assert.throws(() => selectedTarget(args));
  }
});

test('backend dry runs work on dirty workspaces without reading state or running any command', () => {
  for (const target of [['functions', 'first'], ['firestore:rules'], ['firestore:indexes'], ['storage']]) {
    const command = deploySelected([...target, '--dry-run'], {
      project: 'demo-test', getState: fail, execute: fail, log: quiet,
    });
    assert.ok(command.args.includes('--config'));
    assert.equal(command.args[command.args.indexOf('--project') + 1], 'demo-test');
    assert.equal(command.args.includes('hosting'), false);
    assert.equal(command.args.includes('--force'), false);
  }
});

test('backend deploy invokes only Firebase once and preserves the service predeploy hooks', () => {
  for (const [args, only] of [[['functions', 'first', 'second'], 'functions:first,functions:second'],
    [['firestore:rules'], 'firestore:rules'], [['firestore:indexes'], 'firestore:indexes'], [['storage'], 'storage']]) {
    const calls = [];
    deploySelected(args, { project: 'demo-test', getState: () => state, log: quiet,
      execute: (command, values) => calls.push(values) });
    assert.equal(calls.length, 1, 'no extra React checks or duplicate server build');
    assert.equal(calls[0][calls[0].indexOf('--only') + 1], only);
    assert.equal(calls[0].includes('--non-interactive'), true);
  }
});

test('backend failures and uncommitted sources are never reported as successful deployment', () => {
  assert.throws(() => deploySelected(['firestore:rules'], {
    project: 'demo-test', getState: () => ({ ...state, dirty: true }), execute: fail, log: quiet,
  }), /커밋/);
  assert.throws(() => deploySelected(['functions', 'first'], {
    project: 'demo-test', getState: () => state, execute: () => { throw new Error('deploy failed'); }, log: quiet,
  }), /deploy failed/);
  let reads = 0;
  assert.throws(() => deploySelected(['firestore:rules'], {
    project: 'demo-test', getState: () => reads++ ? { ...state, commit: 'changed' } : state,
    execute: quiet, log: quiet,
  }), /배포 중 코드/);
});

test('hosting dry run neither contacts production nor executes checks or builds', async () => {
  const invocation = await deployHosting(['--dry-run'], {
    getState: fail, execute: fail, readRemote: fail, verifyRelease: fail, log: quiet,
  });
  assert.equal(invocation.args[invocation.args.indexOf('--only') + 1], 'hosting');
});

test('hosting keeps frontend checks, a single hooked build and final release verification in order', async () => {
  const calls = [];
  await deployHosting([], { getState: () => state, readRemote: async () => remote, log: quiet,
    execute: (command, args) => calls.push(args), verifyRelease: async () => calls.push('verified') });
  assert.equal(calls.length, 3);
  assert.match(calls[0][0], /verify-project-health\.js$/);
  assert.equal(calls[0][1], '--scope=hosting');
  assert.equal(calls[1][calls[1].indexOf('--only') + 1], 'hosting');
  assert.equal(calls[2], 'verified');
});

test('hosting still rejects backend drift, missing records, dirty sources and failed checks', async () => {
  const options = { getState: () => state, readRemote: async () => remote,
    execute: fail, verifyRelease: fail, log: quiet };
  for (const group of ['functions', 'firestore', 'storage', 'deployment']) {
    await assert.rejects(deployHosting([], { ...options,
      readRemote: async () => ({ ...remote, fingerprints: { ...remote.fingerprints, [group]: 'different' } }),
    }), /서버·설정 변경/);
  }
  await assert.rejects(deployHosting([], { ...options, readRemote: async () => null }), /서버·설정 변경/);
  await assert.rejects(deployHosting([], { ...options, readRemote: async () => { throw new Error('offline'); } }), /이전 배포 기록/);
  await assert.rejects(deployHosting([], { ...options, getState: () => ({ ...state, dirty: true }) }), /커밋/);
  await assert.rejects(deployHosting(['--skip-tests'], options), /사용법/);
  const calls = [];
  await assert.rejects(deployHosting([], { ...options, execute: (command, args) => {
    calls.push(args); throw new Error('verification failed');
  } }), /verification failed/);
  assert.equal(calls.length, 1);
});

test('hosting refuses deployment if source changes during checks and propagates postdeploy failure', async () => {
  const calls = [];
  let reads = 0;
  await assert.rejects(deployHosting([], {
    getState: () => reads++ ? { ...state, commit: 'changed' } : state,
    readRemote: async () => remote, execute: (command, args) => calls.push(args), verifyRelease: fail, log: quiet,
  }), /검사 전후 코드/);
  assert.equal(calls.length, 1);
  await assert.rejects(deployHosting([], { getState: () => state, readRemote: async () => remote,
    execute: quiet, verifyRelease: async () => { throw new Error('release mismatch'); }, log: quiet,
  }), /release mismatch/);
});
