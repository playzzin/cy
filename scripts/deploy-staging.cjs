const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { sourceState, root } = require('./release-manifest.cjs');
const { checkRelease } = require('./check-release.cjs');
async function main() {
    if (sourceState().dirty) throw new Error('변경 사항을 먼저 커밋해 주세요.');
    const cli = path.join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
    const result = spawnSync(process.execPath, [cli, 'deploy', '--config', 'firebase.staging.json', '--project', 'cy-erp-staging-9c1e4', '--only', 'hosting', '--non-interactive'], { cwd: root, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('검증 서버 배포 실패');
    await checkRelease('https://cy-erp-staging-9c1e4.web.app');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
