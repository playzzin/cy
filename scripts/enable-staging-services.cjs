// Run only after the user authorizes linking the existing billing account.
const path = require('node:path');
const { clients, project } = require('./staging-project.cjs');
async function main() {
    if (project !== 'cy-erp-staging-9c1e4' || process.argv[2] !== '--link-existing-billing') throw new Error('검증 서버 결제 연결 승인 옵션이 필요합니다.');
    const { Client } = await clients();
    const billing = new Client({ urlPrefix: 'https://cloudbilling.googleapis.com', apiVersion: 'v1' });
    const options = { skipLog: { reqBody: true, resBody: true } };
    const production = (await billing.get('/projects/cyee-9c1e4/billingInfo', options)).body;
    const current = (await billing.get(`/projects/${project}/billingInfo`, options)).body;
    if (!production.billingEnabled || !production.billingAccountName) throw new Error('운영 결제 계정 확인 필요');
    const permission = (await billing.post('/' + production.billingAccountName + ':testIamPermissions', { permissions: ['billing.resourceAssociations.create'] }, options)).body;
    if (!permission.permissions?.includes('billing.resourceAssociations.create')) throw new Error('현재 로그인 계정에 운영 결제 계정을 연결할 권한이 없습니다. 결제 계정 사용자 권한이 필요합니다.');
    if (current.billingAccountName && current.billingAccountName !== production.billingAccountName) throw new Error('검증 서버에 다른 결제 계정이 연결되어 있습니다.');
    if (!current.billingEnabled) await billing.put(`/projects/${project}/billingInfo`, { billingAccountName: production.billingAccountName }, options);
    const verified = (await billing.get(`/projects/${project}/billingInfo`, options)).body;
    if (!verified.billingEnabled || verified.billingAccountName !== production.billingAccountName) throw new Error('결제 연결 확인 실패');
    console.log('검증 프로젝트의 기존 결제 계정 연결 확인 완료');
    const { ensure } = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/ensureApiEnabled.js'));
    for (const api of ['firebasestorage.googleapis.com', 'storage.googleapis.com', 'cloudfunctions.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'pubsub.googleapis.com', 'cloudscheduler.googleapis.com']) await ensure(project, api, 'staging');
    const storage = new Client({ urlPrefix: 'https://firebasestorage.googleapis.com', apiVersion: 'v1alpha' });
    let bucket;
    try { bucket = (await storage.get(`/projects/${project}/defaultBucket`, options)).body; }
    catch (error) { if (error.status !== 404) throw error; }
    if (!bucket) bucket = (await storage.post(`/projects/${project}/defaultBucket`, { location: 'ASIA-NORTHEAST3' }, options)).body;
    if (!bucket.bucket?.name?.endsWith(`${project}.firebasestorage.app`)) throw new Error('검증 파일 저장소 연결 불일치');
    console.log('검증 전용 파일 저장소 및 서버 API 준비 완료');
}
if (require.main === module) main().catch(error => { console.error(`검증 서비스 준비 실패 (${error.status || error.code || 'unknown'}): ${error.status ? '클라우드 설정 반영 상태를 확인해 주세요.' : error.message}`); process.exitCode = 1; });
