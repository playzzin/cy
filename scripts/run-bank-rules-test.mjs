import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
if (process.platform === 'win32') {
  const bundledJbr = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  const javaHome = env.JAVA_HOME || (existsSync(path.join(bundledJbr, 'bin', 'java.exe')) ? bundledJbr : '');
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.Path = `${path.join(javaHome, 'bin')}${path.delimiter}${env.Path || ''}`;
  }
}

const firebaseArgs = [
  'emulators:exec',
  '--only', 'firestore,auth',
  '--project', 'demo-cy-bank',
  'node scripts/test-bank-notification-rules.mjs',
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
