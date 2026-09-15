import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'cy-storage-rules-'));
const env = { ...process.env, NO_UPDATE_NOTIFIER: '1', XDG_CONFIG_HOME: temporaryDirectory };
const javaHome = env.JAVA_HOME || path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
if (existsSync(path.join(javaHome, 'bin', 'java.exe'))) {
  env.JAVA_HOME = javaHome;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
  env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
}
const configPath = path.join(temporaryDirectory, 'firebase.json');
const firestoreRules = path.join(temporaryDirectory, 'firestore.rules');
writeFileSync(firestoreRules, "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }");
writeFileSync(configPath, JSON.stringify({
  firestore: { rules: firestoreRules },
  storage: { rules: path.resolve('storage.rules') },
  emulators: {
    auth: { host: '127.0.0.1', port: 9299 },
    firestore: { host: '127.0.0.1', port: 8380 },
    storage: { host: '127.0.0.1', port: 9399 },
    hub: { host: '127.0.0.1', port: 4499 },
    logging: { host: '127.0.0.1', port: 4599 },
    ui: { enabled: false },
  },
}));
const cliPath = path.join(env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const args = ['emulators:exec', '--config', configPath, '--only', 'auth,firestore,storage', '--project', 'demo-cy-storage', 'node scripts/test-storage-manager-rules.mjs'];
const result = spawnSync(existsSync(cliPath) ? process.execPath : 'firebase', existsSync(cliPath) ? [cliPath, ...args] : args, { env, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
