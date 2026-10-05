const fs = require('node:fs');
const path = require('node:path');
const { root, sourceState, compareRelease, sameSourceState } = require('./release-manifest.cjs');
const { checkRelease, readRemoteJson } = require('./check-release.cjs');
const { firebaseCommand, deploymentProject, run } = require('./deploy-selected.cjs');

async function main(args = process.argv.slice(2), { getState = sourceState, execute = run,
  readRemote = readRemoteJson, verifyRelease = checkRelease, log = console.log } = {}) {
  if (args.some(arg => !['--initialize-record', '--dry-run'].includes(arg))) throw new Error('사용법: deploy:hosting [--dry-run] [--initialize-record]');
  // Project/site are read from the existing config; this command does not create cloud resources.
  const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const project = deploymentProject();
  const base = `https://${config.hosting.site}.web.app`;
  const invocation = firebaseCommand(project, 'hosting');
  log(`배포 대상: ${project} / hosting`);
  log('프런트 타입 검사·React 테스트 → Hosting 사전 빌드·검증 → Hosting 배포 → 반영 확인. Functions 빌드는 제외합니다.');
  if (args.includes('--dry-run')) {
    log('실행 계획만 확인했습니다. 검사·빌드·네트워크 요청·배포는 실행하지 않았습니다.');
    return invocation;
  }
  const state = getState();
  if (state.dirty) throw new Error('변경 사항을 먼저 커밋해 주세요. 커밋한 버전만 배포할 수 있습니다.');
  let remote;
  try { remote = await readRemote(base, 'release.json'); } catch (error) {
    if (!args.includes('--initialize-record')) throw new Error('사이트의 이전 배포 기록을 확인할 수 없습니다. 기존 서버 반영을 확인한 최초 도입 시에만 --initialize-record를 사용하세요.');
  }
  const comparison = compareRelease(state, remote);
  const backend = comparison.changed.filter(group => group !== 'hosting');
  if ((!comparison.known || backend.length) && !args.includes('--initialize-record')) throw new Error(`서버·설정 변경을 먼저 별도 검증하고 배포해야 합니다: ${backend.join(', ')}. 작업 기록을 확인한 뒤 --initialize-record로 새 기준을 설정하세요.`);
  execute(process.execPath, [path.join(root, 'scripts', 'verify-project-health.js'), '--scope=hosting']);
  if (!sameSourceState(state, getState())) throw new Error('검사 전후 코드가 바뀌었습니다. 배포 전에 다시 검사해 주세요.');
  // Standard firebase predeploy hooks remain active, including the final build check.
  execute(invocation.command, invocation.args);
  await verifyRelease(base);
}
module.exports = { main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
