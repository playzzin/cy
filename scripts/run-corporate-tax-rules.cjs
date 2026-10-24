const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const env = { ...process.env };
const jbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
if (process.platform === 'win32' && existsSync(path.join(jbr, 'bin/java.exe'))) {
    env.JAVA_HOME = jbr; env.Path = `${path.join(jbr, 'bin')}${path.delimiter}${env.Path || ''}`;
}
const cli = path.join(env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--only', 'firestore,auth', '--config',
    'firebase.corporate-tax-preview.json', '--project', 'demo-cy-corporate-tax', 'node scripts/test-corporate-tax-rules.mjs'],
    { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', shell: false });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
