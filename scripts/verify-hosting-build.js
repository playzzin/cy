const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
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
  console.error(`Hosting build is incomplete. Missing: ${missing.join(', ')}`);
  process.exit(1);
}

const indexHtml = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
const { hash, sourceState } = require('./release-manifest.cjs');
const release = JSON.parse(fs.readFileSync(path.join(buildDir, 'release.json'), 'utf8'));
const state = sourceState();
if (release.schemaVersion !== 1 || release.commit !== state.commit
    || Object.keys(state.fingerprints).some(key => release.fingerprints?.[key] !== state.fingerprints[key])
    || release.assetManifestHash !== hash(fs.readFileSync(path.join(buildDir, 'asset-manifest.json')))) {
  console.error('배포 파일과 현재 코드가 다릅니다. 다시 빌드해 주세요.');
  process.exit(1);
}

if (!indexHtml.includes('/static/js/')) {
  console.error('Hosting build is incomplete. index.html does not reference a static JS bundle.');
  process.exit(1);
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
  console.error(
    'Hosting build is stale: the exact-pixel current-tab capture engine marker is missing.'
  );
  process.exit(1);
}

const captureSource = fs.readFileSync(captureBundle, 'utf8');
if (!captureSource.includes('document.body') || !captureSource.includes('allowTaint')) {
  console.error(
    'Hosting build is invalid: the capture bundle does not contain the direct DOM capture path.'
  );
  process.exit(1);
}

console.log(`Hosting build verified (${path.basename(captureBundle)} · exact-pixel current-tab capture).`);
