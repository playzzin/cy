process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.GENERATE_SOURCEMAP = process.env.GENERATE_SOURCEMAP ?? 'false';

// CRA loads .env.production/.env.local here. Validate before webpack starts so
// a bundle that cannot initialize Firebase Auth is never considered deployable.
require('react-scripts/config/env');
require('./browser-env-security.cjs').stripServerAiCredentials();
const { validateFirebaseBuildEnvironment } = require('./validate-firebase-build-env');

try {
  validateFirebaseBuildEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const { patchReactScriptsWebpack } = require('./patchReactScriptsWebpack');
const { installWebpackShutdown } = require('./build-performance.cjs');
const { hasVerifiedTypecheck } = require('./typecheck.cjs');
const { inputIdentity, canReuseBuild, invalidateBuild, recordBuild } = require('./hosting-build-cache.cjs');
const buildStartedAt = performance.now();
const buildIdentity = inputIdentity();
const reuseBuild = !process.argv.includes('--force') && canReuseBuild(buildIdentity);
process.once('exit', code => {
  if (code !== 0) return;
  try {
    if (!reuseBuild) recordBuild(buildIdentity);
    console.log(`웹 빌드 완료 (${((performance.now() - buildStartedAt) / 1000).toFixed(1)}초).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
});
require('./release-manifest.cjs').beginBuild();
if (reuseBuild) {
  console.log('소스·환경·의존성과 모든 출력 파일이 일치하여 완료된 웹 빌드를 재사용합니다.');
  process.exit(0);
}
invalidateBuild();

const verifiedTypecheck = hasVerifiedTypecheck();
if (verifiedTypecheck) console.log('동일한 소스의 전체 TypeScript 검사 결과를 재사용합니다.');
patchReactScriptsWebpack({ verifiedTypecheck });
installWebpackShutdown();
require('react-scripts/scripts/build');
