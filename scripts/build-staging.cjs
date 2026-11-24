const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { stagingEnvironment } = require('./staging-environment.cjs');
const { targetBuildEnvironment } = require('./hosting-build-paths.cjs');

async function main() {
    const root = path.resolve(__dirname, '..');
    const env = targetBuildEnvironment('staging', await stagingEnvironment(root));
    for (const script of ['react-scripts-build.js', 'release-manifest.cjs']) {
        const result = spawnSync(process.execPath, ['--max-old-space-size=8192', path.join(__dirname, script)], {
            cwd: root, env, stdio: 'inherit',
        });
        if (result.error || result.status !== 0) throw result.error || new Error(`검증 빌드 실패: ${script} (${result.signal || result.status})`);
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
