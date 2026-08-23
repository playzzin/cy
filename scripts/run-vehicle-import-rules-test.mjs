import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
// Keep emulator rule checks hermetic. The globally installed Firebase CLI
// otherwise performs a post-run update check that can turn a successful rule
// assertion into a failing process when its user config store is read-only.
env.CI = 'true';
env.NO_UPDATE_NOTIFIER = '1';
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
  '--project', 'demo-cy-vehicle-import',
  'node scripts/test-vehicle-import-identity-rules.mjs',
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
  'Vehicle import identity Firestore rule integration checks passed.',
) && result.stdout?.includes('Script exited successfully (code 0)');
if (result.status !== 0 && assertionsPassed) {
  // firebase-tools on Windows can report a failure solely because the Java
  // Firestore emulator acknowledges the normal shutdown SIGINT with code 130.
  // Never mask an assertion/startup failure: both success markers are required.
  console.warn('Rule assertions passed; ignoring Firebase emulator shutdown status.');
  process.exit(0);
}
process.exit(result.status ?? 1);
