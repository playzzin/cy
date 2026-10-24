const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'artifacts/client-workflow-qa');
fs.mkdirSync(output, { recursive: true });
const config = path.join(output, 'firebase.json');
fs.writeFileSync(config, JSON.stringify({ firestore: { rules: path.join(root, 'firestore.rules') }, storage: { rules: path.join(root, 'storage.rules') }, emulators: {
  firestore: { host: '127.0.0.1', port: 18089 }, auth: { host: '127.0.0.1', port: 19099 }, storage: { host: '127.0.0.1', port: 19199 },
  hub: { host: '127.0.0.1', port: 14419 }, logging: { host: '127.0.0.1', port: 14519 }, ui: { enabled: false }, singleProjectMode: true,
} }));
const env = { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1', XDG_CONFIG_HOME: path.join(output, 'cli-config') };
const java = path.join(env.ProgramFiles || 'C:/Program Files', 'Android/Android Studio/jbr');
if (fs.existsSync(path.join(java, 'bin/java.exe'))) {
  env.JAVA_HOME = java;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
  env[pathKey] = `${java}/bin${path.delimiter}${env[pathKey] || ''}`;
}
const cli = path.join(env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--only', 'auth,firestore,storage', '--project', 'demo-client-workflow', '--config', config, 'node scripts/client-workflow-qa/serve.cjs'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
process.exitCode = result.status ?? 1;
