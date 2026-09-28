// Read-only deployment preflight. Never logs keys, tokens, UIDs, environment variables or business documents.
const fs = require('node:fs');
const path = require('node:path');
const { GoogleAuth } = require('../functions/node_modules/google-auth-library');
const { parseWorkspaceRuntime } = require('../functions/lib/aiWorkspace/runtime');
const root = path.resolve(__dirname, '..');
const names = ['aiWorkspace', 'aiWorkspaceReports', 'generateScheduledWorkspaceReports'];
const groups = ['ai_report_runs', 'ai_report_schedules', 'cardBillings', 'accommodation_billing_documents', 'vehicle_billing_documents'];
const keyOf = fields => JSON.stringify(fields.filter(field => field.fieldPath !== '__name__').map(field => [field.fieldPath, field.order || field.arrayConfig]));
async function main() {
  if (!process.argv.includes('--read-only')) throw new Error('read-only flag required');
  const project = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')).projects.default;
  if (!/^[a-z0-9-]+$/.test(project)) throw new Error('project configuration invalid');
  const auth = new GoogleAuth({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.env.APPDATA || '', 'gcloud/application_default_credentials.json'), scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const get = async url => {
    try { const response = await client.request({ url, method: 'GET', timeout: 20000, retry: false }); return { status: response.status, data: response.data }; }
    catch (error) { return { status: Number(error.response?.status) || 0, data: null }; }
  };
  const listed = async (url, field) => {
    const values = []; let page = '';
    for (let count = 0; count < 20; count++) {
      const query = new URLSearchParams(field === 'indexes' ? {} : { pageSize: '100' });
      if (page) query.set('pageToken', page);
      const response = await get(`${url}${query.size ? `?${query}` : ''}`);
      if (response.status !== 200) return { status: response.status, values: [], complete: false };
      values.push(...(response.data[field] || [])); page = response.data.nextPageToken || '';
      if (!page) return { status: 200, values, complete: true };
    }
    return { status: 200, values, complete: false };
  };
  const report = { checkedAt: new Date().toISOString(), project, writes: 0, functions: [], indexes: [], runtime: null, serverAi: null, scheduler: null, hosting: null };
  for (const name of names) {
    const response = await get(`https://cloudfunctions.googleapis.com/v1/projects/${project}/locations/asia-northeast3/functions/${name}`);
    const item = { name, httpStatus: response.status, state: response.data?.status || 'unavailable', runtime: response.data?.runtime || null };
    if (response.status === 200 && name !== names[2]) {
      const expected = `https://asia-northeast3-${project}.cloudfunctions.net/${name}`;
      if (response.data.httpsTrigger?.url === expected) {
        try {
          const probe = await fetch(expected, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { action: 'list' } }), signal: AbortSignal.timeout(20000) });
          const body = await probe.json(); item.anonymousRejected = probe.status === 401 && body.error?.status === 'UNAUTHENTICATED';
        } catch { item.anonymousRejected = null; }
      }
    }
    report.functions.push(item);
  }
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8')).indexes;
  for (const group of groups) {
    const response = await listed(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/${group}/indexes`, 'indexes');
    for (const index of expected.filter(value => value.collectionGroup === group)) {
      const matches = response.values.filter(value => value.queryScope === index.queryScope && keyOf(value.fields || []) === keyOf(index.fields));
      report.indexes.push({ group, fields: index.fields.map(value => value.fieldPath), httpStatus: response.status, state: matches.find(value => value.state === 'READY')?.state || matches[0]?.state || (response.complete ? 'missing' : 'unavailable') });
    }
  }
  const runtime = await get(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/server_settings/ai_workspace`);
  const configuration = runtime.data?.fields?.runtime?.mapValue?.fields;
  const effective = parseWorkspaceRuntime(configuration && { version: Number(configuration.version?.integerValue), revision: Number(configuration.revision?.integerValue),
    mode: configuration.mode?.stringValue, schedulerEnabled: configuration.schedulerEnabled?.booleanValue,
    pilotUids: configuration.pilotUids?.arrayValue ? (configuration.pilotUids.arrayValue.values || []).map(value => value.stringValue) : undefined });
  report.runtime = { httpStatus: runtime.status, configured: Boolean(configuration), valid: effective.revision > 0, revision: effective.revision, mode: effective.mode,
    schedulerEnabled: effective.schedulerEnabled, pilotAccountCount: effective.pilotUids.length };
  const ai = await get(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/server_settings/ai`);
  report.serverAi = { httpStatus: ai.status, keyConfigured: Boolean(ai.data?.fields?.apiKey?.stringValue), model: ai.data?.fields?.model?.stringValue || null };
  const jobs = await listed(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/asia-northeast3/jobs`, 'jobs');
  const matches = jobs.values.filter(job => job.pubsubTarget?.topicName?.endsWith(`/firebase-scheduled-${names[2]}-asia-northeast3`));
  report.scheduler = { httpStatus: jobs.status, inventoryComplete: jobs.complete, jobs: matches.map(job => ({ state: job.state, schedule: job.schedule, timeZone: job.timeZone })) };
  try {
    const response = await fetch(`https://${project}.web.app/release.json`, { signal: AbortSignal.timeout(20000) });
    const release = await response.json();
    report.hosting = { httpStatus: response.status, builtAt: release.builtAt || null, dirty: release.dirty ?? null,
      sameAssetsAsLocal: fs.existsSync(path.join(root, 'build/release.json')) ? release.assetManifestHash === JSON.parse(fs.readFileSync(path.join(root, 'build/release.json'), 'utf8')).assetManifestHash : null };
  } catch { report.hosting = { httpStatus: 0, sameAssetsAsLocal: null }; }
  report.infrastructureReady = report.functions.every(item => item.state === 'ACTIVE') && report.functions.slice(0, 2).every(item => item.anonymousRejected === true)
    && report.indexes.every(item => item.state === 'READY') && report.serverAi.keyConfigured
    && jobs.complete && matches.some(job => job.state === 'ENABLED' && job.timeZone === 'Asia/Seoul' && ['every 5 minutes', '*/5 * * * *'].includes(job.schedule));
  // Runtime activation, matching Hosting assets and authenticated role tests are separate release requirements.
  report.productionValidated = false;
  const output = path.join(root, '.tmp/ai-workspace-qa/production-preflight.json'); fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
  if (!report.infrastructureReady) process.exitCode = 2;
}
if (require.main === module) main().catch(() => { console.error('읽기 전용 운영 점검을 완료하지 못했습니다. 기존 인증·네트워크 설정을 확인해 주세요.'); process.exitCode = 1; });
module.exports = { keyOf };
