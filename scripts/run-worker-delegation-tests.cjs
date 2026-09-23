const { spawnSync } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env, CI: 'true', XDG_CONFIG_HOME: path.join(__dirname, '..', '.team-menu-emulator-config') };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
const savedPath = env[pathKey] || '';
Object.keys(env).filter(key => key.toLowerCase() === 'path').forEach(key => delete env[key]);
env[pathKey] = `C:\\Program Files\\Android\\Android Studio\\jbr\\bin${path.delimiter}${savedPath}`;
const cli = path.join(env.APPDATA, 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--only', 'firestore', '--project', 'demo-worker-delegation',
    'node --test functions/lib/workerRequestDelegation.test.js'], { env, stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
