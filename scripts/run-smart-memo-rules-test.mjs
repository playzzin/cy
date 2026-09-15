import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env, NO_UPDATE_NOTIFIER: '1' };
// Keep emulator-only CLI state inside the workspace instead of changing user settings.
env.XDG_CONFIG_HOME = path.resolve('.codex-smart-memo-test-config');
if (process.platform === 'win32') {
    const bundledJava = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
    const javaHome = env.JAVA_HOME || (existsSync(path.join(bundledJava, 'bin', 'java.exe')) ? bundledJava : '');
    if (javaHome) {
        env.JAVA_HOME = javaHome;
        const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
        env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
    }
}
const globalCli = path.join(env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const firebaseArgs = ['emulators:exec', '--only', 'firestore,auth', '--project', 'demo-cy-memo', 'node scripts/test-smart-memo-rules.mjs'];
const useGlobalCli = existsSync(globalCli);
const result = spawnSync(useGlobalCli ? process.execPath : 'firebase', useGlobalCli ? [globalCli, ...firebaseArgs] : firebaseArgs, { env, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
