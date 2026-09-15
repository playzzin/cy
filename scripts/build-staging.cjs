const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const env = { ...process.env };
// Empty values prevent CRA's dotenv loader from importing production integrations.
for (const key of Object.keys(env)) if (key.startsWith('REACT_APP_')) env[key] = '';
for (const file of fs.readdirSync(root).filter(name => /^\.env(?:\.|$)/.test(name))) {
    if (!fs.statSync(path.join(root, file)).isFile()) continue;
    for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/^\s*(REACT_APP_[A-Z0-9_]+)\s*=/gm)) env[match[1]] = '';
}
Object.assign(env, JSON.parse(fs.readFileSync(path.join(root, '.firebase/staging-env.json'), 'utf8')));
env.REACT_APP_CANONICAL_APP_ORIGIN = 'https://cy-erp-staging-9c1e4.web.app';
if (env.REACT_APP_DEPLOYMENT_ENV !== 'staging' || env.REACT_APP_FIREBASE_PROJECT_ID !== 'cy-erp-staging-9c1e4') throw new Error('검증 프로젝트 설정이 필요합니다.');
for (const script of ['react-scripts-build.js', 'release-manifest.cjs']) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=8192', path.join(root, 'scripts', script)], { cwd: root, env, stdio: 'inherit' });
    if (result.error || result.status !== 0) process.exit(result.status || 1);
}
