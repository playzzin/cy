const fs = require('node:fs');
const path = require('node:path');
const { resolveBuildDirectory, loadBuildEnvironment } = require('./hosting-build-paths.cjs');
function assertHostingTarget(release, environment) {
    const projects = { production: 'cyee-9c1e4', staging: 'cy-erp-staging-9c1e4' };
    if (!projects[environment] || release.deployment?.environment !== environment || release.deployment?.projectId !== projects[environment]) throw new Error('배포 대상과 빌드의 데이터 연결이 다릅니다. 대상 환경으로 다시 빌드해 주세요.');
}
function assertHostingDirectory(publicDirectory, workspaceRoot = path.resolve(__dirname, '..'), environment = process.env) {
    if (resolveBuildDirectory(workspaceRoot, environment) !== path.resolve(workspaceRoot, publicDirectory)) {
        throw new Error('빌드 출력과 Firebase Hosting public 경로가 다릅니다. 같은 폴더를 지정한 뒤 배포해 주세요.');
    }
}
module.exports = { assertHostingTarget, assertHostingDirectory };
if (require.main === module) {
    loadBuildEnvironment();
    const environment = process.argv[2];
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', environment === 'staging' ? 'firebase.staging.json' : 'firebase.json'), 'utf8'));
    assertHostingDirectory(config.hosting.public);
    assertHostingTarget(JSON.parse(fs.readFileSync(path.join(resolveBuildDirectory(), 'release.json'), 'utf8')), environment);
    console.log('배포 주소와 데이터 연결 일치 확인');
}
