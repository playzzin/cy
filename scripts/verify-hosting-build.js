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

console.log('Hosting build verified.');
