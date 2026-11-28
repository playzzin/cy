const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readProductionSettings } = require('../../scripts/ci-hosting-web-config.cjs');

async function build() {
  const root = path.resolve(__dirname, '../..');
  process.chdir(root);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
    throw new Error('커밋에 포함할 변경을 정리한 뒤 비공개 검증 빌드를 실행해 주세요.');
  }
  const dir = path.join(root, '.tmp', 'private-review', revision);
  const env = {
    ...process.env,
    ...(await readProductionSettings()),
    BUILD_PATH: path.join(dir, 'build'),
    REACT_APP_PRIVATE_REVIEW: 'true',
    REACT_APP_USE_EMULATORS: 'false',
    GENERATE_SOURCEMAP: 'false',
  };
  fs.mkdirSync(dir, { recursive: true });
  execFileSync(process.execPath, ['scripts/react-scripts-build.js', '--force'], { env, stdio: 'inherit' });
  execFileSync('npm', ['--prefix', 'functions', 'run', 'build'], { stdio: 'inherit' });
  for (const file of ['Dockerfile', 'server.cjs', 'launch.js', 'package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(dir, file));
  }
  fs.copyFileSync(path.join(root, 'functions/lib/privateReviewIdentity.js'), path.join(dir, 'identity.js'));
  fs.writeFileSync(path.join(dir, 'revision'), revision + '\n');
  console.log('비공개 검증 배포 소스: ' + dir);
}
build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
