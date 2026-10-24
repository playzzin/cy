const { existsSync, writeFileSync, mkdirSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), env = { ...process.env };
env.CI = 'true';
env.XDG_CONFIG_HOME = path.join(root, '.tmp/gemini-cli-config');
if (process.platform === 'win32') {
  const java = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  if (existsSync(path.join(java, 'bin/java.exe'))) {
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
    env.JAVA_HOME = java; env[pathKey] = `${path.join(java, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
  }
}
mkdirSync(path.join(root, '.tmp'), { recursive: true });
const config = path.join(root, '.tmp/gemini-usage-emulator.json');
copyFileSync(path.join(root, 'firestore.rules'), path.join(root, '.tmp/gemini-usage-firestore.rules'));
writeFileSync(config, JSON.stringify({ firestore: { rules: 'gemini-usage-firestore.rules' }, emulators: {
  auth: { host: '127.0.0.1', port: 9297 }, firestore: { host: '127.0.0.1', port: 8297 }, hub: { host: '127.0.0.1', port: 4497 }, logging: { host: '127.0.0.1', port: 4597 }, ui: { enabled: false }, singleProjectMode: true,
} }));
const cli = path.join(env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const args = ['emulators:exec', '--config', config, '--only', 'auth,firestore', '--project', 'demo-cy-gemini-usage', 'node scripts/test-gemini-usage.cjs'];
const result = spawnSync(existsSync(cli) ? process.execPath : 'firebase', existsSync(cli) ? [cli, ...args] : args, { cwd: root, env, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
