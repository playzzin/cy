const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root } = require('./runtime.cjs');
const rules = path.resolve(process.argv[2] || path.join(root, 'firestore.rules'));
if (!fs.existsSync(rules)) throw new Error('Pass a local copy of the rules to verify.');
const audit = path.join(root, 'artifacts/audits/taxinvoice-permissions');
fs.mkdirSync(audit, { recursive: true });
const config = path.join(audit, 'firebase.json');
fs.writeFileSync(config, JSON.stringify({ firestore: { rules }, emulators: {
  firestore: { host: '127.0.0.1', port: 18086 }, auth: { host: '127.0.0.1', port: 19096 },
  ui: { enabled: false }, singleProjectMode: true,
} }));
const javaHome = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Android/Android Studio/jbr');
const env = { ...process.env, CI: 'true', NO_UPDATE_NOTIFIER: '1', XDG_CONFIG_HOME: path.join(audit, 'cli-config') };
if (fs.existsSync(path.join(javaHome, 'bin/java.exe'))) {
  env.JAVA_HOME = javaHome; env.Path = `${javaHome}/bin${path.delimiter}${env.Path || env.PATH || ''}`; env.PATH = env.Path;
}
const cli = path.join(process.env.APPDATA || '', 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--only', 'firestore,auth', '--project', 'demo-taxinvoice-issue-e2e', '--config', config, 'node scripts/taxinvoice-emulator/permissions.cjs'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
