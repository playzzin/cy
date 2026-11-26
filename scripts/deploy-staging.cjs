const { sourceState, sameSourceState } = require('./release-manifest.cjs');
const { checkRelease } = require('./check-release.cjs');
const { firebaseCommand, run } = require('./deploy-selected.cjs');
const { stagingOrigin } = require('./hosting-build-paths.cjs');
const { checkHostingApi } = require('./hosting-network.cjs');
const { site } = require('../firebase.staging.json').hosting;

async function main(args = process.argv.slice(2), {
    getState = sourceState, execute = run, verify = checkRelease, checkNetwork = checkHostingApi, log = console.log,
} = {}) {
    if (args.some(arg => arg !== '--dry-run')) throw new Error('사용법: staging:deploy [--dry-run]');
    const invocation = firebaseCommand(site, 'hosting', undefined, 'firebase.staging.json');
    log(`검증 Hosting 대상 ${site}`);
    if (args.includes('--dry-run')) return invocation;
    const before = getState();
    if (before.dirty) throw new Error('변경 사항을 먼저 커밋해 주세요.');
    await checkNetwork(site);
    execute(invocation.command, invocation.args);
    if (!sameSourceState(before, getState())) throw new Error('검증 서버 배포 중 코드가 바뀌었습니다.');
    await verify(stagingOrigin);
    return invocation;
}

module.exports = { main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
