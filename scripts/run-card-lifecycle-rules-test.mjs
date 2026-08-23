import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1' };
if (process.platform === 'win32') {
  const bundledJbr = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  const javaHome = env.JAVA_HOME || (existsSync(path.join(bundledJbr, 'bin', 'java.exe')) ? bundledJbr : '');
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    const nextPath = `${path.join(javaHome, 'bin')}${path.delimiter}${env.Path || env.PATH || ''}`;
    env.Path = nextPath;
    env.PATH = nextPath;
  }
}

const firebaseArgs = [
  'emulators:exec',
  '--only', 'firestore,auth',
  '--project', 'demo-cy-card-lifecycle',
  'node scripts/test-card-lifecycle-rules.mjs',
];
const globalCliCandidate = process.platform === 'win32'
  ? path.join(env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js')
  : '';
const globalCli = globalCliCandidate && existsSync(globalCliCandidate) ? globalCliCandidate : '';
const executable = globalCli ? process.execPath : (process.platform === 'win32' ? 'firebase.cmd' : 'firebase');
const args = globalCli ? [globalCli, ...firebaseArgs] : firebaseArgs;
const result = spawnSync(executable, args, {
  cwd: process.cwd(),
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
  encoding: 'utf8',
  shell: false,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(`Unable to start Firebase emulators: ${result.error.message}`);
  process.exit(1);
}

const assertionsPassed = result.stdout?.includes(
  'Card lifecycle Firestore rule integration checks passed.',
) && result.stdout?.includes('Script exited successfully (code 0)');
if (result.status !== 0 && assertionsPassed) {
  console.warn('Rule assertions passed; ignoring Firebase emulator shutdown status.');
  process.exit(0);
}
process.exit(result.status ?? 1);
