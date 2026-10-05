const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { root, sourceState, sameSourceState } = require('./release-manifest.cjs');

const isWindows = process.platform === 'win32';

const jsonFiles = [
  'package.json',
  'firebase.json',
  'public/manifest.json',
  'functions/package.json',
];

const optionalJsonFiles = ['server/package.json'];

const commandSteps = [
  {
    name: 'TypeScript typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
  },
  {
    name: 'React test suite',
    command: 'npm',
    args: ['run', 'test:ci'],
  },
  {
    name: 'Firebase Functions build',
    command: 'npm',
    args: ['run', 'functions:build'],
  },
];

function runCommand({ name, command, args }) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${name} ==`);
    const startedAt = performance.now();
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: isWindows });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code !== 0 || signal) return reject(new Error(`${name} failed (${signal || code}).`));
      console.log(`${name} completed in ${((performance.now() - startedAt) / 1000).toFixed(1)}s.`);
      resolve();
    });
  });
}

function verificationScope(args) {
  const scopes = args.filter(arg => arg.startsWith('--scope='));
  const scope = scopes.length ? scopes[0].slice('--scope='.length) : 'all';
  if (scopes.length > 1 || !['all', 'hosting', 'functions'].includes(scope)) {
    throw new Error('사용법: verify:project [--scope=all|hosting|functions] [--parallel | --sequential] [--force-tests]');
  }
  return scope;
}

function parallelMode(args, { cpus = os.availableParallelism(), free = os.freemem(),
  total = os.totalmem(), ci = process.env.CI } = {}) {
  verificationScope(args);
  const allowed = new Set(['--parallel', '--sequential', '--force-tests', '--scope=all', '--scope=hosting', '--scope=functions']);
  if (args.some(arg => !allowed.has(arg)) || (args.includes('--parallel') && args.includes('--sequential'))) {
    throw new Error('사용법: verify:project [--scope=all|hosting|functions] [--parallel | --sequential] [--force-tests]');
  }
  if (args.includes('--sequential')) return false;
  if (args.includes('--parallel')) return true;
  // Keep small/CI runners on the established sequential path. At most two
  // independent lanes run locally; Jest keeps its existing two-worker limit.
  return !(ci && ci.toLowerCase() !== 'false') && cpus >= 4 && total >= 16 * 1024 ** 3 && free >= 8 * 1024 ** 3;
}

function verificationSteps(scope = 'all', forceTests = false) {
  verificationScope([`--scope=${scope}`]);
  const selected = scope === 'hosting' ? commandSteps.slice(0, 2)
    : scope === 'functions' ? commandSteps.slice(2) : commandSteps;
  const steps = selected.map(step => ({ ...step, args: [...step.args] }));
  const reactTests = steps.find(step => step.name === 'React test suite');
  if (forceTests && reactTests) reactTests.args.push('--', '--force');
  return steps;
}

async function runSteps({ scope = 'all', parallel = false, forceTests = false, execute = runCommand } = {}) {
  const steps = verificationSteps(scope, forceTests);
  if (!parallel) {
    for (const step of steps) await execute(step);
    return;
  }
  let failed = false;
  const lane = async selected => {
    for (const step of selected) {
      if (failed) return;
      try { await execute(step); }
      catch (error) { failed = true; throw error; }
    }
  };
  // Server compilation follows typechecking; the React tests run beside them.
  // Wait for already-running checks before returning failure, and never start
  // a later stage after failure. A caller cannot deploy on partial success.
  const results = await Promise.allSettled([
    lane(steps.filter(step => step.name !== 'React test suite')),
    lane(steps.filter(step => step.name === 'React test suite')),
  ]);
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
}

function verifyJsonFiles(scope) {
  console.log('== JSON syntax ==');
  const selected = scope === 'hosting' ? jsonFiles.filter(file => !file.startsWith('functions/'))
    : scope === 'functions' ? ['firebase.json', 'functions/package.json'] : jsonFiles;
  for (const file of selected) {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    console.log(`OK ${file}`);
  }
  for (const file of scope === 'all' ? optionalJsonFiles : []) {
    if (!fs.existsSync(path.join(root, file))) {
      console.log(`SKIP optional ${file}`);
      continue;
    }
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    console.log(`OK ${file}`);
  }
}

function warnIfJavaIsMissing() {
  const result = spawnSync('java', ['-version'], {
    stdio: 'ignore',
    shell: isWindows,
  });

  if (result.status !== 0) {
    console.warn('\nWARN Java was not found on PATH. Firestore/Storage emulator rule tests cannot run locally.');
  }
}

async function main(args = process.argv.slice(2)) {
  const parallel = parallelMode(args);
  const scope = verificationScope(args);
  const startedAt = performance.now();
  verifyJsonFiles(scope);
  if (scope !== 'hosting') warnIfJavaIsMissing();
  const before = sourceState();
  console.log(`검증 범위: ${scope}`);
  console.log(parallel && scope !== 'functions' ? '독립 검사 2개를 병렬 실행합니다.' : '검사를 순차 실행합니다.');
  await runSteps({ scope, parallel, forceTests: args.includes('--force-tests') });
  if (!sameSourceState(before, sourceState())) throw new Error('검사 중 코드가 바뀌었습니다. 배포 전에 다시 검사해 주세요.');
  console.log(`\nProject health checks passed (${((performance.now() - startedAt) / 1000).toFixed(1)}s).`);
}
module.exports = { parallelMode, verificationScope, verificationSteps, runSteps };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
