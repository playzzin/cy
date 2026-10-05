const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, sourceState, sameSourceState } = require('./release-manifest.cjs');

function selectedTarget(args) {
  const dryRun = args.includes('--dry-run');
  const [target, ...names] = args.filter(arg => arg !== '--dry-run');
  if (target === 'functions') {
    if (!names.length || names.some(name => !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name))) {
      throw new Error('함수 이름을 지정해 주세요: npm run deploy:functions -- 함수명 [함수명2] [--dry-run]. 공통 코드 변경 시 영향을 받는 함수 이름을 모두 지정하세요.');
    }
    return { only: [...new Set(names)].map(name => `functions:${name}`).join(','), dryRun };
  }
  if (['firestore:rules', 'firestore:indexes', 'storage'].includes(target) && names.length === 0) {
    return { only: target, dryRun };
  }
  throw new Error('배포 대상을 명시해 주세요: functions 함수명 | firestore:rules | firestore:indexes | storage [--dry-run]');
}

function firebaseCommand(project, only, workspaceRoot = root) {
  const cli = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js') : null;
  return {
    command: cli && fs.existsSync(cli) ? process.execPath : 'firebase',
    args: [...(cli && fs.existsSync(cli) ? [cli] : []), 'deploy', '--config', path.join(workspaceRoot, 'firebase.json'),
      '--project', project, '--only', only, '--non-interactive'],
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0 || result.signal) {
    throw new Error(result.error?.message || `검증 또는 배포 실패: ${command} (${result.signal || result.status})`);
  }
}

function deploymentProject(workspaceRoot = root) {
  const project = JSON.parse(fs.readFileSync(path.join(workspaceRoot, '.firebaserc'), 'utf8')).projects.default;
  if (typeof project !== 'string' || !project.trim()) throw new Error('기본 Firebase 프로젝트가 없습니다.');
  return project;
}

function deploySelected(args = process.argv.slice(2), { getState = sourceState, execute = run,
  project = deploymentProject(), log = console.log } = {}) {
  const { only, dryRun } = selectedTarget(args);
  const invocation = firebaseCommand(project, only);
  log(`배포 대상: ${project} / ${only}`);
  log(only.startsWith('functions:')
    ? 'Functions 사전 빌드 1회 → 지정 함수 배포. React 검사·빌드는 실행하지 않습니다.'
    : '선택한 규칙 또는 인덱스만 배포합니다. React·Functions 빌드는 실행하지 않습니다.');
  if (dryRun) {
    log('실행 계획만 확인했습니다. 빌드·네트워크 요청·배포는 실행하지 않았습니다.');
    return invocation;
  }
  const before = getState();
  if (before.dirty) throw new Error('변경 사항을 먼저 커밋해 주세요. 커밋한 버전만 배포할 수 있습니다.');
  // Firebase runs only the selected service's predeploy hook. Do not build a
  // second time here or disable the configured hook to save time.
  execute(invocation.command, invocation.args);
  if (!sameSourceState(before, getState())) throw new Error('배포 중 코드가 바뀌었습니다. 배포 결과와 현재 소스를 별도로 확인해 주세요.');
  log('선택한 대상의 배포 명령이 성공했습니다. 실제 서버 동작·권한은 별도 확인이 필요합니다.');
  return invocation;
}

module.exports = { selectedTarget, firebaseCommand, deploymentProject, run, deploySelected };
if (require.main === module) {
  try { deploySelected(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
