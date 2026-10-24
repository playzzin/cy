// Add-only, explicitly scoped deployment. Default mode plans; --apply creates missing indexes.
const fs = require('node:fs'), path = require('node:path');
const { GoogleAuth } = require('../functions/node_modules/google-auth-library');
const root = path.resolve(__dirname, '..');
const signature = index => JSON.stringify([index.collectionGroup, index.queryScope, index.fields.filter(field => field.fieldPath !== '__name__').map(field => [field.fieldPath, field.order])]);
function desiredIndexes(config) {
  const pairs = [ ['ai_report_schedules', 'uid', 'nextRunAt', 'ASCENDING'], ['ai_report_runs', 'uid', 'createdAt', 'DESCENDING'] ];
  for (const group of ['cardBillings', 'accommodation_billing_documents', 'vehicle_billing_documents'])
    for (const field of ['team.id', 'teamId', 'assignedTeamId']) pairs.push([group, 'yearMonth', field, 'ASCENDING']);
  return pairs.map(([collectionGroup, first, second, order]) => {
    const index = { collectionGroup, queryScope: 'COLLECTION', fields: [{ fieldPath: first, order: 'ASCENDING' }, { fieldPath: second, order }] };
    if (!config.indexes.some(value => signature(value) === signature(index))) throw new Error('Required reviewed index missing from local configuration');
    return index;
  });
}
function missingIndexes(desired, existing) { const keys = new Set(existing.map(signature)); return desired.filter(index => !keys.has(signature(index))); }
async function main() {
  if (process.argv.slice(2).some(arg => !['--apply', '--plan'].includes(arg))) throw new Error('Unsupported option');
  const apply = process.argv.includes('--apply');
  const project = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'))).projects.default;
  if (project !== 'cyee-9c1e4') throw new Error('Unexpected deployment target');
  const desired = desiredIndexes(JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'))));
  const auth = new GoogleAuth({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.env.APPDATA || '', 'gcloud/application_default_credentials.json'), scopes: ['https://www.googleapis.com/auth/datastore'] });
  const client = await auth.getClient();
  const request = async (url, method = 'GET', data) => {
    try { return (await client.request({ url, method, data, timeout: 30000, retry: false })).data; }
    catch (error) { throw new Error(`Index request failed: HTTP ${Number(error.response?.status) || 0}`); }
  };
  const urlFor = group => `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/${group}/indexes`;
  const existing = [];
  for (const group of [...new Set(desired.map(index => index.collectionGroup))]) {
    let token = '';
    for (let page = 0; page < 20; page++) {
      const response = await request(urlFor(group) + (token ? `?pageToken=${encodeURIComponent(token)}` : ''));
      existing.push(...(response.indexes || []).map(index => ({ ...index, collectionGroup: group })));
      token = response.nextPageToken || ''; if (!token) break;
    }
    if (token) throw new Error('Index inventory incomplete');
  }
  const missing = missingIndexes(desired, existing);
  const report = { checkedAt: new Date().toISOString(), project, mode: apply ? 'apply' : 'plan', expected: desired.length,
    toCreate: missing, existingBefore: existing, created: [], deleted: 0, businessDocumentWrites: 0 };
  const folder = path.join(root, '.tmp/ai-workspace-qa'); fs.mkdirSync(folder, { recursive: true });
  const output = path.join(folder, `index-${report.mode}-${Date.now()}.json`);
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  save(); // Metadata backup precedes every mutation. Never deletes or replaces an existing index.
  if (apply) for (const index of missing) {
    const operation = await request(urlFor(index.collectionGroup), 'POST', { queryScope: index.queryScope, fields: index.fields });
    report.created.push({ group: index.collectionGroup, fields: index.fields.map(field => field.fieldPath), operation: operation.name }); save();
    console.log(`Created index request: ${index.collectionGroup} (${index.fields.map(field => field.fieldPath).join(', ')})`);
  }
  console.log(JSON.stringify({ project, mode: report.mode, expected: desired.length, missing: missing.length, created: report.created.length, deleted: 0, businessDocumentWrites: 0 }));
}
module.exports = { signature, desiredIndexes, missingIndexes };
if (require.main === module) main().catch(error => { console.error(error.message.startsWith('Index request failed:') ? error.message : 'Index preparation failed; review target, configuration and existing credentials.'); process.exitCode = 1; });
