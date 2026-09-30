// Runs only a disposable local demo database. Never reads production Firebase config.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const port = 18086;
const ui = process.argv.includes('--ui');

async function main() {
  // Fail before starting if another owner is already using the test port.
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => probe.close(resolve));
  const bundledJava = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Android/Android Studio/jbr/bin/java.exe');
  const java = fs.existsSync(bundledJava) ? bundledJava : process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
  const jar = path.join(os.homedir(), '.cache/firebase/emulators/cloud-firestore-emulator-v1.20.2.jar');
  if (!fs.existsSync(jar)) throw new Error('Install the official Firebase Firestore emulator before running this check.');
  const emulator = spawn(java, ['-jar', jar, '--host', '127.0.0.1', '--port', String(port), '--project_id', 'demo-taxinvoice-issue-e2e', '--rules', path.join(__dirname, 'firestore.rules')], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let task;
  const stop = () => { if (task && task.exitCode === null) task.kill(); if (emulator.exitCode === null) emulator.kill(); };
  process.once('SIGINT', () => { stop(); process.exitCode = 130; });
  process.once('SIGTERM', () => { stop(); process.exitCode = 143; });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Firestore emulator startup timed out.')), 30000);
      const onData = data => { process.stdout.write(data); if (String(data).includes('Dev App Server is now running')) { clearTimeout(timer); resolve(); } };
      emulator.stdout.on('data', onData); emulator.stderr.on('data', onData);
      emulator.once('error', error => { clearTimeout(timer); reject(error); });
      emulator.once('exit', code => { clearTimeout(timer); reject(new Error(`Emulator stopped: ${code}`)); });
    });
    task = spawn(process.execPath, [path.join(__dirname, ui ? 'serve.cjs' : 'test.cjs')], { cwd: root, windowsHide: true, stdio: 'inherit' });
    const status = await new Promise((resolve, reject) => { task.once('error', reject); task.once('exit', code => resolve(code ?? 1)); });
    process.exitCode = status;
  } finally { stop(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
