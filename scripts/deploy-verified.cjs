const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, sourceState, compareRelease } = require('./release-manifest.cjs');
const { checkRelease, readRemoteJson } = require('./check-release.cjs');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || `검증 또는 배포 실패: ${command} (${result.status})`);
}
async function main() {
  const state = sourceState();
  if (state.dirty) throw new Error('변경 사항을 먼저 커밋해 주세요. 커밋한 버전만 배포할 수 있습니다.');
  // Project/site are read from the existing config; this command does not create cloud resources.
  const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const project = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')).projects.default;
  const base = `https://${config.hosting.site}.web.app`;
  let remote;
  try { remote = await readRemoteJson(base, 'release.json'); } catch (error) {
    if (!process.argv.includes('--initialize-record')) throw new Error('사이트의 이전 배포 기록을 확인할 수 없습니다. 기존 서버 반영을 확인한 최초 도입 시에만 --initialize-record를 사용하세요.');
  }
  if (remote) {
    const comparison = compareRelease(state, remote);
    const backend = comparison.changed.filter(group => group !== 'hosting');
    if ((!comparison.known || backend.length) && !process.argv.includes('--initialize-record')) throw new Error(`서버·설정 변경을 먼저 별도 검증하고 배포해야 합니다: ${backend.join(', ')}. 작업 기록을 확인한 뒤 --initialize-record로 새 기준을 설정하세요.`);
  }
  run(process.execPath, [path.join(root, 'scripts', 'verify-project-health.js')]);
  const cli = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js')
    : null;
  // Standard firebase predeploy hooks remain active, including the final build check.
  run(cli && fs.existsSync(cli) ? process.execPath : 'firebase', [...(cli && fs.existsSync(cli) ? [cli] : []), 'deploy', '--project', project, '--only', 'hosting', '--non-interactive']);
  await checkRelease(base);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
