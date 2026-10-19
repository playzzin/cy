import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'artifacts', 'team-resource-status-emulator');
mkdirSync(output, { recursive: true });
const config = path.join(output, 'firebase.json');
writeFileSync(config, JSON.stringify({ emulators: { firestore: { host: '127.0.0.1', port: 8186 }, hub: { host: '127.0.0.1', port: 4486 }, logging: { host: '127.0.0.1', port: 4586 }, ui: { enabled: false }, singleProjectMode: true } }));
const env = { ...process.env, TEAM_READ_TEST_PROJECT_ID: 'demo-team-resource-status' };
if (process.platform === 'win32') {
    const bundled = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
    const java = env.JAVA_HOME || (existsSync(path.join(bundled, 'bin/java.exe')) ? bundled : '');
    if (java) {
        env.JAVA_HOME = java;
        const key = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
        env[key] = `${path.join(java, 'bin')}${path.delimiter}${env[key] || ''}`;
    }
}
const cli = path.join(env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const args = ['emulators:exec', '--only', 'firestore', '--project', 'demo-team-resource-status', '--config', config,
    'node --test --test-concurrency=1 functions/lib/teamResourceStatus.test.js'];
const globalCli = process.platform === 'win32' && existsSync(cli);
const result = spawnSync(globalCli ? process.execPath : 'firebase', globalCli ? [cli, ...args] : args, { cwd: root, env, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
