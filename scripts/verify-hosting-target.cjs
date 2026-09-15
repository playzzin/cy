const fs = require('node:fs');
const path = require('node:path');
function assertHostingTarget(release, environment) {
    const projects = { production: 'cyee-9c1e4', staging: 'cy-erp-staging-9c1e4' };
    if (!projects[environment] || release.deployment?.environment !== environment || release.deployment?.projectId !== projects[environment]) throw new Error('배포 대상과 빌드의 데이터 연결이 다릅니다. 대상 환경으로 다시 빌드해 주세요.');
}
module.exports = { assertHostingTarget };
if (require.main === module) {
    assertHostingTarget(JSON.parse(fs.readFileSync(path.join(__dirname, '../build/release.json'), 'utf8')), process.argv[2]);
    console.log('배포 주소와 데이터 연결 일치 확인');
}
