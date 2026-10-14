// Read-only: use the application's pure calculation and print aggregate counts only.
// Usage: node scripts/audit-team-settlement-expenses.cjs PROJECT FROM THROUGH [TEAM_NAME]
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const admin = require('firebase-admin');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, filename);
const { buildTeamSettlementExpenseEntries, compareTeamSettlementExpenses } = require('../src/utils/teamSettlementExpenses.ts');
const { TeamSettlementDocumentSchema } = require('../src/types/teamSettlement.ts');
const norm = value => String(value ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const counts = rows => rows.reduce((out, row) => { const key = row.direction + ':' + row.item.origin; out[key] = (out[key] || 0) + 1; return out; }, {});

async function main() {
  const [projectId, from, through, targetName] = process.argv.slice(2);
  if (!projectId || !/^\d{4}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}$/.test(through || '') || from > through || from.slice(0, 4) !== through.slice(0, 4)) throw new Error('invalid-arguments');
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||= path.join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json');
  const app = admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() });
  try {
    const db = app.firestore();
    const bounded = async query => {
      const snapshot = await query.limit(10001).get();
      if (snapshot.size >= 10001) throw new Error('audit-limit-reached');
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    };
    const fields = ['yearMonth','teamId','teamName','team','assignedTeamId','assignedTeamName','issuedToType','issuedToWorkerId','issuedToWorkerName',
      'status','lineItems','vehicleId','vehiclePlate','cardId','cardLabel','fixedCost','variableCost','totalAmount',
      'payerTeamId','payerTeamName','chargeToTeamId','chargeToTeamName','claimType','category','description','date','amount'];
    const collections = ['accommodation_billing_documents','vehicle_billing_documents','cardBillings','team_expense_claims'];
    const [teams, rawSaved, ...rawSources] = await Promise.all([
      bounded(db.collection('teams').select('name','legacyId')),
      bounded(db.collection('system_configs').where(admin.firestore.FieldPath.documentId(), '>=', 'team_settlement_' + from.slice(0, 4) + '-')
        .where(admin.firestore.FieldPath.documentId(), '<=', 'team_settlement_' + through + '__\uf8ff').select('data')),
      ...collections.map(collection => bounded(db.collection(collection).where('yearMonth','>=',from).where('yearMonth','<=',through).select(...fields)))
    ]);
    const byId = new Map(), byName = new Map();
    teams.forEach(team => {
      for (const id of [team.id, team.legacyId]) if (id) byId.set(norm(id), team.id);
      if (team.name) byName.set(norm(team.name), team.id);
    });
    const resolve = (id, name) => norm(id) ? byId.get(norm(id)) || norm(id) : byName.get(norm(name)) || '';
    const target = targetName ? teams.filter(team => [targetName,targetName + '팀'].includes(team.name)) : null;
    if (target && target.length !== 1) throw new Error('ambiguous-target');
    const [accommodation, vehicles, cards, claims] = rawSources;
    // Line items have no yearMonth. Query their billing document IDs explicitly.
    const lines = [];
    for (let offset = 0; offset < accommodation.length; offset += 30) {
      lines.push(...await bounded(db.collection('accommodation_billing_line_items')
        .where('billingDocumentId', 'in', accommodation.slice(offset, offset + 30).map(doc => doc.id))
        .select('billingDocumentId','amount','label','sourceType','sourceAccommodationId','status','cancelledAt')));
    }
    rawSources.push(lines);
    const docs = accommodation.map(row => ({ ...row, teamId: row.team?.id || row.teamId,
      teamName: row.teamName || row.team?.name, issuedToType: row.issuedToType || 'worker',
      lineItems: lines.filter(line => (line.billingDocument?.id || line.billingDocumentId) === row.id) }));
    const saved = []; let invalidDocuments = 0;
    for (const row of rawSaved) {
      let parsed; try { parsed = TeamSettlementDocumentSchema.safeParse(parse(row.data)); } catch { invalidDocuments++; continue; }
      if (!parsed.success) { invalidDocuments++; continue; }
      const doc = parsed.data;
      if (doc.yearMonth < from || doc.yearMonth > through || (target && resolve(doc.teamId, doc.teamName) !== target[0].id)) continue;
      saved.push(doc);
    }
    const monthly = new Map(), issues = [], savedScopes = new Set();
    for (const doc of saved) {
      const teamId = resolve(doc.teamId, doc.teamName);
      const scope = doc.yearMonth + ':' + teamId;
      const duplicateSavedScope = savedScopes.has(scope); savedScopes.add(scope);
      const month = monthly.get(doc.yearMonth) || { month: doc.yearMonth, saved: 0, affected: 0, amountChangedDocuments: 0, confirmedAffected: 0, sourceErrors: 0, duplicateSavedScopes: 0, missing: {}, changedByOrigin: {}, changed: 0, unexpected: 0, duplicate: 0 };
      month.saved++; if (duplicateSavedScope) month.duplicateSavedScopes++;
      try {
        const teamName = teams.find(team => team.id === teamId)?.name;
        const entries = buildTeamSettlementExpenseEntries({ yearMonth: doc.yearMonth, matchesTeam: (id, name) => {
          const resolved = resolve(id, name);
          return resolved === teamId || Boolean(teamName && norm(resolved) === norm(teamName));
        },
          accommodationDocs: docs, vehicleDocs: vehicles.map(row => ({ ...row, lineItems: parse(row.lineItems) || [] })), cardDocs: cards, teamExpenseClaims: claims });
        const result = compareTeamSettlementExpenses(doc, entries);
        const affected = result.missing.length + result.changed.length + result.unexpected.length + result.duplicate.length > 0;
        if (affected) { month.affected++; if (doc.confirmedAt) month.confirmedAffected++; }
        const savedTotals = {}, sourceTotals = {};
        for (const [direction, rows] of [['deduction', doc.deductions], ['addition', doc.additions]]) {
          for (const row of rows) if (row.source === 'auto' && ['accommodation_billing','vehicle_billing','card_billing','team_expense_claim'].includes(row.origin)) {
            const key = direction + ':' + row.origin; savedTotals[key] = (savedTotals[key] || 0) + row.amount;
          }
        }
        for (const entry of entries) { const key = entry.direction + ':' + entry.item.origin; sourceTotals[key] = (sourceTotals[key] || 0) + entry.item.amount; }
        if ([...new Set([...Object.keys(savedTotals), ...Object.keys(sourceTotals)])].some(key => (savedTotals[key] || 0) !== (sourceTotals[key] || 0))) month.amountChangedDocuments++;
        for (const [key, count] of Object.entries(counts(result.missing))) month.missing[key] = (month.missing[key] || 0) + count;
        for (const [key, count] of Object.entries(counts(result.changed))) month.changedByOrigin[key] = (month.changedByOrigin[key] || 0) + count;
        month.changed += result.changed.length; month.unexpected += result.unexpected.length; month.duplicate += result.duplicate.length;
      } catch (error) { month.sourceErrors++; issues.push(error.message); }
      monthly.set(doc.yearMonth, month);
    }
    console.log(JSON.stringify({ writes: 0, from, through, targeted: Boolean(target), savedDocuments: saved.length, invalidDocuments,
      sourceCounts: Object.fromEntries([...collections,'accommodation_billing_line_items'].map((collection, index) => [collection, rawSources[index].length])),
      months: [...monthly.values()].sort((a,b) => a.month.localeCompare(b.month)), sourceErrorKinds: [...new Set(issues)] }, null, 2));
  } finally { await app.delete(); }
}
main().catch(error => { console.error('Read-only audit failed: ' + (error.code || error.name)); process.exitCode = 1; });
