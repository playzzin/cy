const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, hash, sourceState } = require('./release-manifest.cjs');
const { workspaceCache } = require('./build-performance.cjs');

function typecheckIdentity(workspaceRoot = root) {
  const installedLock = path.join(workspaceRoot, 'node_modules', '.package-lock.json');
  return {
    schemaVersion: 1,
    hosting: sourceState(workspaceRoot).fingerprints.hosting,
    node: process.version,
    typescript: require(require.resolve('typescript/package.json', { paths: [workspaceRoot] })).version,
    installedDependencies: fs.existsSync(installedLock) ? hash(fs.readFileSync(installedLock)) : null,
  };
}

function proofPath(workspaceRoot = root) {
  return path.join(workspaceCache(workspaceRoot), 'typecheck-success.json');
}

function hasVerifiedTypecheck(workspaceRoot = root) {
  try {
    const proof = JSON.parse(fs.readFileSync(proofPath(workspaceRoot), 'utf8'));
    return JSON.stringify(proof.identity) === JSON.stringify(typecheckIdentity(workspaceRoot));
  } catch {
    return false;
  }
}

function runTypecheck(args = [], workspaceRoot = root) {
  const startedAt = performance.now();
  const destination = proofPath(workspaceRoot);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(destination, { force: true });
  const before = typecheckIdentity(workspaceRoot);
  const compiler = require.resolve('typescript/bin/tsc', { paths: [workspaceRoot] });
  const result = spawnSync(process.execPath, [
    compiler, '--noEmit', '--incremental', '--tsBuildInfoFile',
    path.join(workspaceCache(workspaceRoot), 'typecheck.tsbuildinfo'), ...args,
  ], { cwd: workspaceRoot, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || `TypeScript 검사 실패 (${result.status})`);
  }
  const after = typecheckIdentity(workspaceRoot);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('타입 검사 중 코드 또는 의존성이 바뀌었습니다. 다시 검사해 주세요.');
  }
  // Custom compiler flags may weaken checking. Only the default full check
  // authorizes reuse by the production build.
  if (args.length === 0) {
    fs.writeFileSync(destination, JSON.stringify({ identity: after }));
  }
  console.log(`TypeScript 검사 완료 (${((performance.now() - startedAt) / 1000).toFixed(1)}초).`);
}

module.exports = { typecheckIdentity, proofPath, hasVerifiedTypecheck, runTypecheck };
if (require.main === module) {
  try { runTypecheck(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
