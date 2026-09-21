import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
if (process.platform === 'win32') {
  const bundledJbr = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  const javaHome = env.JAVA_HOME || (existsSync(path.join(bundledJbr, 'bin', 'java.exe')) ? bundledJbr : '');
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
    const previousPath = env[pathKey] || '';
    Object.keys(env).filter(key => key.toLowerCase() === 'path').forEach(key => delete env[key]);
    env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${previousPath}`;
  }
}

const firebaseArgs = [
  'emulators:exec',
  '--only', 'firestore',
  '--project', 'demo-team-scoped-read',
  'node --test functions/lib/teamReadPolicy.test.js functions/lib/teamScopedRead.test.js functions/lib/teamCatalogCache.test.js functions/lib/teamScopedQuery.test.js',
];
const globalCliCandidates = process.platform === 'win32'
  ? [path.join(env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js')]
  : [];
const globalCli = globalCliCandidates.find((candidate) => candidate && existsSync(candidate));
const executable = globalCli ? process.execPath : (process.platform === 'win32' ? 'firebase.cmd' : 'firebase');
const args = globalCli ? [globalCli, ...firebaseArgs] : firebaseArgs;
const result = spawnSync(executable, args, {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(`Unable to start Firebase emulators: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
