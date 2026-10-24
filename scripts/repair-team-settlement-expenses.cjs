// Explicit prepare/apply/rollback, encrypted local backup, optimistic checks inside transactions.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { buildRepair, protectedContent, stable } = require('./team-settlement-expense-recovery.cjs');
const { buildTeamSettlementExpenseEntries } = require('../src/utils/teamSettlementExpenses.ts');
const { TeamSettlementDocumentSchema } = require('../src/types/teamSettlement.ts');
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const norm = value => String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const root = path.resolve(__dirname, '..');
const fields = ['yearMonth','teamId','teamName','team','assignedTeamId','assignedTeamName','issuedToType','issuedToWorkerId','issuedToWorkerName',
  'status','lineItems','vehicleId','vehiclePlate','cardId','cardLabel','fixedCost','variableCost','totalAmount',
  'payerTeamId','payerTeamName','chargeToTeamId','chargeToTeamName','claimType','category','description','date','amount'];

function protectKey(bytes, decrypt = false) {
  assert.equal(process.platform, 'win32');
  const operation = decrypt ? 'Unprotect' : 'Protect';
  const result = cp.spawnSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command',
    `Add-Type -AssemblyName System.Security; $inputBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${operation}($inputBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))`],
  { input: bytes.toString('base64'), encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('backup-key-protection-failed');
  return Buffer.from(result.stdout.trim(), 'base64');
}
function savePlan(filename, plan) {
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(plan), 'utf8'), cipher.final()]);
  const envelope = { version: 1, protectedKey: protectKey(key).toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), ciphertext: encrypted.toString('base64') };
  fs.writeFileSync(filename, JSON.stringify(envelope), { flag: 'wx' }); key.fill(0);
  assert.equal(hash(loadPlan(filename)), hash(plan), 'backup-roundtrip-failed');
}
function loadPlan(filename) {
  const envelope = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const key = protectKey(Buffer.from(envelope.protectedKey, 'base64'), true);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const value = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  key.fill(0); return value;
}
const bounded = async (query, transaction) => {
  const snapshot = await (transaction ? transaction.get(query.limit(10001)) : query.limit(10001).get());
  if (snapshot.size >= 10001) throw new Error('query-limit-reached');
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
};
async function loadSources(db, yearMonth, transaction) {
  const [teams, accommodation, vehicle, cards, claims] = await Promise.all([
    bounded(db.collection('teams').select('name','legacyId'), transaction),
    ...['accommodation_billing_documents','vehicle_billing_documents','cardBillings','team_expense_claims']
      .map(collection => bounded(db.collection(collection).where('yearMonth','==',yearMonth).select(...fields), transaction))
  ]);
  const lines = [];
  for (let i = 0; i < accommodation.length; i += 30) lines.push(...await bounded(db.collection('accommodation_billing_line_items')
    .where('billingDocumentId','in',accommodation.slice(i,i + 30).map(doc => doc.id))
    .select('billingDocumentId','amount','label','sourceType','sourceAccommodationId','status','cancelledAt'), transaction));
  return { teams, accommodationDocs: accommodation.map(row => ({ ...row, teamId: row.team?.id || row.teamId,
    teamName: row.teamName || row.team?.name, issuedToType: row.issuedToType || 'worker', lineItems: lines.filter(line => line.billingDocumentId === row.id) })),
    vehicleDocs: vehicle.map(row => ({ ...row, lineItems: parse(row.lineItems) || [] })), cardDocs: cards, teamExpenseClaims: claims };
}
function getEntries(doc, sources) {
  const byId = new Map(), byName = new Map();
  for (const team of sources.teams) {
    for (const id of [team.id, team.legacyId]) if (id) byId.set(norm(id), team.id);
    if (team.name && !byName.has(norm(team.name))) byName.set(norm(team.name), team.id);
  }
  const resolve = (id, name) => norm(id) ? byId.get(norm(id)) || norm(id) : byName.get(norm(name)) || '';
  const teamId = resolve(doc.teamId, doc.teamName), teamName = sources.teams.find(team => team.id === teamId)?.name;
  return buildTeamSettlementExpenseEntries({ ...sources, yearMonth: doc.yearMonth, matchesTeam: (id, name) => {
    const resolved = resolve(id, name);
    return resolved === teamId || Boolean(teamName && norm(resolved) === norm(teamName));
  } });
}
async function prepare(db, projectId, from, through) {
  assert.match(from, /^\d{4}-\d{2}$/); assert.match(through, /^\d{4}-\d{2}$/); assert(from <= through);
  const rows = await bounded(db.collection('system_configs').where(admin.firestore.FieldPath.documentId(), '>=', `team_settlement_${from}__`)
    .where(admin.firestore.FieldPath.documentId(), '<=', `team_settlement_${through}__\uf8ff`));
  const plan = { version: 1, projectId, operationId: crypto.randomUUID(), appliedAt: new Date().toISOString(), from, through, records: [] };
  const summary = { mode: 'prepare', writes: 0, scanned: rows.length, eligible: 0, confirmedSkipped: 0, manualReviewSkipped: 0, unchanged: 0, withoutSnapshot: 0, months: {} };
  const sourcesByMonth = new Map();
  for (const row of rows) {
    const raw = parse(row.data); const doc = TeamSettlementDocumentSchema.parse(raw);
    if (doc.yearMonth < from || doc.yearMonth > through) continue;
    if (doc.confirmedAt) { summary.confirmedSkipped++; continue; }
    if (!sourcesByMonth.has(doc.yearMonth)) sourcesByMonth.set(doc.yearMonth, await loadSources(db, doc.yearMonth));
    const entries = getEntries(doc, sourcesByMonth.get(doc.yearMonth));
    const result = buildRepair(raw, entries, plan.appliedAt);
    if (result.skip) { summary[result.skip === 'manual-review' ? 'manualReviewSkipped' : 'unchanged']++; continue; }
    const beforeConfig = { ...row }; delete beforeConfig.id;
    plan.records.push({ id: row.id, yearMonth: doc.yearMonth, beforeConfig, after: result.candidate, entriesHash: hash(entries) });
    summary.eligible++; if (!result.hasSnapshot) summary.withoutSnapshot++;
    summary.months[doc.yearMonth] = (summary.months[doc.yearMonth] || 0) + 1;
  }
  const dir = path.join(root, 'artifacts', 'team-settlement-expense-recovery-' + plan.operationId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, 'backup-plan.encrypted.json'); savePlan(filename, plan);
  fs.writeFileSync(path.join(dir, 'preview.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, encryptedBackup: filename }));
}
async function apply(db, filename, rollback = false) {
  const plan = loadPlan(filename);
  const summary = { mode: rollback ? 'rollback' : 'apply', operationId: plan.operationId, planned: plan.records.length, written: 0, alreadyApplied: 0, verified: 0, months: {} };
  const report = path.join(path.dirname(filename), rollback ? 'rollback.json' : 'result.json');
  const saveReport = () => fs.writeFileSync(report, JSON.stringify(summary, null, 2));
  try {
    for (const record of plan.records) {
      const reference = db.collection('system_configs').doc(record.id);
      const state = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(reference); assert(snapshot.exists, 'settlement-missing');
        const config = snapshot.data(); const raw = parse(config.data);
        if (!rollback && hash(raw) === hash(record.after)) return 'alreadyApplied';
        if (rollback) {
          if (hash(raw) === hash(parse(record.beforeConfig.data))) return 'alreadyApplied';
          assert.equal(hash(raw), hash(record.after), 'settlement-edited-after-repair');
          assert(!raw.confirmedAt, 'settlement-confirmed-after-repair');
          // Restore only the two fields this operation wrote; preserve later unrelated metadata.
          assert(Object.values(record.beforeConfig).every(value => value === null || typeof value !== 'object'), 'unsupported-backup-metadata');
          transaction.update(reference, { data: record.beforeConfig.data,
            updatedAt: record.beforeConfig.updatedAt ?? admin.firestore.FieldValue.delete() });
        } else {
          assert(Object.values(record.beforeConfig).every(value => value === null || typeof value !== 'object'), 'unsupported-backup-metadata');
          assert.equal(hash(config), hash(record.beforeConfig), 'settlement-changed-since-preview');
          assert(!raw.confirmedAt, 'settlement-now-confirmed');
          const sources = await loadSources(db, record.yearMonth, transaction), entries = getEntries(raw, sources);
          assert.equal(hash(entries), record.entriesHash, 'source-changed-since-preview');
          const result = buildRepair(raw, entries, plan.appliedAt);
          assert(result.candidate, 'repair-no-longer-eligible');
          assert.equal(hash(result.candidate), hash(record.after), 'repair-plan-changed');
          transaction.update(reference, { data: JSON.stringify(record.after), updatedAt: plan.appliedAt });
        }
        return 'written';
      });
      summary[state]++; summary.months[record.yearMonth] = (summary.months[record.yearMonth] || 0) + 1;
      const stored = parse((await reference.get()).get('data'));
      assert.equal(hash(stored), hash(rollback ? parse(record.beforeConfig.data) : record.after), 'readback-mismatch');
      assert.equal(protectedContent(stored), protectedContent(parse(record.beforeConfig.data)), 'protected-content-mismatch');
      summary.verified++; saveReport();
    }
  } finally { saveReport(); console.log(JSON.stringify(summary)); }
}
async function main() {
  const [mode, projectOrFile, from, through] = process.argv.slice(2);
  assert(['prepare','apply','rollback'].includes(mode), 'mode-required');
  const projectId = mode === 'prepare' ? projectOrFile : loadPlan(projectOrFile).projectId;
  assert.equal(projectId, 'cyee-9c1e4', 'unexpected-project');
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
  const app = admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() });
  try { if (mode === 'prepare') await prepare(app.firestore(), projectId, from, through); else await apply(app.firestore(), projectOrFile, mode === 'rollback'); }
  finally { await app.delete(); }
}
if (require.main === module) main().catch(error => { console.error('Recovery stopped: ' + (error.code || error.name)); process.exitCode = 1; });
module.exports = { savePlan, loadPlan, getEntries, loadSources };
