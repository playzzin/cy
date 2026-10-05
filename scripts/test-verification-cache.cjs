const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { workspaceCache } = require('./build-performance.cjs');
const { ciTestArgs } = require('./react-scripts-test.cjs');

const MAX_AGE_MS = 60 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const proofPath = root => path.join(workspaceCache(root), 'react-tests-success.json');
const isCI = env => Boolean(env.CI && env.CI.toLowerCase() !== 'false');

function fileDigest(file) {
  try { return digest(fs.readFileSync(file)); }
  catch (error) { if (error.code === 'ENOENT') return 'missing'; throw error; }
}

function inputFingerprint(root, files) {
  const present = files.filter(file => fs.existsSync(path.join(root, file)));
  // Batch content hashing through Git avoids thousands of expensive individual
  // Windows file reads. --no-filters hashes the exact bytes, never runs clean
  // filters, and without -w this does not write to the Git object database.
  const hashes = execFileSync('git', ['hash-object', '--no-filters', '--stdin-paths'], {
    cwd: root, input: present.map(file => JSON.stringify(file)).join('\n') + '\n',
    maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  }).toString().trim().split('\n');
  if (hashes.length !== present.length || hashes.some(value => !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value))) {
    throw new Error('입력 파일 내용을 모두 확인하지 못했습니다.');
  }
  const byFile = new Map(present.map((file, index) => [file, hashes[index]]));
  return digest(files.map(file => `${file}\0${byFile.get(file) || 'missing'}`).join('\n'));
}

function externalTestMode(root, env) {
  const keys = new Set(Object.keys(env).filter(key => env[key]));
  // These optional tests read external workbooks, create requested QA outputs,
  // or contact emulators. Execute them every time, including settings from CRA
  // env files, because their state is not covered by a repository fingerprint.
  for (const file of ['.env', '.env.test', '.env.test.local']) {
    const filename = path.join(root, file);
    if (!fs.existsSync(filename)) continue;
    const values = require('dotenv').parse(fs.readFileSync(filename));
    for (const [key, value] of Object.entries(values)) if (value) keys.add(key);
  }
  return [...keys].some(key => /^(?:EXCEL_|CY_REQUEST_PREVIEW_DIR$)|_EMULATOR_HOST$/.test(key));
}

function testIdentity(root, env = process.env, now = Date.now()) {
  // Include every tracked/untracked non-ignored input, including fixtures and
  // config outside src. Git-ignored build outputs and the proof are excluded.
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(Boolean);
  const files = [...new Set([...listed, '.env', '.env.test', '.env.test.local'])].sort();
  const installedLock = path.join(root, 'node_modules', '.package-lock.json');
  if (!fs.existsSync(installedLock)) throw new Error('설치된 의존성 확인 기록이 없습니다.');
  const environment = { ...env, NODE_ENV: 'test', BABEL_ENV: 'test', PUBLIC_URL: '' };
  // These describe the npm caller, not the test environment. Removing them
  // from BOTH the child and the identity enables direct/health-check reuse.
  for (const key of ['npm_lifecycle_event', 'npm_lifecycle_script', 'npm_command']) delete environment[key];
  const date = new Date(now);
  return {
    schemaVersion: 1,
    workspace: fs.realpathSync(root),
    inputs: inputFingerprint(root, files),
    dependencies: fileDigest(installedLock),
    runtime: [process.version, process.platform, process.arch, ...process.execArgv],
    // Hash values; never persist environment contents or test output in proofs.
    environment: digest(JSON.stringify(Object.keys(environment).sort().map(key => [key, environment[key]]))),
    day: [date.getFullYear(), date.getMonth(), date.getDate(), date.getTimezoneOffset(), date.toISOString().slice(0, 10)],
  };
}

function passedSummary(report) {
  const keys = ['numTotalTests', 'numPassedTests', 'numPendingTests', 'numTodoTests',
    'numTotalTestSuites', 'numPassedTestSuites', 'numPendingTestSuites'];
  if (!report || report.success !== true || report.wasInterrupted === true
      || report.numFailedTests !== 0 || report.numFailedTestSuites !== 0 || report.numRuntimeErrorTestSuites !== 0
      || !keys.every(key => Number.isInteger(report[key]) && report[key] >= 0)
      || report.numPassedTests === 0 || report.numPassedTestSuites === 0
      || report.numTotalTests !== report.numPassedTests + report.numPendingTests + report.numTodoTests
      || report.numTotalTestSuites !== report.numPassedTestSuites + report.numPendingTestSuites) return null;
  return Object.fromEntries(keys.map(key => [key, report[key]]));
}

function reusableProof(file, identity, now) {
  try {
    const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
    return proof.schemaVersion === 1 && proof.identity === digest(JSON.stringify(identity))
      && Number.isFinite(proof.completedAt) && proof.completedAt <= now && now - proof.completedAt < MAX_AGE_MS
      && passedSummary({ ...proof.summary, success: true, numFailedTests: 0,
        numFailedTestSuites: 0, numRuntimeErrorTestSuites: 0 }) ? proof : null;
  } catch { return null; }
}

function acquireLock(directory) {
  const file = path.join(directory, 'react-tests.lock');
  try {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Number.isInteger(existing.pid) || existing.pid <= 0) throw new Error('테스트 잠금 기록이 올바르지 않습니다.');
    try { process.kill(existing.pid, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw error;
      fs.unlinkSync(file);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const token = crypto.randomUUID();
  try { fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('같은 작업 폴더에서 다른 테스트가 실행 중입니다. 완료 후 다시 실행해 주세요.');
    throw error;
  }
  return () => {
    if (JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file);
  };
}

function runTests(args = [], { root = path.resolve(__dirname, '..'), env = process.env,
  now = Date.now, spawn = spawnSync, log = console.log } = {}) {
  const started = performance.now();
  const force = args.includes('--force');
  const forwarded = args.filter(arg => arg !== '--force');
  // Any custom argument could filter or weaken a run. It may neither consume
  // nor produce a full-suite proof. CI always executes, even if a proof exists.
  const full = forwarded.length === 0;
  const cacheable = full && !isCI(env) && !externalTestMode(root, env);
  const directory = workspaceCache(root);
  fs.mkdirSync(directory, { recursive: true });
  const release = acquireLock(directory);
  const destination = proofPath(root);
  const reportFile = path.join(directory, `react-tests-${crypto.randomUUID()}.json`);
  try {
    let before;
    if (cacheable) {
      try { before = testIdentity(root, env, now()); }
      catch { log('테스트 입력을 모두 확인할 수 없어 전체 테스트를 새로 실행합니다.'); }
    }
    const proof = before && !force && reusableProof(destination, before, now());
    if (proof) {
      log(`동일한 소스·의존성·환경의 전체 테스트 통과 기록을 재사용합니다 (${proof.summary.numPassedTests}개 통과, 유효기간 1시간).`);
      log(`테스트 확인 완료 (${((performance.now() - started) / 1000).toFixed(1)}초). --force로 다시 실행할 수 있습니다.`);
      return { reused: true, summary: proof.summary };
    }
    // A failed, interrupted, forced or filtered attempt must not leave an old
    // success available for a subsequent deployment.
    fs.rmSync(destination, { force: true });
    const childEnv = { ...env, NODE_ENV: 'test', BABEL_ENV: 'test', PUBLIC_URL: '' };
    for (const key of ['npm_lifecycle_event', 'npm_lifecycle_script', 'npm_command']) delete childEnv[key];
    const cli = require.resolve('react-scripts/scripts/test', { paths: [root] });
    const result = spawn(process.execPath, [cli, ...ciTestArgs(forwarded, { cwd: root }),
      ...(full ? ['--json', '--outputFile', reportFile] : [])], { cwd: root, env: childEnv, stdio: 'inherit', shell: false });
    if (result.error || result.status !== 0 || result.signal) {
      throw new Error(`React 테스트 실패 (${result.status ?? result.signal ?? '실행 오류'}).`);
    }
    if (!full) return { reused: false };
    const summary = passedSummary(JSON.parse(fs.readFileSync(reportFile, 'utf8')));
    if (!summary) throw new Error('전체 테스트 통과 결과를 확인하지 못했습니다. 재사용 기록을 저장하지 않습니다.');
    if (before) {
      const after = testIdentity(root, env, now());
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('테스트 중 소스·의존성·환경이 바뀌었습니다. 다시 검사해 주세요.');
      fs.writeFileSync(destination, JSON.stringify({ schemaVersion: 1,
        identity: digest(JSON.stringify(after)), completedAt: now(), summary }));
    }
    log(`전체 테스트 확인 완료 (${((performance.now() - started) / 1000).toFixed(1)}초).`);
    return { reused: false, summary };
  } finally {
    fs.rmSync(reportFile, { force: true });
    release();
  }
}

module.exports = { MAX_AGE_MS, testIdentity, proofPath, reusableProof, runTests };
