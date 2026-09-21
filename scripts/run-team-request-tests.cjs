const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const env = { ...process.env, CI: 'true', TEAM_READ_TEST_PROJECT_ID: 'demo-team-worker-request', XDG_CONFIG_HOME: path.join(__dirname, '..', '.team-menu-emulator-config') };
const javaHome = env.JAVA_HOME || path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
if (existsSync(path.join(javaHome, 'bin', 'java.exe'))) {
  env.JAVA_HOME = javaHome;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
  env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
}
const cli = path.join(env.APPDATA || '', 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
for (const [project, tests] of [
  ['demo-team-worker-request', 'functions/lib/workerSignatures.test.js functions/lib/teamAdvanceRequests.test.js functions/lib/teamScopedRead.test.js functions/lib/teamWorkerRequests.test.js functions/lib/workerDocumentAnalysis.test.js functions/lib/teamRequestDrafts.test.js scripts/team-request-rules.test.cjs'],
  ['demo-team-expense-request', 'functions/lib/teamExpenseRequests.test.js functions/lib/expenseReceiptAnalysis.test.js']
]) {
  const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--config', 'firebase.json', '--only', 'auth,firestore,storage', '--project', project, `node --test --test-concurrency=1 ${tests}`], { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', shell: false });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
