const test = require('node:test');
const assert = require('node:assert/strict');
const { selectedTarget, deploySelected } = require('./deploy-selected.cjs');
const { main: deployHosting, assertReleaseAncestry } = require('./deploy-verified.cjs');

const state = { commit: 'synthetic-commit', dirty: false, fingerprints: {
  hosting: 'web', functions: 'server', firestore: 'rules', storage: 'storage', deployment: 'config',
} };
const remote = { ...state, schemaVersion: 1, assetManifestHash: 'assets' };
const fail = () => { throw new Error('Unexpected side effect'); };
const quiet = () => {};

test('deploy:main requires the same pushed commit before checks and again before uploading', async () => {
  assert.equal(require('../package.json').scripts['deploy:main'], 'node scripts/deploy-verified.cjs --require-main');
  const commit = 'a'.repeat(40), other = 'b'.repeat(40);
  const calls = [];
  const options = { getState: () => ({ ...state, commit }), readRemote: async () => ({ ...remote, commit }),
    execute: (_cmd, args) => calls.push(args), verifyRelease: quiet, log: quiet };
  await assert.rejects(deployHosting(['--require-main'], { ...options, readMain: () => other }), /GitHub main/);
  assert.equal(calls.length, 0);
  let reads = 0;
  await assert.rejects(deployHosting(['--require-main'], { ...options, readMain: () => ++reads === 1 ? commit : other }), /GitHub main/);
  assert.equal(calls.length, 1);
  calls.length = 0;
  await deployHosting(['--require-main'], { ...options, readMain: () => commit });
  assert.equal(calls.length, 2);
});

test('npm entrypoints keep both old and new deployment commands on scoped paths', () => {
  const app = require('../package.json').scripts;
  const functions = require('../functions/package.json').scripts;
  assert.equal(app['release:deploy'], app['deploy:hosting']);
  assert.equal(app['release:deploy'], app['deploy:main']);
  assert.equal(app['deploy:functions'], 'node scripts/deploy-selected.cjs functions');
  assert.equal(app['deploy:rules'], 'node scripts/deploy-selected.cjs firestore:rules');
  assert.equal(functions.deploy, 'node ../scripts/deploy-selected.cjs functions');
  const config = require('../firebase.json');
  assert.deepEqual(config.functions.predeploy, ['npm --prefix functions run build']);
  assert.equal(config.hosting.predeploy.filter(command => command === 'npm run build').length, 1);
});

test('release checks use the registered CY transport, including SSH, and never trust another repository', () => {
  const { publishedRemote } = require('./published-main.cjs');
  for (const remote of ['https://github.com/playzzin/cy.git', 'git@github.com:playzzin/cy.git', 'ssh://git@github.com/playzzin/cy']) {
    assert.equal(publishedRemote(remote), 'origin');
  }
  for (const remote of ['', 'https://example.test/playzzin/cy', 'git@github.com:someone/cy.git']) {
    assert.equal(publishedRemote(remote), 'https://github.com/playzzin/cy.git');
  }
});

test('the last production predeploy hook checks the built and published commits after the long build', async () => {
  const { verifyMainBuild } = require('./published-main.cjs');
  const commit = 'a'.repeat(40), built = { ...remote, commit, dirty: false };
  let childOptions;
  await deployHosting(['--require-main'], { getState: () => ({ ...state, commit }), readRemote: async () => built,
    readMain: () => commit, verifyRelease: quiet, log: quiet,
    execute: (_command, args, options) => { if (args.includes('--only')) childOptions = options; } });
  const expected = childOptions.env.CY_DEPLOY_MAIN_COMMIT;
  assert.equal(expected, commit);
  assert.match(require('../firebase.json').hosting.predeploy.at(-1), /verify-hosting-target\.cjs production$/);
  assert.doesNotThrow(() => verifyMainBuild(expected, built, () => commit));
  assert.throws(() => verifyMainBuild(expected, built, () => 'b'.repeat(40)), /GitHub main/);
  assert.throws(() => verifyMainBuild(expected, { ...built, dirty: true }, fail), /빌드한 커밋/);
  assert.throws(() => verifyMainBuild(expected, { ...built, commit: 'different' }, fail), /빌드한 커밋/);
});

test('v1 records allow staging-only config changes after checking the recorded hash, while production changes still block', async () => {
  const { backendFingerprintFormat } = require('./release-manifest.cjs');
  const current = { ...state, backendFingerprintFormat };
  const v1 = { ...remote, dirty: false, backendFingerprintFormat: 'git-tree-v1',
    fingerprints: { ...remote.fingerprints, deployment: 'recorded-v1' } };
  const options = { getState: () => current, readRemote: async () => v1,
    getBackendFingerprints: (_sha, _root, format) => ({ deployment: format === 'git-tree-v1' ? 'recorded-v1' : current.fingerprints.deployment }),
    execute: quiet, verifyRelease: quiet, log: quiet };
  await deployHosting([], options);
  await assert.rejects(deployHosting([], { ...options, execute: fail,
    getBackendFingerprints: (_sha, _root, format) => ({ deployment: format === 'git-tree-v1' ? 'recorded-v1' : 'different-prod' }),
  }), /서버·설정 변경.*deployment/);
  await assert.rejects(deployHosting([], { ...options, execute: fail,
    readRemote: async () => ({ ...v1, fingerprints: { ...v1.fingerprints, deployment: 'incorrect-record' } }),
  }), /서버·설정 변경.*deployment/);
  await assert.rejects(deployHosting([], { ...options, execute: fail,
    readRemote: async () => ({ ...v1, fingerprints: { ...v1.fingerprints, firestore: 'changed' } }),
  }), /서버·설정 변경.*firestore/);
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

test('initializing cannot bypass a network failure or overwrite a release created during checks', async () => {
  const options = { getState: () => state, log: quiet, execute: fail, verifyRelease: fail };
  await assert.rejects(deployHosting(['--initialize-record'], {
    ...options, readRemote: async () => { throw new Error('ENOTFOUND'); },
  }), /이전 배포 기록.*ENOTFOUND/);
  let calls = 0, reads = 0;
  await assert.rejects(deployHosting(['--initialize-record'], {
    ...options, execute: () => { calls++; }, readRemote: async () => ++reads === 1 ? null : remote,
  }), /검사 중 운영 배포 버전/);
  assert.equal(calls, 1);
});

test('a clean legacy release is compared against its recorded Git backend sources; real backend changes still block', async () => {
  const { backendFingerprintFormat } = require('./release-manifest.cjs');
  const current = { ...state, backendFingerprintFormat };
  const legacy = { ...remote, fingerprints: { ...remote.fingerprints, functions: 'raw-checkout-hash' } };
  const { hosting, ...server } = current.fingerprints;
  const options = { getState: () => current, readRemote: async () => legacy, verifyRelease: quiet, log: quiet };
  const calls = [];
  await deployHosting([], { ...options, execute: quiet, getBackendFingerprints: commit => { calls.push(commit); return server; } });
  assert.deepEqual(calls, [legacy.commit]);
  await assert.rejects(deployHosting([], { ...options, execute: fail,
    getBackendFingerprints: () => ({ ...server, functions: 'different-git-blob' }),
  }), /서버·설정 변경.*functions/);
  await assert.rejects(deployHosting([], { ...options, execute: fail, getBackendFingerprints: fail,
    readRemote: async () => ({ ...legacy, backendFingerprintFormat }),
  }), /서버·설정 변경.*functions/);
});

test('hosting blocks stale or unrelated releases even when backend fingerprints match', async () => {
  const localCommit = 'a'.repeat(40), remoteCommit = 'b'.repeat(40);
  const gitCalls = [];
  assertReleaseAncestry(localCommit, remoteCommit, args => { gitCalls.push(args); return { status: 0 }; });
  assert.deepEqual(gitCalls, [['merge-base', '--is-ancestor', remoteCommit, localCommit]]);
  assert.throws(() => assertReleaseAncestry(localCommit, remoteCommit, () => ({ status: 1 })), /운영 변경을 먼저 합쳐/);
  assert.throws(() => assertReleaseAncestry(localCommit, remoteCommit, () => ({ status: 128 })), /Git 이력/);
  assert.throws(() => assertReleaseAncestry(localCommit, '--unsafe', fail), /형식/);
  assert.throws(() => assertReleaseAncestry(localCommit, undefined, fail), /배포 커밋/);
  for (const args of [[], ['--initialize-record']]) {
    await assert.rejects(deployHosting(args, {
      getState: () => ({ ...state, commit: localCommit }),
      readRemote: async () => ({ ...remote, commit: remoteCommit }),
      checkAncestry: (local, deployed) => assertReleaseAncestry(local, deployed, () => ({ status: 1 })),
      execute: fail, verifyRelease: fail, log: quiet,
    }), /운영 변경을 먼저 합쳐/);
  }
});

test('hosting stops if production changes while verification is running', async () => {
  let reads = 0;
  const calls = [];
  await assert.rejects(deployHosting([], {
    getState: () => state,
    readRemote: async () => ({ ...remote, commit: reads++ ? 'new-release' : state.commit }),
    checkAncestry: quiet, execute: (...args) => calls.push(args), verifyRelease: fail, log: quiet,
  }), /검사 중 운영 배포 버전/);
  assert.equal(calls.length, 1, 'must stop before invoking Firebase');
});
