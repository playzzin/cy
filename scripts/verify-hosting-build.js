const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const requiredPaths = [
  'index.html',
  'asset-manifest.json',
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
