const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const env = { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1' };
const javaPath = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
if (!env.JAVA_HOME && fs.existsSync(path.join(javaPath, 'bin', 'java.exe'))) {
  env.JAVA_HOME = javaPath;
  env.Path = `${path.join(javaPath, 'bin')}${path.delimiter}${env.Path || env.PATH || ''}`;
  env.PATH = env.Path;
}
const cli = path.join(env.APPDATA, 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--only', 'firestore', '--project', 'demo-card-upload-cancellation', 'node --test functions/lib/cardStatementImportCancellation.test.js functions/lib/cardStatementImportIdentity.test.js'], { env, stdio: ['inherit', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
// Firebase CLI on Windows sometimes fails while shutting down after successful assertions.
if (result.status !== 0 && result.stdout?.includes('# fail 0') && result.stdout?.includes('# skipped 0') && result.stdout?.includes('Script exited successfully (code 0)')) {
  console.warn('All emulator assertions passed; Firebase CLI reported a shutdown-only error.');
  process.exit(0);
}
process.exit(result.status ?? 1);
