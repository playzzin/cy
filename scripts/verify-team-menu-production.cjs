const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GoogleAuth } = require('../functions/node_modules/google-auth-library');
const root = path.resolve(__dirname, '..'), project = 'cyee-9c1e4';
const normalize = value => value.replace(/\r\n/g, '\n').trim();
async function main() {
  const after = process.argv.includes('--after');
  const client = await new GoogleAuth({ keyFilename: path.join(process.env.APPDATA, 'gcloud/application_default_credentials.json'), scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const release = await fetch(`https://${project}.web.app/release.json`).then(r => r.json());
  const expectedCommit = after ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() : '7f49277e8c3bfe55c434e2698ad087e4de4de0e6';
  if (release.commit !== expectedCommit) throw new Error('Production hosting changed or does not match release.');
  console.log(`Production commit: ${release.commit}`);
  for (const [name, file] of [['cloud.firestore', 'firestore.rules'], [`firebase.storage/${project}.firebasestorage.app`, 'storage.rules']]) {
    const deployed = await client.request({ url: `https://firebaserules.googleapis.com/v1/projects/${project}/releases/${name}` });
    const rules = await client.request({ url: `https://firebaserules.googleapis.com/v1/${deployed.data.rulesetName}` });
    const content = rules.data.source.files.find(row => row.name === file) || rules.data.source.files[0];
    const expected = after ? fs.readFileSync(path.join(root, file), 'utf8') : execFileSync('git', ['show', `${expectedCommit}:${file}`], { cwd: root, encoding: 'utf8' });
    if (normalize(content.content) !== normalize(expected)) throw new Error(`${file}: deployed rules differ from expected source.`);
    console.log(`${file}: matches ${after ? 'release' : 'baseline'}`);
  }
  if (after) {
    for (const name of ['teamWorkerRequests', 'teamExpenseRequests', 'teamAdvanceRequests', 'getTeamScopedData', 'workerSignatures']) {
      const result = await client.request({ url: `https://cloudfunctions.googleapis.com/v1/projects/${project}/locations/asia-northeast3/functions/${name}` });
      if (result.data.status !== 'ACTIVE') throw new Error(`${name}: not active`);
      const response = await fetch(result.data.httpsTrigger.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { action: 'read' } }) });
      const body = await response.json();
      if (response.status !== 401 || body.error?.status !== 'UNAUTHENTICATED') throw new Error(`${name}: anonymous access not denied`);
      console.log(`${name}: ACTIVE; anonymous request rejected (401)`);
    }
  }
}
main().catch(error => { console.error(`Production verification failed: ${error.message}`); process.exitCode = 1; });
