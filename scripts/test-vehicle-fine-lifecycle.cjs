// Run after npm run functions:build. Uses synthetic data in demo emulators only.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, '.firebase', 'vehicle-fine-test.json');
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify({
    firestore: { rules: path.join(root, 'firestore.rules') },
    storage: { rules: path.join(root, 'storage.rules') },
    emulators: { firestore: { port: 8185 }, auth: { port: 9295 }, storage: { port: 9395 }, hub: { port: 4495 }, logging: { port: 4595 }, ui: { enabled: false }, singleProjectMode: true },
}));
const env = { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1' };
const java = path.join(env.ProgramFiles || 'C:/Program Files', 'Android/Android Studio/jbr');
if (process.platform === 'win32' && !env.JAVA_HOME && fs.existsSync(path.join(java, 'bin/java.exe'))) env.JAVA_HOME = java;
if (env.JAVA_HOME) {
    const nextPath = `${path.join(env.JAVA_HOME, 'bin')}${path.delimiter}${env.Path || env.PATH || ''}`;
    env.Path = nextPath; env.PATH = nextPath;
}
const cli = path.join(env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--config', configPath, '--only', 'firestore,auth,storage', '--project', 'demo-cy-vehicle-fine', 'node --test functions/lib/vehicleImportIdentity.test.js functions/lib/vehicleFineLifecycle.test.js'], { cwd: root, env, encoding: 'utf8' });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = result.status || 0;
