import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const env = { ...process.env };
// Keep emulator CLI state in this workspace; no access to the operator's Firebase login/config is needed.
env.XDG_CONFIG_HOME = path.resolve('.tmp', 'ai-workspace-emulator-config');
env.CI = 'true';
mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });
if (process.platform === 'win32') {
  const jbr = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  const java = env.JAVA_HOME || (existsSync(path.join(jbr, 'bin', 'java.exe')) ? jbr : '');
  if (java) {
    env.JAVA_HOME = java;
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = path.join(java, 'bin') + path.delimiter + (env[pathKey] || '');
  }
}
const globalCli = path.join(env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const command = existsSync(globalCli) ? process.execPath : process.platform === 'win32' ? 'firebase.cmd' : 'firebase';
const testScript = process.argv.includes('--statistics') ? 'node scripts/test-daily-report-analytics.mjs'
  : process.argv.includes('--reports') ? 'node scripts/test-ai-workspace-reports.mjs' : 'node scripts/test-ai-workspace.mjs';
const args = [...(existsSync(globalCli) ? [globalCli] : []), 'emulators:exec', '--only', 'firestore,auth', '--project', 'demo-cy-ai-workspace', testScript];
const result = spawnSync(command, args, { env, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
