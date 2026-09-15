// Dedicated staging only. Uses the signed-in Firebase CLI account; no keys are persisted.
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const project = 'cy-erp-staging-9c1e4';
const appId = '1:78299075398:web:58147a7a35a65f7d8f0b47';
const cli = path.join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib');
async function clients() {
    const { getProjectDefaultAccount, getGlobalDefaultAccount } = require(path.join(cli, 'auth.js'));
    const { requireAuth } = require(path.join(cli, 'requireAuth.js'));
    const { Client } = require(path.join(cli, 'apiv2.js'));
    const account = getProjectDefaultAccount(root) || getGlobalDefaultAccount();
    await requireAuth({ project, nonInteractive: true, ...(account || {}) });
    return { Client, account };
}
async function main() {
    const { Client, account } = await clients();
    if (process.argv[2] === 'enable') {
        const { ensure } = require(path.join(cli, 'ensureApiEnabled.js'));
        for (const api of ['firestore.googleapis.com', 'identitytoolkit.googleapis.com']) await ensure(project, api, 'staging');
        console.log('검증 프로젝트의 데이터베이스·로그인 API 준비 완료');
    } else if (process.argv[2] === 'auth') {
        const email = account?.user?.email;
        if (!email) throw new Error('로그인 계정 확인 필요');
        const filename = path.join(root, '.firebase/staging-auth.json');
        fs.writeFileSync(filename, JSON.stringify({ auth: { providers: { emailPassword: true, googleSignIn: {
            oAuthBrandDisplayName: 'CY ERP Staging', supportEmail: email,
            authorizedRedirectUris: [],
        } } } }));
        try {
            const installed = path.join(root, 'tmp/firebase-staging-tools/node_modules/firebase-tools/lib/bin/firebase.js');
            const result = spawnSync(process.execPath, [installed, 'deploy', '--config', filename, '--project', project, '--only', 'auth', '--non-interactive'], { cwd: root, encoding: 'utf8' });
            if (result.status !== 0) {
                // Config contains the project owner's support email. Do not print raw command logs.
                const safe = (result.stdout + result.stderr).split('\n').filter(line => /^Error:/.test(line));
                console.error(safe.map(line => line.replaceAll(email, '[프로젝트 계정]')).join('\n'));
                throw new Error('로그인 구성 실패');
            }
            console.log('검증 서버 Google·이메일 로그인 구성 완료');
        } finally { fs.unlinkSync(filename); }
    } else if (process.argv[2] === 'config') {
        const api = new Client({ urlPrefix: 'https://firebase.googleapis.com', apiVersion: 'v1beta1' });
        const { body } = await api.get(`/projects/${project}/webApps/${appId}/config`, { skipLog: { resBody: true } });
        if (body.projectId !== project) throw new Error('검증 프로젝트 설정 불일치');
        const env = {
            REACT_APP_DEPLOYMENT_ENV: 'staging', REACT_APP_FIREBASE_PROJECT_ID: project,
            REACT_APP_FIREBASE_API_KEY: body.apiKey, REACT_APP_FIREBASE_AUTH_DOMAIN: body.authDomain,
            REACT_APP_FIREBASE_APP_ID: body.appId, REACT_APP_FIREBASE_MESSAGING_SENDER_ID: body.messagingSenderId,
            REACT_APP_FIREBASE_STORAGE_BUCKET: body.storageBucket || `${project}.firebasestorage.app`,
            REACT_APP_FIREBASE_MEASUREMENT_ID: '', REACT_APP_USE_EMULATORS: 'false',
        };
        fs.mkdirSync(path.join(root, '.firebase'), { recursive: true });
        fs.writeFileSync(path.join(root, '.firebase/staging-env.json'), JSON.stringify(env));
        console.log('검증 빌드 설정 준비 완료 (Git 제외 파일)');
    } else throw new Error('사용: node scripts/staging-project.cjs enable|config|auth');
}
module.exports = { clients, project, root };
if (require.main === module) main().catch(() => { console.error('검증 프로젝트 준비 실패. Firebase 권한과 API 설정을 확인해 주세요.'); process.exitCode = 1; });
