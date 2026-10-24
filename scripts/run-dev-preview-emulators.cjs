const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env, JAVA_HOME: 'C:/Program Files/Android/Android Studio/jbr' };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'Path';
env[pathKey] = env.JAVA_HOME + '/bin;' + env[pathKey];
const cli = path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js');
const child = spawn(process.execPath, [cli, 'emulators:start', '--only', 'auth,firestore,storage,functions', '--project', 'demo-dev-user-preview'], { cwd: path.resolve(__dirname,'..'), env, stdio:'inherit', windowsHide:true });
child.on('exit',code=>{process.exitCode=code||0;});
