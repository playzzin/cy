const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, sourceState, compareRelease, sameSourceState } = require('./release-manifest.cjs');
const { checkRelease, readRemoteJson } = require('./check-release.cjs');
const { firebaseCommand, deploymentProject, run } = require('./deploy-selected.cjs');

function assertReleaseAncestry(localCommit, remoteCommit, runGit = args => spawnSync('git', args, {
  cwd: root, encoding: 'utf8', shell: false,
})) {
  if (!remoteCommit) throw new Error('운영 배포 커밋을 확인할 수 없습니다. 배포 기록을 확인해 주세요.');
  if (localCommit === remoteCommit) return;
  if (!/^[a-f0-9]{40}$/i.test(remoteCommit) || !/^[a-f0-9]{40}$/i.test(localCommit)) {
    throw new Error('운영 배포 커밋 형식이 올바르지 않습니다.');
  }
  const result = runGit(['merge-base', '--is-ancestor', remoteCommit, localCommit]);
  if (result.status === 0 && !result.error) return;
  if (result.status === 1) {
    throw new Error(`현재 운영 버전 ${remoteCommit.slice(0, 8)}을 포함하지 않은 배포입니다. 운영 변경을 먼저 합쳐 주세요. 이전 작업 폴더로 배포하면 기존 기능이 누락될 수 있습니다.`);
  }
  throw new Error('운영 커밋의 Git 이력을 확인하지 못했습니다. 저장소 이력을 가져온 뒤 다시 검사해 주세요.');
}

async function main(args = process.argv.slice(2), { getState = sourceState, execute = run,
  readRemote = readRemoteJson, verifyRelease = checkRelease, checkAncestry = assertReleaseAncestry, log = console.log } = {}) {
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
  if (remote) checkAncestry(state.commit, remote.commit);
  const comparison = compareRelease(state, remote);
  const backend = comparison.changed.filter(group => group !== 'hosting');
  if ((!comparison.known || backend.length) && !args.includes('--initialize-record')) throw new Error(`서버·설정 변경을 먼저 별도 검증하고 배포해야 합니다: ${backend.join(', ')}. 작업 기록을 확인한 뒤 --initialize-record로 새 기준을 설정하세요.`);
  execute(process.execPath, [path.join(root, 'scripts', 'verify-project-health.js'), '--scope=hosting']);
  if (!sameSourceState(state, getState())) throw new Error('검사 전후 코드가 바뀌었습니다. 배포 전에 다시 검사해 주세요.');
  // Another release may have completed during the checks. Never overwrite a
  // version that was not included in the source we just verified.
  if (remote) {
    const latest = await readRemote(base, 'release.json');
    checkAncestry(state.commit, latest?.commit);
    if (latest.commit !== remote.commit) throw new Error('검사 중 운영 배포 버전이 바뀌었습니다. 최신 운영 버전을 기준으로 다시 검증해 주세요.');
  }
  // Standard firebase predeploy hooks remain active, including the final build check.
  execute(invocation.command, invocation.args);
  await verifyRelease(base);
}
module.exports = { main, assertReleaseAncestry };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
