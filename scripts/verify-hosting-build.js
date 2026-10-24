const fs = require('fs');
const path = require('path');

const { resolveBuildDirectory, loadBuildEnvironment } = require('./hosting-build-paths.cjs');

function verifyHostingBuild(workspaceRoot = path.resolve(__dirname, '..'), environment = process.env) {
  const buildDir = resolveBuildDirectory(workspaceRoot, environment);
  const requiredPaths = [
    'index.html',
    'asset-manifest.json',
    'release.json',
    path.join('static', 'js'),
  ];

  const missing = requiredPaths.filter((relativePath) => {
    const fullPath = path.join(buildDir, relativePath);
    return !fs.existsSync(fullPath);
  });

  if (missing.length > 0) {
    throw new Error(`Hosting build is incomplete. Missing: ${missing.join(', ')}`);
  }

  const indexHtml = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
  const { hash, sourceState } = require('./release-manifest.cjs');
  const release = JSON.parse(fs.readFileSync(path.join(buildDir, 'release.json'), 'utf8'));
  const state = sourceState(workspaceRoot);
  if (release.schemaVersion !== 1 || release.commit !== state.commit
      || Object.keys(state.fingerprints).some(key => release.fingerprints?.[key] !== state.fingerprints[key])
      || release.assetManifestHash !== hash(fs.readFileSync(path.join(buildDir, 'asset-manifest.json')))) {
    throw new Error('배포 파일과 현재 코드가 다릅니다. 다시 빌드해 주세요.');
  }

  if (!indexHtml.includes('/static/js/')) {
    throw new Error('Hosting build is incomplete. index.html does not reference a static JS bundle.');
  }

  const jsDir = path.join(buildDir, 'static', 'js');
  const jsFiles = fs.readdirSync(jsDir)
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => path.join(jsDir, fileName));
  const captureBundle = jsFiles.find((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    return source.includes('exact-pixel-current-tab-selection-v3');
  });

  if (!captureBundle) {
    throw new Error(
      'Hosting build is stale: the exact-pixel current-tab capture engine marker is missing.'
    );
  }

  const captureSource = fs.readFileSync(captureBundle, 'utf8');
  if (!captureSource.includes('document.body') || !captureSource.includes('allowTaint')) {
    throw new Error(
      'Hosting build is invalid: the capture bundle does not contain the direct DOM capture path.'
    );
  }

  return `Hosting build verified (${path.basename(captureBundle)} · exact-pixel current-tab capture).`;

}
module.exports = { verifyHostingBuild };
if (require.main === module) {
  try { loadBuildEnvironment(); console.log(verifyHostingBuild()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
