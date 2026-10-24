const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'functions', 'src');
function tests(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? tests(file) : entry.name.endsWith('.test.ts') ? [file] : [];
  });
}
// Discover from source so stale compiled tests cannot silently replace new tests.
const files = tests(source).map(file => path.join(root, 'functions', 'lib', path.relative(source, file).replace(/\.ts$/, '.js'))).sort();
if (!files.length || files.some(file => !fs.existsSync(file))) throw new Error('Functions build is required before running all tests.');
const env = { ...process.env, GCLOUD_PROJECT: 'demo-cy-unit-tests', GOOGLE_CLOUD_PROJECT: 'demo-cy-unit-tests',
  FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-cy-unit-tests' }) };
delete env.GOOGLE_APPLICATION_CREDENTIALS;
console.log(`Running ${files.length} server test files. Emulator-only tests are reported as skipped unless an emulator is configured.`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=2', ...files], { cwd: root, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
